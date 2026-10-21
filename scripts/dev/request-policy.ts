export function allowedRefreshRequest(method: string | undefined, host: string | undefined, origin: string | undefined, confirmation: string | undefined) {
  return method === 'POST' && host === 'localhost:10080' && origin === 'http://localhost:10080' && confirmation === 'replace-local-only';
}
