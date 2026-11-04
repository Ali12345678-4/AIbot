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
