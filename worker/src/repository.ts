import { ProviderEvidenceRepository } from './provider-evidence-repository';
import type { CollectionEvidence, AwardsEvidence } from '../../shared/provider-evidence';
import type { Catalog, CompactCatalog, Cycle, ExternalId, Member, Movie, Score, Session, SessionInput, ManualMovieInput, SavedSearchResult } from '../../shared/types';
import type { MetadataMovie } from '../../shared/metadata';
import type { EnrichmentCapture } from '../../shared/enrichment';
import type { ProviderMovie } from './providers/types';
import { ProductRepository } from './product-repository';
import { SchemaCapabilities } from './schema-capabilities';
import { CatalogRepository } from './catalog-repository';
import { MovieRepository } from './movie-repository';
import { MaintenanceRepository } from './maintenance-repository';

/** Compatibility surface for services and local tooling; domain repositories own all SQL. */
export class Repository {
  private capabilities: SchemaCapabilities;
  private catalogRepository: CatalogRepository;
  private movieRepository: MovieRepository;
  private maintenanceRepository: MaintenanceRepository;
  constructor(private db: D1Database) {
    this.capabilities = new SchemaCapabilities(db);
    this.catalogRepository = new CatalogRepository(db,this.capabilities);
    this.movieRepository = new MovieRepository(db,this.capabilities);
    this.maintenanceRepository = new MaintenanceRepository(db,this.capabilities,this.catalogRepository);
  }
  providerEvidenceSupported() { return new ProviderEvidenceRepository(this.db).supported(); }
  async cacheCollection(id:string,evidence:CollectionEvidence | undefined) { return new ProviderEvidenceRepository(this.db).save(id,'collections',evidence); }
  async cacheAwards(id:string,evidence:AwardsEvidence | undefined) { return new ProviderEvidenceRepository(this.db).save(id,'awards',evidence); }
  enrichmentSupported() { return this.capabilities.enrichmentSupported(); }
  async searchMovies(query: string, tmdbIds: string[] = []): Promise<SavedSearchResult[]> { return this.catalogRepository.searchMovies(query,tmdbIds); }
  async catalog(): Promise<Catalog> { return this.catalogRepository.catalog(); }
  async compactCatalog(): Promise<CompactCatalog> { return this.catalogRepository.compactCatalog(); }
  async members(): Promise<Member[]> { return this.catalogRepository.members(); }
  async cycles(): Promise<Cycle[]> { return this.catalogRepository.cycles(); }
  async movies(classicsOnly = false): Promise<Movie[]> { return this.catalogRepository.movies(classicsOnly); }
  async sessions(id?:string): Promise<Session[]> { return this.catalogRepository.sessions(id); }
  async session(id:string): Promise<Session> { return this.catalogRepository.session(id); }
  async movieDetails(ids: string[], validateScope = false): Promise<import('../../shared/types').MovieDetail[]> { return this.catalogRepository.movieDetails(ids,validateScope); }
  async cacheEnrichment(id: string, capture: EnrichmentCapture) { return this.movieRepository.cacheEnrichment(id,capture); }
  async cacheProviderTitle(id: string, provider: string, title: unknown, identity: ExternalId, at: string) { return this.movieRepository.cacheProviderTitle(id,provider,title,identity,at); }
  async assertMovie(id: string) { return this.movieRepository.assertMovie(id); }
  async manualMovie(input: ManualMovieInput): Promise<string> { return this.movieRepository.manualMovie(input); }
  async setSeen(movieId: string, memberId: string, seen: boolean | null) { return this.movieRepository.setSeen(movieId,memberId,seen); }
  async findExternal(provider: string, externalId: string): Promise<string | null> { return this.movieRepository.findExternal(provider,externalId); }
  async setClassic(id: string, classic: boolean) { return this.movieRepository.setClassic(id,classic); }
  async removeClassic(id: string) { return this.movieRepository.removeClassic(id); }
  async appendScores(id: string, scores: Score[], identity?:ExternalId,checkedProvider?:import('../../shared/maintenance-plan').MaintenanceProvider,checkedKeys?:readonly string[]) { return this.movieRepository.appendScores(id,scores,identity,checkedProvider,checkedKeys); }
  async importMovie(m: ProviderMovie): Promise<string> { return this.movieRepository.importMovie(m); }
  async enrichOmdbMetadata(id: string, imdbId: string, metadata: Omit<import('./providers/omdb').OmdbMetadata,'title'> & {title?: string | null}, populate = false) { return this.movieRepository.enrichOmdbMetadata(id,imdbId,metadata,populate); }
  async enrichMetadata(id: string, tmdbId: string, m: ProviderMovie, attachment?: {import_source: string; source_refs: string[]}, captureScores = false, intent?: 'populate' | 'refresh') { return this.movieRepository.enrichMetadata(id,tmdbId,m,attachment,captureScores,intent); }
  metadataStatements(id: string, m: ProviderMovie, captureScores = false,director = true,titleAuthority = true): D1PreparedStatement[] { return this.movieRepository.metadataStatements(id,m,captureScores,director,titleAuthority); }
  async maintenanceDetails(ids: string[], validateScope = false) { return this.maintenanceRepository.maintenanceDetails(ids,validateScope); }
  async scoreChecks(ids: string[]) { return this.maintenanceRepository.scoreChecks(ids); }
  async saveScoreChecks(id: string, checks: {key:string;available:boolean}[]) { return this.maintenanceRepository.saveScoreChecks(id,checks); }
  async scoreMaintenanceStatus(): Promise<import('../../shared/types').ScoreMaintenanceStatus> { return this.maintenanceRepository.scoreMaintenanceStatus(); }
  async selectedMetadataMovies(ids: string[]): Promise<MetadataMovie[]> { return this.maintenanceRepository.selectedMetadataMovies(ids); }
  async metadataCandidates(limit: number): Promise<MetadataMovie[]> { return this.maintenanceRepository.metadataCandidates(limit); }
  async metadataCounts(): Promise<{remaining: number; unidentified: number}> { return this.maintenanceRepository.metadataCounts(); }
  async enrichmentCandidates(limit:number) { return this.maintenanceRepository.enrichmentCandidates(limit); }
  async providerCooldown(provider: string, readOnly = false): Promise<number | null> { return this.maintenanceRepository.providerCooldown(provider,readOnly); }
  async setProviderCooldown(provider: string, seconds: number) { return this.maintenanceRepository.setProviderCooldown(provider,seconds); }
  async saveSession(input: SessionInput, existingId?: string) {
    return new ProductRepository(this.db).saveSession(input,null,existingId);
  }
}
