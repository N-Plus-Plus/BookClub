import { refresh } from './refresh.ts';
if (process.argv.length !== 2) { console.error('No source, destination or remote arguments are accepted.'); process.exitCode = 1; }
else try { console.log(JSON.stringify(await refresh({progress:message => console.log(message)}),null,2)); }
catch (error) { console.error(error instanceof Error ? error.message : 'Dev refresh failed.'); process.exitCode = 1; }
