import type { Env } from '../http';
import type { Repository } from '../repository';
import { ProviderError } from './http';
import { OmdbProvider } from './omdb';

// One instance per operation: rejected credentials are never retried for later films.
export class OmdbCredentials {
  private unavailable = new Map<string,ProviderError>();
  constructor(private repo: Repository, private env: Env, private limits: (identity: string) => (headers: Headers) => Promise<void>) {}
  get configured() { return Boolean(this.env.OMDB_API_KEY || this.env.OMDB_API_KEY_SECONDARY); }
  async details(id: string) {
    const failures: ProviderError[] = [];
    for (const [identity,key] of [['omdb',this.env.OMDB_API_KEY],['omdb-secondary',this.env.OMDB_API_KEY_SECONDARY]] as const) {
      if (!key) continue;
      let error = this.unavailable.get(identity);
      if (!error) {
        const wait = await this.repo.providerCooldown(identity);
        if (wait !== null) error = new ProviderError('OMDb','rate_limited','omdb is cooling down after a rate limit. Try later.',wait);
        else try { return await new OmdbProvider(key,this.limits(identity)).details(id); }
        catch (caught) {
          if (!(caught instanceof ProviderError) || !['credentials','rate_limited'].includes(caught.kind)) throw caught;
          error = caught;
          if (error.kind === 'rate_limited') await this.repo.setProviderCooldown(identity,error.retryAfter ?? 60);
        }
        this.unavailable.set(identity,error);
      }
      failures.push(error);
    }
    // At least one configured credential is required by the caller. The first
    // expiring quota is the earliest available capacity, even if another key is invalid.
    if (failures.length === 1) throw failures[0];
    const waits = failures.flatMap(error => error.kind === 'rate_limited' ? [error.retryAfter ?? 60] : []);
    const error = failures.at(-1)!;
    if (waits.length) throw new ProviderError('OMDb','rate_limited',failures.find(e => e.kind === 'rate_limited')!.message,Math.min(...waits));
    throw error;
  }
}
