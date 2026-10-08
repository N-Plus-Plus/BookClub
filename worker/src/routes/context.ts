import type { Env } from '../http';
import type { authenticate } from '../auth';
import type { Repository } from '../repository';
import type { MovieService } from '../services';
import type { ProductRepository } from '../product-repository';

/** Unhandled families return undefined; validation/domain errors propagate to index.ts. */
export interface RouteContext {
  request: Request; env: Env; url: URL; path: string; method: string;
  repo: Repository; movies: MovieService; product: ProductRepository;
  auth: Awaited<ReturnType<typeof authenticate>>;
  body: (request: Request) => Promise<unknown>;
}
