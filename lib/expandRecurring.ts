import { Event } from '@/types';

/**
 * Expands recurring events into individual weekly occurrences.
 * Each occurrence is a virtual copy of the event with a different date.
 * Shows occurrences from today up to 3 months ahead (or recurring_end_date).
 */
export function expandRecurringEvents(events: Event[]): Event[] {
  const result: Event[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 3);

  for (const event of events) {
    if (!event.is_recurring) {
      result.push(event);
      continue;
    }

    const startDate = new Date(event.date + 'T00:00:00');
    const endDate = (event as any).recurring_end_date
      ? new Date((event as any).recurring_end_date + 'T00:00:00')
      : maxDate;
    const cap = endDate < maxDate ? endDate : maxDate;

    let current = new Date(startDate);
    while (current < today) current.setDate(current.getDate() + 7);

    const cancelledDates = new Set(event.cancelled_dates ?? []);
    while (current <= cap) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      if (!cancelledDates.has(dateStr)) {
        result.push({ ...event, id: `${event.id}_${dateStr}`, date: dateStr, _recurringStartDate: event.date } as any);
      }
      current = new Date(current);
      current.setDate(current.getDate() + 7);
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}
