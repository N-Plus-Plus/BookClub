/** Finite TMDB movie vocabulary; presentation aliases never create new genres. */
export const movieGenres = ['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama','Family','Fantasy','History','Horror','Music','Mystery','Romance','Science Fiction','TV Movie','Thriller','War','Western'] as const;
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g,'');
const vocabulary = new Map<string,string>(movieGenres.map(g => [key(g),g === 'Science Fiction' ? 'Sci-Fi' : g]));
vocabulary.set('scifi','Sci-Fi');
export function normalizeGenre(value: string): string | null { return vocabulary.get(key(value)) ?? null; }
export function normalizedGenres(values: string[]): string[] {
  return [...new Set(values.map(normalizeGenre).filter((g): g is string => g !== null))].sort();
}
