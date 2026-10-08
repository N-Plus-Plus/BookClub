/** Page identity and presentation only; access and feature workflows belong to App. */
export const pageDefinitions = [
  {kind:'home',path:'home',label:'Home',image:'home.png',primary:true},
  {kind:'history',path:'history',label:'History',image:'history.png',primary:true},
  {kind:'builder',path:'builder',label:'Builder',image:'builder.png',primary:true},
  {kind:'classics',path:'classics',label:'Classics',image:'classsics.png',primary:true},
  {kind:'seen',path:'seen',label:'Seen',image:'seen.png',primary:true},
  {kind:'metrics',path:'metrics',label:'Metrics',image:'metrics.png',primary:true},
  {kind:'admin',path:'admin',label:'Admin',image:'admin.png',primary:false},
  {kind:'event',path:'event',label:'Event',image:'event.png',primary:false},
  {kind:'movie',path:'movie',label:'Film detail',image:'filmdetails.png',primary:false},
  {kind:'tmdb-preview',path:'preview/tmdb',label:'Film detail',image:'filmdetails.png',primary:false},
] as const;
export const primaryDestinations = pageDefinitions.filter(page => page.primary);
type Definition = typeof pageDefinitions[number];
type StaticDefinition = Exclude<Definition,{kind:'movie'|'tmdb-preview'|'event'}>;
type Presentation = {path:string;heading:string;image?:string};
export type ResolvedRoute = Presentation & (
  | {kind:StaticDefinition['kind'];dynamic:false}
  | {kind:'event';dynamic:boolean;id?:string}
  | {kind:'movie'|'tmdb-preview';dynamic:true;id:string}
  | {kind:'not-found';dynamic:false}
);
export function resolveRoute(path:string):ResolvedRoute {
  for (const page of pageDefinitions) {
    const presentation={path,heading:page.label,image:page.image};
    if (page.kind === 'movie' || page.kind === 'tmdb-preview' || page.kind === 'event') {
      if (page.kind === 'event' && path === page.path) return {...presentation,kind:'event',dynamic:false};
      const prefix=`${page.path}/`;
      if (path.startsWith(prefix)) {
        const id=path.slice(prefix.length);
        if (id && !id.includes('/')) return {...presentation,kind:page.kind,dynamic:true,id};
      }
    } else if (path === page.path) return {...presentation,kind:page.kind,dynamic:false};
  }
  return {path,kind:'not-found',heading:'Page not found',dynamic:false};
}
