import { describe, expect, it } from 'vitest';
import { routeEventValidation } from '../frontend/event-validation';

describe('Event validation routing', () => {
  it('routes API errors beside mounted fields, including nested lineup paths', () => {
    expect(routeEventValidation([
      {path:'event_date',message:'Choose a valid date.'},
      {path:'movie_ids.2',message:'Choose a saved film.'},
    ],new Set(['event_date','movie_ids']))).toEqual({
      fields:{event_date:'Choose a valid date.',movie_ids:'Choose a saved film.'},formMessage:'',
    });
  });

  it('keeps recognised retained fields visible when editing has no control', () => {
    const result = routeEventValidation([
      {path:'cycle_id',message:'Choose an existing cycle.'},
      {path:'cycle_slot',message:'Slot 5 is for Classics.'},
    ],new Set(['event_date']));
    expect(result.fields).toEqual({});
    expect(result.formMessage).toContain('Cycle: Choose an existing cycle.');
    expect(result.formMessage).toContain('Nominal slot: Slot 5 is for Classics.');
    expect(result.formMessage).toContain('Review the event details and try again');
    expect(result.formMessage).not.toMatch(/cycle_id|cycle_slot/);
  });

  it('retains a truthful fallback for unknown paths without exposing internal names', () => {
    const result = routeEventValidation([{path:'future_internal_field.value',message:'future_internal_field invalid'}],new Set(['future_internal_field']));
    expect(result.fields).toEqual({});
    expect(result.formMessage).toContain('Some event details could not be validated.');
    expect(result.formMessage).not.toContain('future_internal_field');
  });

  it('shows inline and fallback messages together for mixed rejection paths', () => {
    const result = routeEventValidation([
      {path:'event_date',message:'Choose a valid date.'},
      {path:'cycle_slot',message:'Slot 5 is for Classics.'},
      {path:'unmapped',message:'Invalid input'},
    ],new Set(['event_date']));
    expect(result.fields).toEqual({event_date:'Choose a valid date.'});
    expect(result.formMessage).toContain('Slot 5 is for Classics.');
    expect(result.formMessage).toContain('Some event details could not be validated.');
  });

  it('maps new-cycle errors only when a cycle control is mounted', () => {
    const issue = [{path:'new_cycle.rough_date',message:'Choose a valid anchor.'}];
    expect(routeEventValidation(issue,new Set(['cycle_id'])).fields).toEqual({cycle_id:'Choose a valid anchor.'});
    expect(routeEventValidation(issue,new Set()).formMessage).toContain('Cycle: Choose a valid anchor.');
  });
});
