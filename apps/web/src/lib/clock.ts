function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export function todayIso(now: Date = new Date()): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;
}
