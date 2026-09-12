#!/usr/bin/env python3
"""Validate and import the immutable MFDS/MAFRA recipe catalog snapshot."""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable

RECIPE_ID_PATTERN = re.compile(r"^(MFDS|MAFRA)_\d{6}$")
EXPECTED_COUNTS = {
    "recipes": 1684,
    "ingredients": 18920,
    "steps": 9542,
}
FILES = {
    "recipes": "FINAL_recipes.csv",
    "ingredients": "FINAL_ingredients.csv",
    "steps": "FINAL_steps.csv",
}
HEADERS = {
    "recipes": [
        "recipe_id",
        "source",
        "source_name",
        "source_dataset",
        "source_recipe_id",
        "name",
        "summary",
        "cuisine",
        "category",
        "cooking_method",
        "cooking_time",
        "servings",
        "difficulty",
        "estimated_cost",
        "main_ingredient_category",
        "weight_g",
        "kcal",
        "carbs_g",
        "protein_g",
        "fat_g",
        "sodium_mg",
        "hashtag",
        "image_main_url",
        "image_cooking_url",
        "tip",
        "ingredients_raw",
    ],
    "ingredients": [
        "recipe_id",
        "source",
        "source_recipe_id",
        "ingredient_no",
        "ingredient_group",
        "ingredient_raw",
        "ingredient_name",
        "normalized_name",
        "parent_ingredient",
        "amount",
        "search_key",
        "parse_status",
    ],
    "steps": [
        "recipe_id",
        "source",
        "source_recipe_id",
        "step_no",
        "source_step_no",
        "description",
        "description_raw",
        "image_url",
        "step_tip",
    ],
}
REQUIRED_FIELDS = {
    "recipes": {
        "recipe_id",
        "source",
        "source_name",
        "source_dataset",
        "source_recipe_id",
        "name",
        "category",
        "ingredients_raw",
    },
    "ingredients": {
        "recipe_id",
        "source",
        "source_recipe_id",
        "ingredient_no",
        "ingredient_group",
        "ingredient_raw",
        "ingredient_name",
        "normalized_name",
        "search_key",
        "parse_status",
    },
    "steps": {
        "recipe_id",
        "source",
        "source_recipe_id",
        "step_no",
        "source_step_no",
        "description",
        "description_raw",
    },
}
RECIPE_NUMERIC_FIELDS = (
    "weight_g",
    "kcal",
    "carbs_g",
    "protein_g",
    "fat_g",
    "sodium_mg",
)


class CatalogValidationError(ValueError):
    """Raised when the local immutable snapshot violates its contract."""


class CatalogImportError(RuntimeError):
    """Raised when a remote catalog import cannot proceed safely."""


def default_data_directory() -> Path:
    return Path(__file__).resolve().parents[1] / "scripts" / "data"


def read_csv_table(data_directory: Path, table: str) -> list[dict[str, str]]:
    path = data_directory / FILES[table]
    if not path.is_file():
        raise CatalogValidationError(f"{table} CSV file is missing")

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != HEADERS[table]:
            raise CatalogValidationError(f"{table} CSV headers do not match the contract")
        return list(reader)


def duplicate_count(values: Iterable[object]) -> int:
    seen: set[object] = set()
    duplicates = 0
    for value in values:
        if value in seen:
            duplicates += 1
        else:
            seen.add(value)
    return duplicates


def require_nonempty_fields(
    table: str,
    rows: list[dict[str, str]],
) -> None:
    for row_number, row in enumerate(rows, start=2):
        for field in REQUIRED_FIELDS[table]:
            if not row[field].strip():
                raise CatalogValidationError(
                    f"{table} row {row_number} has an empty required field: {field}"
                )


def validate_integer_field(
    table: str,
    rows: list[dict[str, str]],
    field: str,
) -> None:
    for row_number, row in enumerate(rows, start=2):
        try:
            value = int(row[field])
        except ValueError as error:
            raise CatalogValidationError(
                f"{table} row {row_number} has an invalid integer: {field}"
            ) from error
        if value < 1:
            raise CatalogValidationError(
                f"{table} row {row_number} has a non-positive integer: {field}"
            )


