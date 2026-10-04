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
export const cycleSchema = z.object({ rough_date: dateSchema, title: z.string().trim().max(300).optional(), ordinal: z.number().int().positive().optional() }).strict();
export const sessionSchema = z.object({
  event_date: dateSchema, title: z.string().trim().max(300).optional(),
  host_member_id: idSchema.nullable().optional(), legacy_cycle_label: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(10000).optional(), movie_ids: z.array(idSchema).min(1),
  cycle_id: idSchema.nullable().optional(), new_cycle: cycleSchema.optional(),
  kind: z.enum(['hosted','classics']).optional(), date_precision: z.enum(['exact','cycle_rough','unknown']).optional(),
  cycle_slot: z.number().int().min(1).max(5).nullable().optional(),
}).strict().superRefine((s,ctx) => {
  if (s.cycle_id && s.new_cycle) ctx.addIssue({code: 'custom',path: ['cycle_id'],message: 'Choose an existing or new cycle, not both.'});
  if (s.kind === 'classics' && s.host_member_id) ctx.addIssue({code: 'custom',path: ['host_member_id'],message: 'Classics events have no host.'});
  if (s.kind === 'hosted' && !s.host_member_id) ctx.addIssue({code: 'custom',path: ['host_member_id'],message: 'Choose a host for a hosted event.'});
  if (s.date_precision === 'cycle_rough' && !s.cycle_id && !s.new_cycle) ctx.addIssue({code: 'custom',path: ['cycle_id'],message: 'An approximate cycle date requires a cycle.'});
  if (s.cycle_slot != null && !s.cycle_id && !s.new_cycle) ctx.addIssue({code: 'custom',path: ['cycle_slot'],message: 'A source slot requires a cycle.'});
  if (s.cycle_slot != null && ((s.kind === 'classics' && s.cycle_slot !== 5) || (s.kind !== 'classics' && s.cycle_slot === 5))) ctx.addIssue({code: 'custom',path: ['cycle_slot'],message: 'Slot 5 is for Classics; slots 1–4 are hosted.'});
});
export const classicSchema = z.object({classic: z.boolean()}).strict();
export const enrichmentSchema = z.object({limit: z.number().int().min(1).max(10).default(10)}).strict();
export const seenSchema = z.object({ seen: z.boolean().nullable() }).strict();
export const importSchema = z.object({ provider: z.literal('tmdb'), externalId: z.string().regex(/^[1-9]\d{0,9}$/) }).strict();
