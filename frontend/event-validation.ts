const fieldLabels: Record<string,string> = {
  event_date: 'Event date', title: 'Title', notes: 'Notes', kind: 'Event kind',
  date_precision: 'Date precision', host_member_id: 'Actual host', movie_ids: 'Film lineup',
  cycle_id: 'Cycle', cycle_slot: 'Nominal slot', swap_note: 'Swap explanation',
  correct_anchor: 'Cycle anchor correction',
};

// Mounted controls, including those in closed disclosures, own inline errors.
// Retained values without controls and future API paths must stay visible too.
export function routeEventValidation(issues: {path: string; message: string}[], rendered: ReadonlySet<string>) {
  const fields: Record<string,string> = {};
  const fallback: string[] = [];
  for (const issue of issues) {
    const root = issue.path.split('.')[0];
    const name = root === 'new_cycle' ? 'cycle_id' : root;
    if (!Object.hasOwn(fieldLabels,name)) {
      fallback.push('Some event details could not be validated.');
    } else if (rendered.has(name)) {
      fields[name] = [fields[name],issue.message].filter(Boolean).join(' ');
    } else {
      fallback.push(`${fieldLabels[name]}: ${issue.message}`);
    }
  }
  return {fields,formMessage: fallback.length
    ? `Could not save the event. ${[...new Set(fallback)].join(' ')} Review the event details and try again; if it still fails, contact a club administrator.`
    : ''};
}
