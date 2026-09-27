import type { CookingState } from "../../domain/cooking.ts";
import { createGuestInventory, createGuestTools } from "../../domain/seed.ts";
import type { ChatMessage, MenuRecipe } from "../../domain/menu-chat.ts";
import { newProposalSharingState } from "../../domain/recipe-sharing.ts";
import { backendConfig } from "../../services/backend-config.ts";
import { sampleRecipe } from "./sample-recipe.ts";

export type AppTab = 0 | 1 | 2 | 3 | 4 | 5;

export type LocalState = CookingState & {
  providedAt: string;
  saved: boolean;
  savedRecipeId: string | null;
  sharePending: boolean;
  shared: boolean;
  tools: string[];
  allergens: string[];
  timer: { label: string; endsAt: number } | null;
  chat: ChatMessage[];
  recipe: MenuRecipe | null;
};

export function createInitialState(now = new Date()): LocalState {
  const date = now.toISOString().slice(0, 10);
  return {
    inventory: createGuestInventory(date),
    completedSessionIds: [],
    providedAt: date,
    saved: false,
    ...newProposalSharingState(),
    tools: createGuestTools(),
    allergens: ["새우"],
    timer: null,
    chat: [],
    recipe: backendConfig.mode === "local" ? sampleRecipe : null,
  };
}
