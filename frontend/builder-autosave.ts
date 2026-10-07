import type { BuilderInput, BuilderSet } from '../shared/types';
export type BuilderDraft = {title:string; notes:string; movie_ids:string[]};
const key = (draft: BuilderDraft) => JSON.stringify(draft);
/** One queue per editor draft: serial revisions, latest requested snapshot, no automatic failure loop. */
export class BuilderAutosave {
  current: BuilderDraft;
  saved: BuilderSet | null;
  private desired: BuilderDraft | null = null;
  private persisted: string | null;
  private active: Promise<BuilderSet> | null = null;
  constructor(saved: BuilderSet | null, private write: (input: BuilderInput,id?:string) => Promise<BuilderSet>, private accepted: (saved: BuilderSet) => void, private failed: (error: unknown) => void) {
    this.saved = saved;
    this.current = {title:saved?.title ?? '',notes:saved?.notes ?? '',movie_ids:[...(saved?.movie_ids ?? [])]};
    this.persisted = saved ? key(this.current) : null;
  }
  enqueue(): Promise<BuilderSet> {
    this.desired = {...this.current,movie_ids:[...this.current.movie_ids]};
    if (this.active) return this.active;
    if (this.saved && key(this.desired) === this.persisted) return Promise.resolve(this.saved);
    // Defer pumping until active has been installed, including synchronous mock failures.
    const request = Promise.resolve().then(async () => {
      while (this.desired && key(this.desired) !== this.persisted) {
        const snapshot = this.desired;
        const saved = await this.write({...snapshot,...(this.saved ? {revision:this.saved.revision} : {})},this.saved?.id);
        this.saved = saved;
        this.persisted = key(snapshot);
        this.accepted(saved);
      }
      return this.saved!;
    }).catch(error => { this.failed(error); throw error; }).finally(() => {this.active = null;});
    this.active = request;
    return request;
  }
  flush() { return this.enqueue(); }
}
