import solver, {type Model, type SolveResult} from 'javascript-lp-solver';

type Term = [id: string, coefficient: number];
type Couple = { left: string; right: string; limit: number };

// Optimize horizontal positions for a fixed row order. Units are card pitches.
export function compactLayout(rows: string[][], centres: Term[][], couples: Couple[], step: number) {
  const variables: Model['variables'] = { width: {}, gap: {}, drift: {}, coupleOverage: {} };
  const constraints: Model['constraints'] = {};
  const position = new Map(rows.flat().map((id, i) => [id, 'x' + i]));
  for (const key of position.values()) variables[key] = {};
  let constraintCount = 0;

  function constrain(bound: {min?: number; max?: number; equal?: number}, terms: Term[]) {
    const key = 'c' + constraintCount++;
    constraints[key] = bound;
    for (const [variable, coefficient] of terms) variables[variable][key] = coefficient;
  }

  const gapVariables: string[] = [];
  for (const row of rows) {
    constrain({max: 0}, [[position.get(row.at(-1)!)!, 1], ['width', -1]]);
    for (let i = 1; i < row.length; i++) {
      const distance: Term[] = [[position.get(row[i])!, 1], [position.get(row[i - 1])!, -1]];
      constrain({min: 1}, distance);
      constrain({max: 0}, [...distance, ['gap', -1]]);
      const excess = 'excess' + gapVariables.length;
      variables[excess] = {};
      gapVariables.push(excess);
      constrain({max: 2}, [...distance, [excess, -1]]);
    }
  }

  for (const centre of centres) {
    const terms: Term[] = centre.map(([id, coefficient]) => [position.get(id)!, coefficient]);
    constrain({max: 0}, [...terms, ['drift', -1]]);
    constrain({max: 0}, [...terms.map(([key, coefficient]): Term => [key, -coefficient]), ['drift', -1]]);
  }
  for (const {left, right, limit} of couples) {
    constrain({max: limit / step}, [[position.get(right)!, 1], [position.get(left)!, -1], ['coupleOverage', -1]]);
  }

  const model: Model = { optimize: 'cost', opType: 'min', constraints, variables };
  const solve = (objective = 'cost') => {
    const result = solver.Solve({...model, optimize: objective}, 1e-8) as SolveResult;
    return result.feasible && result.bounded !== false && Number.isFinite(result.result) ? result : null;
  };
  variables.drift.minimumDrift = 1;
  variables.coupleOverage.minimumCoupleOverage = 1;
  variables.drift.driftLimit = 1;
  variables.coupleOverage.coupleLimit = 1;

  // Prefer exact centring. If the current order makes that impossible,
  // compute the smallest maximum deviation instead of guessing a tolerance.
  constraints.driftLimit = {max: 0};
  constraints.coupleLimit = {max: 0};
  let bounds = solve('minimumCoupleOverage');
  if (!bounds) {
    delete constraints.coupleLimit;
    bounds = solve('minimumCoupleOverage');
    if (!bounds) {
      delete constraints.driftLimit;
      const closest = solve('minimumDrift');
      if (!closest) return null;
      constraints.driftLimit = {max: closest.result + 1e-7};
      bounds = solve('minimumCoupleOverage');
      if (!bounds) return null;
    }
    constraints.coupleLimit = {max: bounds.result + 1e-7};
  }

  // Penalize the largest gap and excess space throughout the chart, as well
  // as its total width. Ordinary gaps of up to two pitches incur no excess.
  variables.width.cost = 1;
  variables.gap.cost = 1;
  for (const name of gapVariables) variables[name].cost = 1 / Math.max(1, gapVariables.length);
  const best = solve();
  if (!best) return null;
  return new Map([...position].map(([id, key]) => [id, Number(best[key] ?? 0) * step]));
}
