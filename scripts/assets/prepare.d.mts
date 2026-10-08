import type {ImageAsset, ImageRecipe} from './manifest.mjs';
export function prepareAssets(options?: {root?: string; assets?: ImageAsset[]; recipe?: ImageRecipe}): Promise<{
  rows: {output: string; source: string; sourceBytes: number; outputBytes: number; cached: boolean}[];
  sourceBytes: number; outputBytes: number; encoded: number; reused: number;
}>;
