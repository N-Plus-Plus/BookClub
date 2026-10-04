import { User } from 'lucide-react';
import { identityPresentation, type ClubIdentity as Identity } from '../shared/identity';
export function ClubIdentity({identity}: {identity: Identity}) {
  const {name,avatar} = identityPresentation(identity,import.meta.env.BASE_URL);
  return <span className="club-identity">{avatar ? <img src={avatar} alt="" className="club-avatar" /> : <User aria-hidden="true" className="club-avatar" />}<span>{name}</span></span>;
}
