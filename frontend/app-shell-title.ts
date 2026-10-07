export const nonHomeTitles = [
  'BOOb lucK',
  'cOOK Bulb',
  'BucKO, lOb!',
  'BucK lObO',
  'O, luBbOcK!',
  'BOb, u lOcK',
  'BlOb cO., uK',
  'Bulb cO., OK',
  'K? cOOl, Bub.',
  'OK, BlOb, c u!',
  'OK, cuB, lOb!',
  'BOb, luc, OK?',
  'BO club, OK?',
  'uK BlOc, bO',
  'c? lOOK, Bub',
  'OK, BOb, clu?',
  'lOcO, Bub, K?',
  'lOu cObB, K?',
] as const;

export function selectShellTitle(page: string): string {
  return page === 'home' ? 'Book Club' : nonHomeTitles[Math.floor(Math.random() * nonHomeTitles.length)];
}
