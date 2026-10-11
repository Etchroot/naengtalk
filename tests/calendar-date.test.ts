import test from 'node:test';
import assert from 'node:assert/strict';
const calendar = await import('../mobile/src/domain/calendar-date.ts').catch(() => ({}));
test('calendar opens at the existing valid date, or today for missing, invalid and past dates', () => {
  const initial = Reflect.get(calendar, 'calendarInitialDate');
  assert.equal(typeof initial, 'function');
  const now = new Date(2026, 9, 3, 22, 30);
  assert.equal(initial('2026-10-10', now).getDate(), 10);
  for (const value of ['', '2026-02-31', '2026-10-02']) {
    assert.equal(initial(value, now).getTime(), new Date(2026, 9, 3).getTime());
  }
});
test('calendar confirmation uses the local calendar day; cancelling and past selections change nothing', () => {
  const confirm = Reflect.get(calendar, 'confirmedCalendarDate');
  assert.equal(typeof confirm, 'function');
  const now = new Date(2026, 9, 3, 22, 30);
  const selected = new Date(2026, 9, 10);
  assert.equal(confirm('set', selected, now), '2026-10-10');
  assert.equal(confirm('dismissed', selected, now), null);
  assert.equal(confirm('set', undefined, now), null);
  assert.equal(confirm('set', new Date('invalid'), now), null);
  assert.equal(confirm('set', new Date(2026, 9, 2), now), null);
});

test('editing existing inventory can retain or select a past date without changing purchase defaults', () => {
  const initial = Reflect.get(calendar, 'calendarInitialDate');
  const confirm = Reflect.get(calendar, 'confirmedCalendarDate');
  const now = new Date(2026, 9, 3);
  const past = new Date(2026, 8, 10);
  assert.equal(initial('2026-09-10', now, true).getTime(), past.getTime());
  assert.equal(confirm('set', past, now, true), '2026-09-10');
  assert.equal(confirm('dismissed', past, now, true), null);
  assert.equal(confirm('set', past, now), null);
});
