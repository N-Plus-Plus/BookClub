/** Resize only recognisable TMDB CDN image URLs; leave other references intact. */
export function posterReference(reference: string, large = false): string {
  try {
    const url = new URL(reference);
    if (url.protocol !== 'https:' || url.hostname !== 'image.tmdb.org' || url.port || url.username || url.password
      || !/^\/t\/p\/(?:w\d+|original)\/[^/]+$/.test(url.pathname)) return reference;
    url.pathname = url.pathname.replace(/^\/t\/p\/[^/]+\//, `/t/p/${large ? 'w342' : 'w185'}/`);
    return url.href;
  } catch { return reference; }
}
