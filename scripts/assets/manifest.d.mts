import type {ResizeOptions, PngOptions} from 'sharp';
export type ImageAsset = {source: string; output: string; size: number};
export type ImageRecipe = {version: number; format: string; resize: ResizeOptions; png: PngOptions};
export const imageAssets: ImageAsset[];
export const imageRecipe: ImageRecipe;
