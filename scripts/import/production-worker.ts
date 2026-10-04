import { Buffer } from 'node:buffer';
import { guard, sha256, validateBootstrap, checkMigrations, productionPreflight, importProduction, bootstrapRotation, verifyProduction, type Gates, type Target, type BackupProof } from './production.ts';

export interface CutoverEnv {
  DB:D1Database; CUTOVER_TOKEN:string; APP_ENV:string; LOCAL_WRITE_BYPASS:string;
  DATABASE_NAME:string; DATABASE_ID:string; PLAN_HASH:string; BOOTSTRAP_HASH:string;
  BACKUP_PROOF_HASH:string; REHEARSAL_HASH:string; MIGRATIONS:string;
}
// Separate, temporary administrative runner. Never added to the application API.
// Its reviewed private config pins the binding, archive, roster and backup proof.
export default {
  async fetch(request:Request,env:CutoverEnv):Promise<Response> {
    const fail=()=>Response.json({error:'Cutover refused. Check private gates and preflight.'},{status:409});
    if(request.method!=='POST'||new URL(request.url).pathname!=='/cutover'||!env.CUTOVER_TOKEN||request.headers.get('Authorization')!==`Bearer ${env.CUTOVER_TOKEN}`)return new Response(null,{status:403});
    try {
      if(env.APP_ENV!=='production'||env.LOCAL_WRITE_BYPASS!=='false'||env.DATABASE_NAME!=='bookclub-prod')return fail();
      const body=await request.json() as {planBytes:string;config:unknown;bootstrap:unknown;backup:BackupProof;rehearsal:unknown;gates:Gates};
      const target:Target={database_name:env.DATABASE_NAME,database_id:env.DATABASE_ID};
      const plan=guard(body.gates,target,Buffer.from(body.planBytes),body.config);
      if(body.gates.planHash!==env.PLAN_HASH||sha256(JSON.stringify(body.bootstrap))!==env.BOOTSTRAP_HASH||sha256(JSON.stringify(body.backup))!==env.BACKUP_PROOF_HASH||sha256(JSON.stringify(body.rehearsal))!==env.REHEARSAL_HASH)return fail();
      const b=validateBootstrap(body.bootstrap),migrations=JSON.parse(env.MIGRATIONS) as string[];
      if(body.backup.remote!==true||body.backup.planHash!==env.PLAN_HASH||body.backup.database_id!==env.DATABASE_ID||body.backup.database_name!==env.DATABASE_NAME||!body.backup.bytes||!body.backup.exportHash)return fail();
      await checkMigrations(env.DB,migrations);
      await productionPreflight(env.DB,plan,b);
      // All mutations use native Worker D1 batches with the documented rollback
      // guarantee, never an inferred REST batch transaction contract.
      await importProduction(env.DB,plan,b);
      await bootstrapRotation(env.DB,b,plan,true);
      return Response.json(await verifyProduction(env.DB,plan,b,migrations));
    }catch{return fail();}
  },
};
