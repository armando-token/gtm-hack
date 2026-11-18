/** Business-hours clock with an explicit IANA zone. Never uses server-local time. */
export interface BusinessCalendar {
  readonly timeZone: string;           // IANA, e.g. "America/New_York"
  readonly workdays: readonly number[]; // 1=Mon … 7=Sun (ISO)
  readonly start: string;              // "09:00"
  readonly end: string;                // "17:00"
  readonly holidays: readonly string[]; // local "YYYY-MM-DD"
}

function parts(ms: number, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p["weekday"]!) + 1;
  return { y: +p["year"]!, m: +p["month"]!, d: +p["day"]!, h: +p["hour"]!, mi: +p["minute"]!, s: +p["second"]!, wd, date: `${p["year"]}-${p["month"]}-${p["day"]}` };
}
/** Local wall time in tz → UTC ms (DST-safe via offset iteration). */
export function zonedToUtc(y: number, m: number, d: number, h: number, mi: number, tz: string): number {
  let guess = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const p = parts(guess, tz);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
    guess += Date.UTC(y, m - 1, d, h, mi) - asUtc;
  }
  return guess;
}
const hm = (s: string) => { const [h, m] = s.split(":").map(Number); return { h: h!, m: m! }; };
export const workdayHours = (cal: BusinessCalendar) => { const a = hm(cal.start), b = hm(cal.end); return (b.h * 60 + b.m - a.h * 60 - a.m) / 60; };

/** Adds business hours starting at startMs. */
export function addBusinessHours(startMs: number, hours: number, cal: BusinessCalendar): number {
  if (!cal.timeZone) throw new Error("explicit IANA time zone required");
  let remaining = hours * 3_600_000;
  const a = hm(cal.start), b = hm(cal.end);
  let p = parts(startMs, cal.timeZone);
  let day = { y: p.y, m: p.m, d: p.d };
  let cursor = startMs;
  for (let guard = 0; guard < 4000; guard++) {
    const dayStart = zonedToUtc(day.y, day.m, day.d, a.h, a.m, cal.timeZone);
    const dayEnd = zonedToUtc(day.y, day.m, day.d, b.h, b.m, cal.timeZone);
    const lp = parts(dayStart, cal.timeZone);
    if (cal.workdays.includes(lp.wd) && !cal.holidays.includes(lp.date)) {
      const from = Math.max(cursor, dayStart);
      if (from < dayEnd) {
        const avail = dayEnd - from;
        if (remaining <= avail) return from + remaining;
        remaining -= avail;
      }
    }
    const next = new Date(Date.UTC(day.y, day.m - 1, day.d + 1));
    day = { y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() };
    cursor = 0;
  }
  throw new Error("business clock overflow");
}

/** Stores both derived deadlines distinctly (48 business hours vs two business days). */
export function deadlines(startMs: number, cal: BusinessCalendar, nextMilestoneMs: number) {
  const h48 = addBusinessHours(startMs, 48, cal);
  const twoDays = addBusinessHours(startMs, 2 * workdayHours(cal), cal);
  return { business_48h_deadline_ms: h48, two_business_days_deadline_ms: twoDays, effective_deadline_ms: Math.min(h48, nextMilestoneMs), workdays_for_48h: 48 / workdayHours(cal) };
}
