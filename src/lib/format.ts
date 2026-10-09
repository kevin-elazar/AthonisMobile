const pad = (value: number) => String(value).padStart(2, '0');

/** Dia local do aparelho, AAAA-MM-DD. */
export function localDay(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "14:32", na hora do aparelho. Devolve travessão quando não há valor. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "08/10 14:32". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${formatTime(iso)}`;
}

/** "08/10/2026" a partir de "2026-10-08", sem passar por fuso horário. */
export function formatDay(day: string | null | undefined): string {
  if (!day) return '—';
  const [year, month, date] = day.slice(0, 10).split('-');
  return year && month && date ? `${date}/${month}/${year}` : day;
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters == null) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const rest = total % 60;
  return rest === 0 ? `${Math.floor(total / 60)} h` : `${Math.floor(total / 60)} h ${rest} min`;
}

/** Minutos inteiros entre dois instantes ISO; null se algum faltar. */
export function minutesBetween(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(diff) ? Math.max(0, Math.round(diff / 60000)) : null;
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
