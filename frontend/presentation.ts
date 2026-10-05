import type { Member, Rotation } from '../shared/types';
import { effectiveMember } from '../shared/rotation';

export function possessiveName(name: string) {
  return `${name}${/s$/i.test(name) ? "'" : "'s"}`;
}

// Historical order is independent of the actual host or current swaps.
export function historicalTurnLabel(position: number | null | undefined) {
  return [...['Sean','Troy','Matt','Jess'].map(name => `${possessiveName(name)} turn`), 'Classics week'][(position ?? 0) - 1] ?? 'Turn not recorded';
}

export function currentTurnLabel(members: Member[], rotation: Rotation) {
  if (rotation.nominal_slot === 5) return 'Classics week';
  const member = effectiveMember(members,rotation);
  return member ? `${possessiveName(member.display_name)} turn` : 'Member unavailable';
}

export function formatScore100(value: number) {
  return value.toFixed(1).replace(/\.0$/, '');
}

export function validationFieldLabel(path: string) {
  const labels: Record<string,string> = {cycle_slot: 'Historical turn', nominal_slot: 'Current turn', cycle_id: 'Cycle', new_cycle: 'New cycle', event_date: 'Event date', movie_ids: 'Film lineup', turn_version: 'Current turn', complete_turn: 'Turn completion', correct_anchor: 'Cycle anchor correction'};
  return labels[path.split('.')[0]] ?? 'Details';
}

export function ratingLabel(provider: string,metric: string) {
  return provider === 'imdb' ? 'IMDb' : provider === 'rottentomatoes' ? (metric === 'audience' ? 'RT audience' : 'RT critic')
    : provider === 'letterboxd' ? 'Letterboxd' : provider === 'metacritic' ? 'Metacritic' : provider === 'tmdb' ? 'TMDB' : provider;
}
