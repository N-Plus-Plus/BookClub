// Display aliases only: provider identities and cached offers remain untouched.
const providerAliases: Readonly<Record<string,string>> = {
  'apple tv':'Apple', 'apple tv+':'Apple', 'apple tv store':'Apple',
  'amazon prime video':'Prime', 'prime video':'Prime', 'amazon video':'Amazon',
  'google play movies':'Google', 'google tv':'Google',
  'youtube movies':'YouTube', 'youtube':'YouTube', 'fetch tv':'Fetch', 'fetch':'Fetch',
  'binge':'Binge', 'disney+':'Disney', 'disney plus':'Disney', 'netflix':'Netflix', 'stan':'Stan',
  'paramount+':'Paramount', 'paramount plus':'Paramount', 'paramount plus apple tv channel':'Paramount',
  'paramount+ amazon channel':'Paramount', 'paramount plus premium':'Paramount',
  'abc iview':'ABC', 'sbs on demand':'SBS', 'sbs':'SBS',
  '7plus':'7plus', '9now':'9Now', '10play':'10', '10 play':'10',
  'tubi tv':'Tubi', 'tubi':'Tubi', 'plex':'Plex', 'plex player':'Plex',
  'mubi':'MUBI', 'mubi amazon channel':'MUBI', 'shudder':'Shudder', 'shudder amazon channel':'Shudder',
  'kanopy':'Kanopy', 'beamafilm':'Beamafilm', 'docplay':'DocPlay', 'docplay amazon channel':'DocPlay',
  'britbox':'BritBox', 'britbox amazon channel':'BritBox', 'britbox apple tv channel':'BritBox',
  'foxtel now':'Foxtel', 'foxtel go':'Foxtel', 'flicks':'Flicks', 'flicks.com.au':'Flicks',
};
export function availabilityProviderName(name: string): string {
  return providerAliases[name.trim().replace(/\s+/g,' ').toLowerCase()] ?? name;
}
