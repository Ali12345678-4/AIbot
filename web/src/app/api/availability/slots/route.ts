import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSettings, getLessonType } from "@/server/settings";
import { expireUnpaidHolds, loadAvailabilityInput } from "@/server/schedule";
import { slotsForDate } from "@/lib/availability";
import { ymdSchema } from "@/lib/validation";
import { fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const q = z.object({ lesson: z.uuid(), date: ymdSchema });

export async function GET(req: NextRequest) {
  const parsed = q.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const settings = await getSettings();
  const lesson = await getLessonType(parsed.data.lesson);
  if (!lesson?.active) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  await expireUnpaidHolds();
  const input = await loadAvailabilityInput(settings, parsed.data.date, parsed.data.date, lesson.duration_minutes);
  const slots = slotsForDate(parsed.data.date, input).map((ms) => ({
    startsAt: new Date(ms).toISOString(),
    label: fmtTime(new Date(ms), settings.timezone),
    endLabel: fmtTime(new Date(ms + lesson.duration_minutes * 60_000), settings.timezone),
  }));
  return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
}
