import "server-only";
import { cache } from "react";
import { queryOne, query } from "./db";
import type { LessonType, Settings } from "@/lib/types";

export const getSettings = cache(async (): Promise<Settings> => {
  const s = await queryOne<Settings>("select * from settings where id = 1");
  if (!s) throw new Error("Settings row missing. Run npm run db:migrate.");
  return s;
});

export const getActiveLessonTypes = cache(async () =>
  query<LessonType>("select * from lesson_types where active order by sort_order, price_pence, name"),
);

export async function getLessonType(id: string) {
  return queryOne<LessonType>("select * from lesson_types where id = $1", [id]);
}
