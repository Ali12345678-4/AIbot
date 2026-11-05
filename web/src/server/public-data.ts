import "server-only";
import { query } from "./db";
import { getSettings, getActiveLessonTypes } from "./settings";

export interface Review { id: string; author_name: string; body: string; rating: number | null; source: string | null }

export async function getHomeData() {
  const [settings, lessons, reviews] = await Promise.all([
    getSettings(),
    getActiveLessonTypes(),
    query<Review>("select id, author_name, body, rating, source from reviews where published order by sort_order, created_at desc limit 12"),
  ]);
  return { settings, lessons, reviews };
}

import { loadAvailabilityInput } from "./schedule";
import { addDaysYmd, slotsForDate, todayInTz } from "@/lib/availability";
import { fmtTz } from "@/lib/format";
import type { LessonType, Settings } from "@/lib/types";

export interface BoardRow { date: string; day: string; time: string; lesson: string; slug: string; duration: number; startsAt: string }

/** Real upcoming free slots (earliest per day) for the shortest active lesson. */
export async function getNextSlots(s: Settings, lessons: LessonType[], max = 6, horizon = 21): Promise<BoardRow[]> {
  const lesson = [...lessons].sort((a, b) => a.duration_minutes - b.duration_minutes)[0];
  if (!lesson) return [];
  const from = todayInTz(s.timezone);
  const to = addDaysYmd(from, Math.min(horizon, s.max_advance_days));
  const input = await loadAvailabilityInput(s, from, to, lesson.duration_minutes);
  const rows: BoardRow[] = [];
  for (let d = from; d <= to && rows.length < max; d = addDaysYmd(d, 1)) {
    const [first] = slotsForDate(d, input);
    if (first === undefined) continue;
    const at = new Date(first);
    rows.push({
      date: d,
      day: fmtTz(at, "EEE dd MMM", s.timezone).toUpperCase(),
      time: fmtTz(at, "HH:mm", s.timezone),
      lesson: lesson.name,
      slug: lesson.slug,
      duration: lesson.duration_minutes,
      startsAt: at.toISOString(),
    });
  }
  return rows;
}
