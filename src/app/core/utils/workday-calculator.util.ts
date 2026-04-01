// Helper function to format date as YYYY-MM-DD in local timezone
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateWorkdays(period: string, holidays: any[] = []): number {
  // Guard against undefined or null period
  if (!period || typeof period !== 'string') return 1;
  
  const sep = period.includes(' to ') ? ' to ' : ' - ';
  if (!period.includes(sep)) return 1;

  const parts = period.split(sep);
  let start = new Date(parts[0]);
  const end = new Date(parts[1]);
  
  // Normalize to midnight for accurate comparison
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let workdayCount = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0 = Sun, 6 = Sat
    const dateStr = formatLocalDate(current);

    // Check if it's a weekend
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Check if it's a Public Holiday (Regular or Special Non-Working)
    const isHoliday = holidays.some(h => 
      h.date === dateStr && (h.type === 'regular' || h.type === 'special-non')
    );

    // Count as workday if not a weekend (holidays are now allowed for leave filing)
    if (!isWeekend) {
      workdayCount++;
    }

    current.setDate(current.getDate() + 1);
  }

  return workdayCount;
}