/** Request-scoped compatibility checks; never cache across database/schema lifetimes. */
export class SchemaCapabilities {
  constructor(private db: D1Database) {}
  private enrichmentCapability?: Promise<boolean>;
  enrichmentSupported() {
    return this.enrichmentCapability ??= this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='movie_provider_enrichment_state'").first().then(Boolean);
  }
  private directorCapability?: Promise<boolean>;
  hasDirector() {
    return this.directorCapability ??= this.db.prepare('PRAGMA table_info(movies)').all<{name:string}>()
      .then(result => result.results.some(column => column.name === 'director'));
  }
}
