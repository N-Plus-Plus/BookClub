import {mkdtemp, mkdir, writeFile, readFile, rm, readdir, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {expect, it} from 'vitest';
import {prepareAssets} from '../scripts/assets/prepare.mjs';
import {imageAssets, imageRecipe} from '../scripts/assets/manifest.mjs';
import {pageDefinitions} from '../frontend/routes';
import {identityPresentation} from '../shared/identity';

it('generates, reuses, invalidates and repairs persistent derivatives without enlarging or dropping alpha', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bookclub-assets-'));
  const assets = [{source: 'one.png', output: 'one.png', size: 24}, {source: 'two.png', output: 'two.png', size: 320}];
  const source = (colour: string) => sharp({create: {width: 48, height: 32, channels: 4, background: colour}}).png().toBuffer();
  try {
    await mkdir(join(root, 'assets/source'), {recursive: true});
    await writeFile(join(root, 'assets/source/one.png'), await source('#ff000080'));
    await writeFile(join(root, 'assets/source/two.png'), await source('#00ff0080'));
    const clean = await prepareAssets({root, assets});
    expect(clean).toMatchObject({encoded: 2, reused: 0});
    const first = await readFile(join(root, 'generated/public/one.png'));
    const metadata = await sharp(first).metadata();
    expect(metadata).toMatchObject({width: 24, height: 16, format: 'png', hasAlpha: true});
    expect(await sharp(join(root, 'generated/public/two.png')).metadata()).toMatchObject({width: 48, height: 32});
    const cache = join(root, '.cache/bookclub-artwork');
    const cachedTimes = await Promise.all((await readdir(cache)).map(async file => [file, (await stat(join(cache, file))).mtimeMs]));
    await rm(join(root, 'generated'), {recursive: true});
    expect(await prepareAssets({root, assets})).toMatchObject({encoded: 0, reused: 2});
    expect(await readFile(join(root, 'generated/public/one.png'))).toEqual(first);
    expect(await Promise.all((await readdir(cache)).map(async file => [file, (await stat(join(cache, file))).mtimeMs]))).toEqual(cachedTimes);

    await writeFile(join(root, 'assets/source/one.png'), await source('#0000ff80'));
    expect(await prepareAssets({root, assets})).toMatchObject({encoded: 1, reused: 1});
    expect(await readFile(join(root, 'generated/public/one.png'))).not.toEqual(first);
    const resized = [{...assets[0], size: 16}, assets[1]];
    expect(await prepareAssets({root, assets: resized})).toMatchObject({encoded: 1, reused: 1});
    expect(await sharp(join(root, 'generated/public/one.png')).metadata()).toMatchObject({width: 16});
    const recipe = {...imageRecipe, version: imageRecipe.version + 1};
    expect(await prepareAssets({root, assets: resized, recipe})).toMatchObject({encoded: 2, reused: 0});
    expect(await prepareAssets({root, assets: resized, recipe})).toMatchObject({encoded: 0, reused: 2});
    for (const file of (await readdir(cache)).filter(file => file.endsWith('.png'))) await writeFile(join(cache, file), 'corrupt');
    expect(await prepareAssets({root, assets: resized, recipe})).toMatchObject({encoded: 2, reused: 0});
    await writeFile(join(root, 'generated/public/obsolete.png'), first);
    expect(await prepareAssets({root, assets: resized.slice(0, 1), recipe})).toMatchObject({encoded: 0, reused: 1});
    expect(await readdir(join(root, 'generated/public'))).toEqual(['one.png']);
    // Separate callers serialize; the second caller reuses the first caller's encoding.
    await rm(cache, {recursive: true});
    const concurrent = await Promise.all([prepareAssets({root, assets}), prepareAssets({root, assets})]);
    expect(concurrent.map(result => result.encoded).sort()).toEqual([0, 2]);
  } finally { await rm(root, {recursive: true, force: true}); }
});

it('covers all runtime paths, dynamic avatar choices and every retained canonical source', async () => {
  const outputPaths = new Set(imageAssets.map(asset => asset.output));
  for (const {image} of pageDefinitions) expect(outputPaths.has(`buttons/${image}`)).toBe(true);
  const shell = await readFile('frontend/AppShell.tsx', 'utf8');
  expect(shell).toContain('newFav/fav1.png');
  expect(outputPaths.has('newFav/fav1.png')).toBe(true);
  expect(await readFile('frontend/main.tsx', 'utf8')).toContain('BASE_URL}favicon.png');
  expect(outputPaths.has('favicon.png')).toBe(true);
  for (let id = 0; id < 20; id++) {
    const path = identityPresentation({kind: 'member', member: {id: 'test', display_name: 'Test', avatar: id}}, '/').avatar!;
    expect(outputPaths.has(path.slice(1))).toBe(true);
  }
  expect(outputPaths.has(identityPresentation({kind: 'classics'}, '/').avatar!.slice(1))).toBe(true);
  expect(await readFile('frontend/AvatarScreen.tsx', 'utf8')).toContain('avatars/${id}.png');
  const sources = new Set(imageAssets.map(asset => asset.source));
  const actualSources = [];
  for (const directory of await readdir('assets/source')) for (const file of await readdir(`assets/source/${directory}`)) actualSources.push(`${directory}/${file}`);
  expect(actualSources.sort()).toEqual([...sources].sort());
  expect(await readdir('public', {recursive: true})).not.toEqual(expect.arrayContaining([expect.stringMatching(/\.png$/)]));
  // All current Action callers use Lucide; no hidden string/variable button collections.
  for (const file of (await readdir('frontend')).filter(file => file.endsWith('.tsx'))) {
    const text = await readFile(`frontend/${file}`, 'utf8');
    expect(text).not.toMatch(/icon=["'][^"']+\.png/);
    const lucide = new Set([...text.matchAll(/import \{([^}]+)\} from 'lucide-react'/g)].flatMap(match => match[1].split(',').map(name => name.trim())));
    for (const match of text.matchAll(/icon=\{([^}]+)\}/g)) {
      const choices = match[1].includes('?') ? match[1].split('?')[1].split(':').map(name => name.trim()) : [match[1]];
      for (const choice of choices) expect(lucide.has(choice), `${file}: ${choice} must resolve to an imported Lucide icon`).toBe(true);
    }
    expect(text).not.toMatch(/(?:closedrawer|dq|next|prev|ranked|resort|unranked|fav0)\.png|favicons\//);
  }
});
