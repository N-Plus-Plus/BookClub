import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile, rename, rm, readdir} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import sharp from 'sharp';
import {imageAssets, imageRecipe} from './manifest.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function readOptional(path) {
  try { return await readFile(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function writeAtomic(path, bytes) {
  await mkdir(dirname(path), {recursive: true});
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, bytes); await rename(temporary, path); }
  finally { await rm(temporary, {force: true}); }
}

// Shared by standalone preparation, dev and build. Never steal a live owner's lock.
async function acquireLock(cacheDir) {
  await mkdir(cacheDir, {recursive: true});
  const lock = join(cacheDir, 'prepare.lock');
  const started = Date.now();
  while (true) {
    try {
      await mkdir(lock);
      try { await writeFile(join(lock, 'pid'), String(process.pid)); }
      catch (error) { await rm(lock, {recursive: true, force: true}); throw error; }
      return () => rm(lock, {recursive: true, force: true});
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = await readOptional(join(lock, 'pid'));
      if (owner) {
        try { process.kill(Number(owner.toString()), 0); }
        catch (error) {
          if (error.code === 'ESRCH') throw new Error(`Abandoned asset lock: ${lock}. Stop asset processes, then remove this lock directory and retry.`);
          if (error.code !== 'EPERM') throw error;
        }
      }
      if (Date.now() - started > 60_000) throw new Error(`Asset preparation lock timed out: ${lock}. Stop asset processes before clearing it.`);
      await delay(100);
    }
  }
}

async function filesUnder(directory, prefix = '') {
  let entries;
  try { entries = await readdir(directory, {withFileTypes: true}); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const files = [];
  for (const entry of entries) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await filesUnder(join(directory, entry.name), `${relative}/`));
    else files.push(relative);
  }
  return files;
}

export async function prepareAssets({root = process.cwd(), assets = imageAssets, recipe = imageRecipe} = {}) {
  if (recipe.format !== 'png') throw new Error('The artwork pipeline supports lossless PNG only.');
  const sourceDir = resolve(root, 'assets/source');
  const outputDir = resolve(root, 'generated/public');
  const cacheDir = resolve(root, '.cache/bookclub-artwork');
  const release = await acquireLock(cacheDir);
  try {
    const rows = [];
    const sources = new Map();
    const expected = new Set();
    for (const asset of assets) {
      if (!/^[\w/-]+\.png$/.test(asset.source) || !/^[\w/-]+\.png$/.test(asset.output) || !Number.isInteger(asset.size) || asset.size < 1 || expected.has(asset.output)) throw new Error('Invalid or duplicate image manifest path or dimension.');
      expected.add(asset.output);
      const source = sources.get(asset.source) ?? await readFile(join(sourceDir, asset.source));
      sources.set(asset.source, source);
      const key = hash(JSON.stringify({source: hash(source), width: asset.size, height: asset.size, recipe, encoder: sharp.versions}));
      const cachedPath = join(cacheDir, `${key}.png`);
      const receiptPath = join(cacheDir, `${key}.sha256`);
      let bytes = await readOptional(cachedPath);
      const receipt = await readOptional(receiptPath);
      const cached = Boolean(bytes && receipt && hash(bytes) === receipt.toString());
      if (!cached) {
        bytes = await sharp(source).resize(asset.size, asset.size, recipe.resize).png(recipe.png).toBuffer();
        await writeAtomic(cachedPath, bytes);
        await writeAtomic(receiptPath, hash(bytes));
      }
      const output = join(outputDir, asset.output);
      const existing = await readOptional(output);
      if (!existing || !existing.equals(bytes)) await writeAtomic(output, bytes);
      rows.push({output: asset.output, source: asset.source, sourceBytes: source.length, outputBytes: bytes.length, cached});
    }
    // Small hand-maintained public assets (currently the TMDB attribution SVG).
    for (const relative of await filesUnder(resolve(root, 'public'))) {
      if (expected.has(relative) || /\.(png|jpe?g|webp)$/i.test(relative)) throw new Error(`Raster artwork must be declared in the source manifest: public/${relative}`);
      expected.add(relative);
      const bytes = await readFile(resolve(root, 'public', relative));
      const output = join(outputDir, relative);
      const existing = await readOptional(output);
      if (!existing || !existing.equals(bytes)) await writeAtomic(output, bytes);
    }
    // This directory is generator-owned; stale recipes/removed filenames must not ship.
    for (const relative of await filesUnder(outputDir)) {
      if (!expected.has(relative)) await rm(join(outputDir, relative));
    }
    const sourceBytes = [...sources.values()].reduce((sum, bytes) => sum + bytes.length, 0);
    const outputBytes = rows.reduce((sum, row) => sum + row.outputBytes, 0);
    return {rows, sourceBytes, outputBytes, encoded: rows.filter(row => !row.cached).length, reused: rows.filter(row => row.cached).length};
  } finally { await release(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = await prepareAssets();
    if (process.argv.includes('--report')) for (const row of report.rows) console.log(`${row.output}: ${row.sourceBytes} -> ${row.outputBytes} bytes (${row.cached ? 'cache' : 'encoded'})`);
    console.log(`Artwork: ${report.encoded} encoded, ${report.reused} cache hits; ${report.sourceBytes.toLocaleString('en-US')} -> ${report.outputBytes.toLocaleString('en-US')} bytes (${(100 * (1 - report.outputBytes / report.sourceBytes)).toFixed(2)}% smaller).`);
  } catch (error) { console.error(error); process.exitCode = 1; }
}
