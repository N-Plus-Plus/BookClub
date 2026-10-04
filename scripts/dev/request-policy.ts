export function allowedRefreshRequest(method: string | undefined, host: string | undefined, origin: string | undefined, confirmation: string | undefined) {
  return method === 'POST' && host === 'localhost:4173' && origin === 'http://localhost:4173' && confirmation === 'replace-local-only';
}
