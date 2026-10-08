import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** jsdom and source assertions need the same ordered CSS imports as Vite. */
export function applicationCss(path = 'frontend/app.css'): string {
  return readFileSync(path,'utf8').replace(/@import\s+['"]([^'"]+)['"];?/g,
    (_match,relative:string) => applicationCss(resolve(dirname(path),relative)));
}
