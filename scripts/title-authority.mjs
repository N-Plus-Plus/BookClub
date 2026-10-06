// Admin API only. No provider URLs or requests. Ctrl+C stops after the in-flight batch.
const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const base=option('--api') || 'http://localhost:8787';
const url=new URL(base);
if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use an API origin without credentials or query parameters.');
const headers={'Content-Type':'application/json',...(process.env.BOOKCLUB_SESSION_TOKEN?{Authorization:`Bearer ${process.env.BOOKCLUB_SESSION_TOKEN}`}:{})};
async function request(path,input) {
  const response=await fetch(new URL(`/api/v1/movies/${path}`,url),{method:input===undefined?'GET':'POST',headers,...(input===undefined?{}:{body:JSON.stringify(input)})});
  if (!response.ok) throw new Error(`Title operation failed (HTTP ${response.status}); no automatic retry.`);
  const body=await response.json();return body.data;
}
console.log(JSON.stringify(await request('title-authority')));
if (args.includes('--reconcile')) {
  let stopped=false,after=option('--after') ?? null;
  process.on('SIGINT',()=>{stopped=true;});
  do {
    const result=await request('reconcile-titles',{after});
    console.log(JSON.stringify(result));after=result.next;
  } while(after && !stopped);
  console.log(JSON.stringify(await request('title-authority')));
}
