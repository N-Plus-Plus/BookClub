const frontendOrigins = new Map([
  ['localhost:10260', 'http://localhost:10260'],
  ['127.0.0.1:10260', 'http://127.0.0.1:10260'],
]);
export function allowedRefreshStatus(host: string | undefined) {
  return host !== undefined && frontendOrigins.has(host);
}
export function allowedRefreshRequest(method: string | undefined, host: string | undefined, origin: string | undefined, confirmation: string | undefined) {
  return method === 'POST' && host !== undefined && frontendOrigins.get(host) === origin && confirmation === 'replace-local-only' && allowedRefreshStatus(host);
}
