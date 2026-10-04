import type { Member, Viewer } from './types';
export type ClubIdentity = { kind: 'member'; member: Pick<Member,'id'|'display_name'|'avatar'> } | { kind: 'classics' };
export function identityPresentation(identity: ClubIdentity, base: string) {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return identity.kind === 'classics' ? {name: 'CLSC', avatar: `${prefix}avatars/a.png`}
    : {name: identity.member.display_name.toUpperCase(), avatar: identity.member.avatar == null ? null : `${prefix}avatars/${identity.member.avatar}.png`};
}
export const needsAvatar = (viewer: Viewer | null) => viewer !== null && viewer.avatar == null;
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
