import { z } from 'zod';
export const configSchema = z.object({
  memberIds: z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/)).length(4).refine(ids => new Set(ids).size === 4,'Four distinct member IDs required'),
  importSource: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).default('legacy-spreadsheet'),
  snapshotCapturedAt: z.iso.datetime().optional(),
}).strict();
export type ImportConfig = z.infer<typeof configSchema>;