def validate_decimal_fields(rows: list[dict[str, str]]) -> None:
    for row_number, row in enumerate(rows, start=2):
        for field in RECIPE_NUMERIC_FIELDS:
            value = row[field].strip()
            if not value:
                continue
            try:
                Decimal(value)
            except InvalidOperation as error:
                raise CatalogValidationError(
                    f"recipes row {row_number} has an invalid numeric field: {field}"
                ) from error


def validate_recipe_ids(table: str, rows: list[dict[str, str]]) -> None:
    for row_number, row in enumerate(rows, start=2):
        recipe_id = row["recipe_id"]
        if not RECIPE_ID_PATTERN.fullmatch(recipe_id):
            raise CatalogValidationError(
                f"{table} row {row_number} has an invalid recipe_id"
            )
        expected_source = recipe_id.split("_", maxsplit=1)[0]
        if row["source"] != expected_source:
            raise CatalogValidationError(
                f"{table} row {row_number} source does not match recipe_id"
            )


def load_and_validate(
    data_directory: Path,
) -> tuple[dict[str, list[dict[str, str]]], dict[str, object]]:
    tables = {
        table: read_csv_table(data_directory, table)
        for table in ("recipes", "ingredients", "steps")
    }

    counts = {table: len(rows) for table, rows in tables.items()}
    for table, expected in EXPECTED_COUNTS.items():
        actual = counts[table]
        if actual != expected:
            raise CatalogValidationError(
                f"{table} row count mismatch: expected {expected}, got {actual}"
            )

    for table, rows in tables.items():
        require_nonempty_fields(table, rows)
        validate_recipe_ids(table, rows)

    validate_decimal_fields(tables["recipes"])
    validate_integer_field("ingredients", tables["ingredients"], "ingredient_no")
    validate_integer_field("steps", tables["steps"], "step_no")

    recipe_ids = {row["recipe_id"] for row in tables["recipes"]}
    recipe_duplicates = len(tables["recipes"]) - len(recipe_ids)
    ingredient_duplicates = duplicate_count(
        (row["recipe_id"], row["ingredient_no"])
        for row in tables["ingredients"]
    )
    step_duplicates = duplicate_count(
        (row["recipe_id"], row["step_no"])
        for row in tables["steps"]
    )

    ingredient_ids = {row["recipe_id"] for row in tables["ingredients"]}
    step_ids = {row["recipe_id"] for row in tables["steps"]}
    ingredient_orphans = len(ingredient_ids - recipe_ids)
    step_orphans = len(step_ids - recipe_ids)

    if recipe_duplicates or ingredient_duplicates or step_duplicates:
        raise CatalogValidationError("catalog natural keys contain duplicates")
    if ingredient_orphans or step_orphans:
        raise CatalogValidationError("catalog child rows contain orphan recipe IDs")

    summary: dict[str, object] = {
        "counts": counts,
        "orphans": {
            "ingredients": ingredient_orphans,
            "steps": step_orphans,
        },
        "duplicates": {
            "recipes": recipe_duplicates,
            "ingredients": ingredient_duplicates,
            "steps": step_duplicates,
        },
        "recipes_without_ingredients": len(recipe_ids - ingredient_ids),
    }
    return tables, summary


def require_import_environment() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL", "").strip()
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    missing = [
        name
        for name, value in (
            ("SUPABASE_URL", url),
            ("SUPABASE_SERVICE_ROLE_KEY", service_role_key),
        )
        if not value
    ]
    if missing:
        raise CatalogImportError(
            "required server-only environment is missing: " + ", ".join(missing)
        )
    if not url.startswith("https://"):
        raise CatalogImportError("SUPABASE_URL must use https")
    return url.rstrip("/"), service_role_key


def parse_arguments(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate or import the immutable public recipe catalog"
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--validate-only",
        action="store_true",
        help="validate local CSV files without any network request",
    )
    mode.add_argument(
        "--apply",
        action="store_true",
        help="upsert the validated snapshot into the linked Supabase project",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=default_data_directory(),
        help="directory containing the three FINAL_*.csv files",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_arguments(sys.argv[1:] if argv is None else argv)
    _tables, summary = load_and_validate(args.data_dir.resolve())

    if args.apply:
        require_import_environment()
        raise CatalogImportError("remote import transport is not configured")

    print(json.dumps(summary, ensure_ascii=True, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (CatalogValidationError, CatalogImportError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1) from None

