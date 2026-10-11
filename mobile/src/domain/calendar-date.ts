function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calendarInitialDate(value: string, now = new Date(), allowPast = false): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return today;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return localDateString(date) === value && (allowPast || date >= today) ? date : today;
}

export function confirmedCalendarDate(eventType: string, date: Date | undefined, now = new Date(), allowPast = false): string | null {
  if (eventType !== 'set' || !date || Number.isNaN(date.getTime())) return null;
  const value = localDateString(date);
  return allowPast || value >= localDateString(now) ? value : null;
}
