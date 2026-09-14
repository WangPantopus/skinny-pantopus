/** A selected end day includes that whole local calendar day, including DST. */
export function homeInviteDates(startDay: string, endDay: string) {
  function localDay(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a valid access date.');
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new Error('Choose a valid access date.');
    }
    return date;
  }
  const start = startDay ? localDay(startDay) : undefined;
  const lastDay = endDay ? localDay(endDay) : undefined;
  if (start && lastDay && lastDay < start) throw new Error('The end date must be on or after the start date.');
  const end = lastDay ? new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1) : undefined;
  return { start_at: start?.toISOString(), end_at: end?.toISOString() };
}
