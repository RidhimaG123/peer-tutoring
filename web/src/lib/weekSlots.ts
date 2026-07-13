const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDayLabel(date: Date): string {
  return `${WEEKDAY_LABELS[date.getDay()]} ${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`;
}

export function getUpcomingWeekdays(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();

  let start = today;
  if (dayOfWeek === 0) {
    start = new Date(today);
    start.setDate(start.getDate() + 1);
  } else if (dayOfWeek === 6) {
    start = new Date(today);
    start.setDate(start.getDate() + 2);
  }

  const daysUntilFriday = 5 - start.getDay();
  const dates: Date[] = [];
  for (let i = 0; i <= daysUntilFriday; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}
