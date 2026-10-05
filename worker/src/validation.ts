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
  complete_turn: z.boolean().optional(), turn_version: z.number().int().nonnegative().optional(), correct_anchor: z.boolean().optional(),
  event_date: dateSchema,
  host_member_id: idSchema.nullable().optional(), legacy_cycle_label: z.string().trim().max(300).optional(),
  movie_ids: z.array(idSchema).min(1),
  cycle_id: idSchema.nullable().optional(), new_cycle: cycleSchema.optional(),
  kind: z.enum(['hosted','classics']).optional(), date_precision: z.enum(['exact','cycle_rough','unknown']).optional(),
  cycle_slot: z.number().int().min(1).max(5).nullable().optional(),
}).strict().superRefine((s,ctx) => {
  if (s.cycle_id && s.new_cycle) ctx.addIssue({code: 'custom',path: ['cycle_id'],message: 'Choose an existing or new cycle, not both.'});
  if (s.date_precision === 'cycle_rough' && !s.cycle_id && !s.new_cycle) ctx.addIssue({code: 'custom',path: ['cycle_id'],message: 'An approximate cycle date requires a cycle.'});
  if (s.cycle_slot != null && !s.cycle_id && !s.new_cycle && !s.complete_turn) ctx.addIssue({code: 'custom',path: ['cycle_slot'],message: 'A source slot requires a cycle.'});
});
export const classicSchema = z.object({classic: z.boolean()}).strict();
export const enrichmentSchema = z.object({limit: z.number().int().min(1).max(10).default(10)}).strict();
export const seenSchema = z.object({ seen: z.boolean().nullable() }).strict();
export const importSchema = z.object({ provider: z.literal('tmdb'), externalId: z.string().regex(/^[1-9]\d{0,9}$/) }).strict();
export const avatarSchema = z.object({avatar: z.number().int().min(0).max(19)}).strict();
export const builderSchema = z.object({title: z.string().trim().max(300).optional(),notes: z.string().trim().max(10000).optional(),movie_ids: z.array(idSchema),revision: z.number().int().nonnegative().optional()}).strict();
export const revisionSchema = z.object({revision: z.number().int().nonnegative()}).strict();
export const rotationSchema = z.object({target_member_id: idSchema,version: z.number().int().nonnegative()}).strict();
export const publishSchema = z.object({revision: z.number().int().nonnegative(),event_date: dateSchema,cycle_id: idSchema.nullable(),cycle_slot: z.number().int().min(1).max(5),complete_turn: z.boolean(),turn_version: z.number().int().nonnegative().optional(),new_cycle: cycleSchema.optional()}).strict();
