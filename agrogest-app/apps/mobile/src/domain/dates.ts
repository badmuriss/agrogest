const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const pad = (n: number) => String(n).padStart(2, '0');

function fromISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Data local ao meio-dia: evita converter uma data de calendário em meia-noite UTC. */
export function parseISODate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, yyyy, mm, dd] = match;
  const year = Number(yyyy);
  const month = Number(mm) - 1;
  const day = Number(dd);
  const date = new Date(0);
  date.setFullYear(year, month, day);
  date.setHours(12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
}

export function toISODate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((fromISODate(toISO).getTime() - fromISODate(fromISO).getTime()) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function addMonths(iso: string, months: number): string {
  const date = fromISODate(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toISODate(date);
}

/** Desloca um mês de calendário (AAAA-MM), sem depender do dia ou fuso horário. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateShort(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "13 de out" no ano corrente; "30 de dez de 2025" em outro ano. Para cabeçalhos de dia em listas. */
export function formatDayMonth(iso: string, today: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  const base = `${Number(d)} de ${MONTH_SHORT[Number(m) - 1]}`;
  return y === today.slice(0, 4) ? base : `${base} de ${y}`;
}

export function formatDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function monthLabel(iso: string): string {
  return MONTHS[Number(iso.slice(5, 7)) - 1];
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** "2026-10-14" → "Outubro de 2026". */
export function monthTitle(iso: string): string {
  return `${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
}

/** "dd/mm/aaaa" → ISO; null se a data não existir. */
export function parseBRDate(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  return parseISODate(iso) ? iso : null;
}
