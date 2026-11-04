import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSettings, getLessonType } from "@/server/settings";
import { expireUnpaidHolds, loadAvailabilityInput } from "@/server/schedule";
import { availableDates, addDaysYmd, todayInTz } from "@/lib/availability";
import { ymdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const q = z.object({ lesson: z.uuid(), from: ymdSchema, to: ymdSchema });

export async function GET(req: NextRequest) {
  const parsed = q.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const settings = await getSettings();
  const lesson = await getLessonType(parsed.data.lesson);
  if (!lesson?.active) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  const today = todayInTz(settings.timezone);
  const last = addDaysYmd(today, settings.max_advance_days);
  const from = parsed.data.from < today ? today : parsed.data.from;
  const to = parsed.data.to > last ? last : parsed.data.to;
  if (from > to) return NextResponse.json({ dates: [], today, lastDate: last });
  if (addDaysYmd(from, 62) < to) return NextResponse.json({ error: "Range too large." }, { status: 400 });
  await expireUnpaidHolds();
  const input = await loadAvailabilityInput(settings, from, to, lesson.duration_minutes);
  return NextResponse.json({ dates: availableDates(from, to, input), today, lastDate: last }, { headers: { "Cache-Control": "no-store" } });
}
