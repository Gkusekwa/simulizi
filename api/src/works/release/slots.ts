/**
 * Release slots (doc 04 / doc 14 §2). A slot is a release instant produced by
 * the work's plan: daily at releaseTime, or weekly on releaseWeekdays at
 * releaseTime, in the work's timezone. Manual and all-at-once plans have none.
 */
import type { ReleasePlan } from '@prisma/client';

export interface PlanInput {
  releasePlan: ReleasePlan;
  releaseTime: string; // "HH:MM"
  releaseWeekdays: number[]; // 0=Sunday .. 6=Saturday
  timezone: string;
}

/** Offset of `tz` from UTC at `instant`, in minutes. */
function tzOffsetMinutes(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Civil date (y, m, d) and weekday of `instant` in `tz`. */
function civil(instant: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(dtf.formatToParts(instant).map((p) => [p.type, p.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), weekday };
}

/** The instant of civil `y-m-d HH:MM` in `tz`. */
function instantOf(y: number, m: number, d: number, hhmm: string, tz: string): Date {
  const [hh, mm] = hhmm.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  // Two passes handle DST edges; East Africa has none, but the code is generic.
  let offset = tzOffsetMinutes(guess, tz);
  let result = new Date(guess.getTime() - offset * 60_000);
  offset = tzOffsetMinutes(result, tz);
  result = new Date(guess.getTime() - offset * 60_000);
  return result;
}

/** Next slot strictly after `after`, or null for plans without slots. */
export function nextSlot(plan: PlanInput, after: Date): Date | null {
  if (plan.releasePlan !== 'daily' && plan.releasePlan !== 'weekly') return null;
  const weekdays =
    plan.releasePlan === 'weekly' && plan.releaseWeekdays.length ? plan.releaseWeekdays : null;
  if (plan.releasePlan === 'weekly' && !weekdays) return null;

  const start = civil(after, plan.timezone);
  for (let i = 0; i <= 400; i++) {
    const day = new Date(Date.UTC(start.y, start.m - 1, start.d + i));
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    const weekday = day.getUTCDay();
    if (weekdays && !weekdays.includes(weekday)) continue;
    const candidate = instantOf(y, m, d, plan.releaseTime, plan.timezone);
    if (candidate.getTime() > after.getTime()) return candidate;
  }
  return null;
}

/** `count` consecutive slots after `after`. */
export function nextSlots(plan: PlanInput, after: Date, count: number): Date[] {
  const out: Date[] = [];
  let cursor = after;
  for (let i = 0; i < count; i++) {
    const s = nextSlot(plan, cursor);
    if (!s) break;
    out.push(s);
    cursor = s;
  }
  return out;
}
