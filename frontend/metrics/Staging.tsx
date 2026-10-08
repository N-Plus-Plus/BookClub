import { CoreReports } from './staging/Core';
import { OverlapReports } from './staging/Overlap';
import { PeopleReports, ReceptionReports, DiscoveryReports, type EvidenceProps } from './staging/Evidence';
export default function Staging(props:EvidenceProps) {
  return <div className="stack metrics-staging"><CoreReports {...props}/><OverlapReports {...props}/><PeopleReports {...props}/><ReceptionReports {...props}/><DiscoveryReports {...props}/></div>;
}
