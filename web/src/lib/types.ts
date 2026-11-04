export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled" | "completed" | "no_show";
export type PaymentMode = "pay_at_lesson" | "deposit" | "full";
export type PaymentStatus = "unpaid" | "authorised" | "paid" | "refunded" | "not_required";

export interface Settings {
  business_name: string;
  instructor_name: string | null;
  instructor_bio: string | null;
  instructor_qualifications: string | null;
  teaching_approach: string | null;
  instructor_photo_url: string | null;
  years_experience: number | null;
  phone: string | null;
  email: string | null;
  notification_email: string | null;
  address_line: string | null;
  locality: string | null;
  postcode: string | null;
  service_areas: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  timezone: string;
  currency: string;
  slot_interval_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  max_advance_days: number;
  cancellation_notice_hours: number;
  require_approval: boolean;
  payment_mode: PaymentMode;
  deposit_pence: number;
  updated_at: string;
}

export interface LessonType {
  id: string;
  name: string;
  slug: string;
  description: string;
  duration_minutes: number;
  price_pence: number;
  active: boolean;
  featured: boolean;
  sort_order: number;
}

export interface WeeklyHours { id: string; weekday: number; start_time: string; end_time: string }
export interface ScheduleException { id: string; kind: "block" | "open"; starts_at: Date; ends_at: Date; note: string | null }

export const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Complete beginner" },
  { value: "some", label: "Some experience" },
  { value: "confident", label: "Confident, need polishing" },
  { value: "test_prep", label: "Test preparation" },
  { value: "refresher", label: "Full licence, refresher" },
] as const;

export const experienceLabel = (v: string | null | undefined) =>
  EXPERIENCE_OPTIONS.find((o) => o.value === v)?.label ?? v ?? "—";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  rejected: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show",
};
