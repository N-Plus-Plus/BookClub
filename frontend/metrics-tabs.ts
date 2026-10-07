export const metricsTabs = [
  {id:'top-bottom',label:'Top / Bottom',metrics:['E','U','V','W']},
  {id:'fingerprints',label:'Fingerprints',metrics:['C','F','G','J']},
  {id:'general',label:'General Interest',metrics:['B','D','K','Y']},
  {id:'averages',label:'Averages',metrics:['M','N','T']},
  {id:'diversity',label:'Taste Diversity',metrics:['O','P','Q','R','S']},
  {id:'standalone',label:'Economics / Standalone',metrics:['L','H','I']},
  {id:'extremes',label:'Extremes',metrics:['X']},
] as const;
export type MetricsTab = typeof metricsTabs[number]['id'];
