const ISO_DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function isValidDateKey(value: string): boolean {
  const match = ISO_DATE_KEY.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function getLocalTodayPresentation(now = new Date()): {
  key: string;
  label: string;
} {
  const year = now.getFullYear();
  const month = padDatePart(now.getMonth() + 1);
  const day = padDatePart(now.getDate());

  return {
    key: `${year}-${month}-${day}`,
    label: `${month}.${day}`,
  };
}

export function isPastUseBy(useBy: string, todayKey: string): boolean {
  return (
    isValidDateKey(useBy) &&
    isValidDateKey(todayKey) &&
    useBy < todayKey
  );
}
