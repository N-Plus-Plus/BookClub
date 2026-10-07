/** BookClub-derived presentation rules. Provider keywords are flat evidence, not a taxonomy. */
const initialisms: Record<string,string> = {hbo:'HBO',bmw:'BMW',cgi:'CGI',cia:'CIA',fbi:'FBI',nasa:'NASA',ptsd:'PTSD',dvd:'DVD',imax:'IMAX',egot:'EGOT'};
const phrases: Record<string,string> = {'hbo-max':'HBO Max','mercedes-benz':'Mercedes-Benz','coca-cola':'Coca-Cola','mcdonald-s':'McDonald’s'};

/** Conservative derived identity; provider evidence and other punctuation remain intact. */
export function themeKeyIdentity(raw: string): string {
  return raw.trim().toLowerCase().replace(/[-\s]+/g,' ');
}

export function themeDisplayLabel(raw: string): string {
  const label = raw.trim();
  if (initialisms[label]) return initialisms[label];
  // Natural provider text keeps its casing and punctuation.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(label)) return label;
  let words = label.split('-').map(token => initialisms[token] ?? token).join(' ');
  for (const [slug,phrase] of Object.entries(phrases)) {
    words = words.replace(new RegExp(`(^| )${slug.replaceAll('-',' ')}(?= |$)`,'gi'),(_,prefix:string) => `${prefix}${phrase}`);
  }
  return words.charAt(0).toUpperCase()+words.slice(1);
}

// Exact labels observed in the offline BookClub corpus. Ambiguous evidence stays included.
const excluded = new Set([
  'has-trailer','2k-blu-ray','dvd','blu-ray','4k-blu-ray','4k-ultra-hd',
  'dolby-vision','dolby-vision-cp','cgi','imax','aspect-ratio','restored-film',
  'netflix-original','hulu-original','amazon-original','disney-plus-original',
  'hbo-max-original','peacock-original','paramount-plus-original',
  'certified-fresh','certified-hot','metacritic-must-see',
  'oscar-nominated','oscar-winner','oscar-best-director-nominee','oscar-best-director-winner',
  'golden-globe-nominated','golden-globe-winner','best-picture-nominated','best-picture-winner',
  'national-film-preservation-board-winner','festival-cannes-winner','festival-venice-winner',
  'festival-toronto-winner','festival-sundance-winner','razzie-winner','worst-picture-razzie-winner',
  'academy-award-nominated','academy-award-winner','emmy-award-nominated','emmy-award-winner',
  'bmw','mercedes-benz','mercedes-benz-the-car','coca-cola','coca-cola-advertisement',
  'coca-cola-machine','apple-computer','mcdonald-s-restaurant','volkswagen','porsche',
  'ferrari','nike','pepsi','rolex',
].map(themeKeyIdentity));

export function isThemeKeyword(raw: string): boolean {
  return !excluded.has(themeKeyIdentity(raw));
}
