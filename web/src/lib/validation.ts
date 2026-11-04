import { z } from "zod";
import { EXPERIENCE_OPTIONS } from "./types";

const phoneRe = /^\+?[0-9 ()-]{7,20}$/;

export const studentDetailsSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name.").max(100, "That name is too long."),
  phone: z
    .string()
    .trim()
    .regex(phoneRe, "Please enter a valid phone number.")
    .refine((v) => v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 15, "Please enter a valid phone number."),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email({ error: "Please enter a valid email address." })),
  experience: z.enum(EXPERIENCE_OPTIONS.map((o) => o.value) as [string, ...string[]], { error: "Please choose your driving experience." }),
  message: z.string().trim().max(1000, "Please keep this under 1000 characters.").optional().default(""),
});

export const createBookingSchema = studentDetailsSchema.extend({
  lessonTypeId: z.uuid({ error: "Please choose a lesson." }),
  startsAt: z.iso.datetime({ offset: true, error: "Please choose a time." }),
  consent: z.literal(true, { error: "Please accept the terms to continue." }),
  website: z.string().max(0).optional(), // honeypot: must stay empty
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
