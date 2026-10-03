import { z } from 'zod';

export const idSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10) === value;
}, 'Use a valid calendar date');
export const movieSchema = z.object({
  title: z.string().trim().min(1).max(300), year: z.number().int().min(1870).max(2200).optional(),
  runtime: z.number().int().positive().max(10000).optional(),
}).strict();
export const sessionSchema = z.object({
  event_date: dateSchema, title: z.string().trim().max(300).optional(),
  host_member_id: idSchema.nullable().optional(), legacy_cycle_label: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(10000).optional(), movie_ids: z.array(idSchema).min(1),
}).strict();
export const seenSchema = z.object({ seen: z.boolean().nullable() }).strict();
export const importSchema = z.object({ provider: z.literal('tmdb'), externalId: z.string().regex(/^[1-9]\d{0,9}$/) }).strict();
