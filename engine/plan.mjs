/**
 * Turning "N pulls left" into days and gold.
 *
 * Costs come from engine/tracker.mjs PULL_COST (first pull of the day discounted, the rest
 * regular; the day resets at 00:00 UTC = 09:00 KST). The prices themselves are an assumption
 * to confirm in game; the page says so.
 */
import { PULL_COST } from './tracker.mjs';

const DAY_MS = 24 * 3600 * 1000;

/** Start of the UTC day containing `date`, as a Date. */
function utcDayStart(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Plan for `n` pulls doing `perDay` pulls a day (the first of each day discounted).
 * If today's discount is already used, today's pulls (if any) are all regular — we then start tomorrow
 * so every day keeps its discounted pull. Returns { n, perDay, days, gold, start, finish } where start/finish
 * are the UTC day-starts of the first and last pulling day.
 */
export function planPerDay(n, perDay, { discountUsedToday = false, now = new Date() } = {}) {
  if (!Number.isInteger(n) || n < 1) return null;
  if (!Number.isInteger(perDay) || perDay < 1) throw new RangeError('perDay must be >= 1');
  const days = Math.ceil(n / perDay);
  const discounted = days; // one per pulling day
  const gold = discounted * PULL_COST.firstOfDay + (n - discounted) * PULL_COST.regular;
  const start = new Date(utcDayStart(now).getTime() + (discountUsedToday ? DAY_MS : 0));
  const finish = new Date(start.getTime() + (days - 1) * DAY_MS);
  return { n, perDay, days, gold, start, finish };
}

/** All n pulls right now. */
export function planAllNow(n, { discountUsedToday = false } = {}) {
  if (!Number.isInteger(n) || n < 1) return null;
  const gold = discountUsedToday ? n * PULL_COST.regular : PULL_COST.firstOfDay + (n - 1) * PULL_COST.regular;
  return { n, gold };
}
