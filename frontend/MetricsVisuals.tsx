import type { CSSProperties } from 'react';

export function comparisonWidths(ratio: number) {
  const selected = Number.isFinite(ratio) ? Math.max(0,ratio) : 0;
  const maximum = Math.max(1,selected);
  return {selected:selected/maximum*100,club:100/maximum};
}
export function ComparisonBars({label,value,detail,ratio,colour}: {label:string;value:string;detail:string;ratio:number;colour:string}) {
  const widths = comparisonWidths(ratio);
  return <div className="metrics-distribution-row metrics-enriched-row" style={{'--chart-colour':`var(--${colour})`} as CSSProperties}><div className="metrics-distribution-label"><span>{label}</span><strong>{value}</strong></div><div className="metrics-comparison-bars" aria-hidden="true"><div><small>Selected</small><div className="metrics-distribution-track"><span style={{width:`${widths.selected}%`}} /></div></div><div><small>Club</small><div className="metrics-distribution-track metrics-club-track"><span style={{width:`${widths.club}%`}} /></div></div></div><p className="meta">{detail}</p></div>;
}
export function ratingCircleFills(mean: number) {
  const value = Number.isFinite(mean) ? Math.max(0,Math.min(100,mean)) : 0;
  return Array.from({length:Math.ceil(value/10)},(_,index) => Math.min(1,(value-index*10)/10));
}
export function RatingCircles({mean,colour}: {mean:number;colour:string}) {
  return <div className="metrics-rating-circles" aria-hidden="true" style={{'--chart-colour':`var(--${colour})`} as CSSProperties}>{ratingCircleFills(mean).map((fill,index) => <span className="metrics-rating-circle" key={index}><i style={{width:`${fill*100}%`}} /></span>)}</div>;
}

export function Bar({label,value,detail,width,colour = 'jeans'}: {label:string;value:string;detail:string;width:number;colour?:string}) {
  return <div className="metrics-distribution-row metrics-enriched-row" style={{'--chart-colour':`var(--${colour})`} as CSSProperties}><div className="metrics-distribution-label"><span>{label}</span><strong>{value}</strong></div><div className="metrics-distribution-track" aria-hidden="true"><span style={{width:`${Math.max(0,Math.min(100,width))}%`}} /></div><p className="meta">{detail}</p></div>;
}
export function Coverage({label,covered,total}: {label:string;covered:number;total:number}) {
  return <p className="meta">{total ? `${label} known for ${covered} / ${total} appearances.` : 'No film appearances for this selection.'}</p>;
}
