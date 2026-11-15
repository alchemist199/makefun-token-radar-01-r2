// Token Radar — the value model (radar-3).
//
// One fitted curve prices every pre-token protocol, and the same curve prices
// the board and the page, so the dashboard and the board can never disagree:
//
//   log(mcap_usd) = a + b * log(tvl_usd)
//
// fitted by ordinary least squares on the 93 restricted comps at run time,
// from the snapshot itself — the coefficients are computed, never hardcoded.
// The comps are the token protocols with mcap > 0 and TVL > 0, minus the
// wrapped / staked / bridged products (Bridge, Canonical Bridge, Liquid
// Staking, Liquid Restaking, Restaked BTC, CEX) and the versioned names
// (a name ending in V2, v2, 2.0 and the like) — the same exclusion the
// watchlist rule uses. On this snapshot the fit lands near a = 9.256,
// b = 0.387, R^2 = 0.100: the curve is sublinear, so a giant's TVL buys far
// less market cap per dollar than a small protocol's, and the scatter is the
// story — the curve explains only 10% of log-mcap variance.
//
//   implied value = exp(a + b * ln(TVL))
//
// No growth term, no age term, no chains term. All three were tested as extra
// regressors on the same comps and dropped for measured reasons:
//  - growth: its fitted coefficient flips sign by split (+3.86 training
//    before 2024, +1.75 before 2024-07, +1.32 before 2025, -2.21 on the full
//    93), so a fitted growth multiplier would swing 0.07x-3.76x. Not a signal.
//  - age: adding age makes the blind time-split error x6.0. It poisons the fit.
//  - chains: its coefficient is negative in every fit (-0.14 to -0.26); more
//    chains mean a lower mcap/TVL among the comps. Counterintuitive, no
//    holdout gain, dropped.
// Growth and age are still shown per protocol in the detail view, as context
// only, with the note that both were tested and dropped.
//
// Validation (computed at run time, same code the dashboard renders):
// error is median |log(pred/actual)|, reported as a factor (xN = the typical
// prediction is off by N times). 5-fold cross-validation uses deterministic
// slug-hash folds; the time splits train on protocols listed before a cutoff
// and test on the ones listed after it. The curve's blind error is about
// x3.50 (5-fold) and x2.07 (time-split at 2025-01), against x5.25 for the
// round-1 category-median model on the same 5-fold.
//
// The board holds every rankable pre-token protocol: the 40 watchlist slugs
// plus the 163 early finds below the floor (203 rows, no wrapped fill —
// every row is a genuine pre-token protocol). Ranking is TVL-monotone by
// construction, because the curve has one variable; the page says so, and
// the farm plans and detail views are what differ per protocol. Live-token
// protocols are never ranked: they already trade, so the dashboard shows the
// market's own value for them in a separate Live view, which is also where
// the 93 comps come from.

/** One protocol entry: exactly the ten fields the sealed snapshot carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted size curve, computed from the comps at run time. */
export interface CurveFit {
  intercept: number;
  slope: number;
  r_squared: number;
  comps: number;
}

/** One blind-validation reading: median |log(pred/actual)| as a factor. */
export interface ValidationReading {
  label: string;
  factor: number;
  test_n: number;
}

/** The validation the dashboard renders, all computed at run time. */
export interface Validation {
  five_fold: ValidationReading;
  time_splits: ValidationReading[];
  caveat: ValidationReading;
  /** Round-1's category-median model on the same 5-fold, measured in the round-2 study. */
  round1_five_fold: number;
}

/** A scatter point for the dashboard chart: log TVL vs log mcap of one comp. */
export interface ScatterPoint {
  x: number;
  y: number;
  slug: string;
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** Farm-plan verdict thresholds, stated on the page. */
export const VERDICT_FARM_MIN_IMPLIED = 15_000_000;
export const VERDICT_WATCH_MIN_IMPLIED = 5_000_000;
export const VERDICT_FARM_MAX_GAS = 25;
/** Transactions the plan assumes over the hold (setup, weekly actions, exit). */
export const PLAN_TRANSACTIONS = 10;

/** One farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json. `set` says where the row came from: the watchlist or the early radar. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  set: 'watchlist' | 'early';
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    curve_value_usd: number;
    growth_pct: number | null;
    age_days: number | null;
    gas_per_tx_usd: number;
    plan_gas_usd: number;
    plan_capital_usd: number;
    plan_cost_usd: number;
    plan_cost_pct: number;
    verdict: 'Farm' | 'Watch' | 'Small';
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  curve_value_usd: number;
  gas_per_tx_usd: number;
  plan_gas_usd: number;
  plan_capital_usd: number;
  plan_cost_usd: number;
  plan_cost_pct: number;
  verdict: 'Farm' | 'Watch' | 'Small';
  watchlist: boolean;
  set: 'watchlist' | 'early';
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl_ratio: number | null;
}

/** Everything the dashboard needs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  fit: CurveFit;
  validation: Validation;
  scatter: ScatterPoint[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted-ascending list, or null when it is empty. */
function medianOf(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one of the 93 comps: a token protocol with a market cap and TVL, not wrapped/staked/bridged, not a versioned pool. */
export function isComp(p: SnapshotProtocol): boolean {
  return !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && (p.category === null || !WRAPPED_CATEGORIES.has(p.category)) && !VERSIONED.test(p.name);
}

/** Whether a protocol is one the board may rank: pre-token, not wrapped/staked/bridged, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && (p.category === null || !WRAPPED_CATEGORIES.has(p.category)) && !VERSIONED.test(p.name);
}

/** Ordinary least squares for log(mcap) on log(TVL) over the given comps. */
export function fitCurve(comps: SnapshotProtocol[]): CurveFit {
  const xs = comps.map((p) => Math.log(p.tvl_usd));
  const ys = comps.map((p) => Math.log(p.mcap_usd!));
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (ys[i]! - my) * (ys[i]! - my);
    const resid = ys[i]! - (intercept + slope * xs[i]!);
    ssRes += resid * resid;
  }
  return { intercept, slope, r_squared: ssTot === 0 ? 0 : 1 - ssRes / ssTot, comps: n };
}

/** The curve's implied value for a TVL: exp(a + b * ln(TVL)), whole dollars, at least $1. */
export function curveValue(tvlUsd: number, fit: CurveFit): number {
  if (tvlUsd <= 0) return 1;
  return Math.max(1, Math.round(Math.exp(fit.intercept + fit.slope * Math.log(tvlUsd))));
}

/** A tiny deterministic hash of a slug, for the 5-fold split. */
function slugHash(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

/** Median |log(pred/actual)| over `test`, fitted on `train`, as a factor. */
function holdoutFactor(train: SnapshotProtocol[], test: SnapshotProtocol[]): number | null {
  if (train.length < 10 || test.length === 0) return null;
  const fit = fitCurve(train);
  const errs = test
    .map((p) => Math.abs(Math.log(curveValue(p.tvl_usd, fit)) - Math.log(p.mcap_usd!)))
    .sort((a, b) => a - b);
  const med = medianOf(errs);
  return med === null ? null : Math.exp(med);
}

/** 5-fold cross-validation over the comps, folds by slug hash. */
function fiveFold(comps: SnapshotProtocol[]): ValidationReading {
  const foldErrs: number[] = [];
  for (let fold = 0; fold < 5; fold++) {
    const test = comps.filter((p) => slugHash(p.slug) % 5 === fold);
    const train = comps.filter((p) => slugHash(p.slug) % 5 !== fold);
    const factor = holdoutFactor(train, test);
    if (factor !== null) foldErrs.push(Math.log(factor));
  }
  foldErrs.sort((a, b) => a - b);
  const med = medianOf(foldErrs);
  return { label: '5-fold cross-validation', factor: med === null ? 0 : Math.exp(med), test_n: comps.length };
}

/** Time-split holdout: train on comps listed before `cutoff`, test on the rest. */
function timeSplit(comps: SnapshotProtocol[], cutoff: string): ValidationReading {
  const dated = comps.filter((p) => p.listed_at !== null);
  const train = dated.filter((p) => p.listed_at! < cutoff);
  const test = dated.filter((p) => p.listed_at! >= cutoff);
  const factor = holdoutFactor(train, test);
  return { label: `time-split · cut ${cutoff}`, factor: factor ?? 0, test_n: test.length };
}

/** The validation table the dashboard renders, computed from the comps. */
export function validateCurve(comps: SnapshotProtocol[]): Validation {
  return {
    five_fold: fiveFold(comps),
    time_splits: [timeSplit(comps, '2024-01-01'), timeSplit(comps, '2024-07-01'), timeSplit(comps, '2025-01-01')],
    caveat: timeSplit(comps, '2025-07-01'),
    round1_five_fold: 5.25,
  };
}

/** The scatter points for the dashboard chart, log TVL vs log mcap. */
export function scatterPoints(comps: SnapshotProtocol[]): ScatterPoint[] {
  return comps
    .map((p) => ({ x: Math.round(Math.log(p.tvl_usd) * 1e4) / 1e4, y: Math.round(Math.log(p.mcap_usd!) * 1e4) / 1e4, slug: p.slug }))
    .sort((a, b) => a.x - b.x);
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Estimated gas per transaction on a protocol's first chain, in dollars (stated estimates, not quotes). */
export function gasPerTx(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 8;
  if (c === 'base' || c === 'arbitrum' || c === 'optimism' || c === 'polygon') return 0.1;
  if (c === 'solana') return 0.05;
  if (c === 'bsc' || c === 'bnb chain') return 0.3;
  if (c === 'tron') return 1;
  return 2;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The farm verdict, from the stated rule printed on the page. */
export function verdictFor(implied: number, planGasUsd: number): 'Farm' | 'Watch' | 'Small' {
  if (implied >= VERDICT_FARM_MIN_IMPLIED && planGasUsd <= VERDICT_FARM_MAX_GAS) return 'Farm';
  if (implied >= VERDICT_WATCH_MIN_IMPLIED) return 'Watch';
  return 'Small';
}

/** The category's main action, in words a farmer can follow, with its own capital and chain. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${n} on ${chain} as a lender and leave the deposit earning.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${n}'s deepest pool on ${chain} and keep the LP position open.`;
  if (c.includes('yield aggregator') || c.includes('yield')) return `Deposit $${capital} of USDC into ${n}'s highest-yield vault on ${chain} and keep the vault shares.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC into ${chain} through ${n}, then use the bridged funds inside its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${n} and keep the staking receipt.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${n} and open one small hedged trade.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${n} and place one position on an active market.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('asset management')) return `Deposit $${capital} into a ${n} vault on ${chain} and keep the vault shares.`;
  if (c.includes('stable') || c.includes('rwa')) return `Mint or hold $${capital} of ${n}'s yield-bearing asset on ${chain} and keep it in your wallet.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${n} on ${chain} and keep the policy active.`;
  if (c.includes('liquid')) return `Provide $${capital} of liquidity to ${n} on ${chain} and keep the position open.`;
  if (c.includes('governance')) return `Deposit $${capital} into ${n} on ${chain} and vote once on an active proposal.`;
  if (c.includes('payment') || c.includes('pay')) return `Route $${capital} of payments through ${n} on ${chain} and keep the receipts.`;
  return `Deposit $${capital} of USDC into ${n} on ${chain} and keep the position open.`;
}

/** The category's second, different action, so the plan is not one move repeated. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $${Math.round(capital / 2)} against the deposit on ${n} and repay it within the same week, so the account shows both sides of the market.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Swap $${Math.round(capital / 2)} through ${n} on ${chain} once a week, in a different pair each time.`;
  if (c.includes('yield')) return `Move $${Math.round(capital / 2)} into a second ${n} vault on ${chain} with a different strategy.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${Math.round(capital / 2)} back through ${n} to a second chain, so the account shows two-way volume.`;
  if (c.includes('staking') || c.includes('restak')) return `Delegate a second $${Math.round(capital / 2)} stake through ${n} to a different validator set.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Close the hedge on ${n} and open a fresh one the next week, keeping the account active.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('asset management')) return `Top up the ${n} vault by $${Math.round(capital / 2)} after two weeks, so the deposit history shows growth.`;
  if (c.includes('stable') || c.includes('rwa')) return `Redeem $${Math.round(capital / 2)} of the ${n} asset and re-mint it the same week, so the account shows a full cycle.`;
  if (c.includes('governance')) return `Join one community call or forum thread for ${n} and leave a written comment.`;
  return `Use ${n} a second way on ${chain}: a swap, a vote or a deposit of $${Math.round(capital / 2)}, different from the first position.`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time.
 * Gas is priced on the protocol's first chain (Ethereum ~$8/tx, Base /
 * Arbitrum / Optimism / Polygon ~$0.10, Solana ~$0.05, BSC ~$0.30,
 * Tron ~$1, any other chain ~$2 — stated estimates, not quotes). Capital
 * follows the TVL band and the hold follows the age. Step 7 is the net line:
 * the whole plan's cost (gas over ~10 transactions plus the capital at risk)
 * against the model's implied value, as a percentage.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, implied: number): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasPerTx(chain);
  const planGas = Math.round(gas * PLAN_TRANSACTIONS * 100) / 100;
  const planCost = Math.round((planGas + capital) * 100) / 100;
  // The plan's cost is always a tiny fraction of the priced value (at most
  // ~$330 against a $4M floor), so keep four decimals and say "less than
  // 0.01%" rather than rounding the share down to a bare 0%.
  const pctRaw = (planCost / implied) * 100;
  const pctText = pctRaw < 0.005 ? 'less than 0.01%' : `${pctRaw.toFixed(2)}%`;
  const gasFmt = gas < 1 ? `$${gas.toFixed(2)}` : `$${gas}`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    { text: actionFor(p, capital, chain), cost: `$${capital} of capital and about ${gasFmt} of gas`, time: '15 minutes to set up' },
    {
      text: secondActionFor(p, capital, chain),
      cost: `about ${gasFmt} of gas, no new capital beyond the $${capital}`,
      time: '15 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and never let the account sit idle for a month.`,
      cost: `about ${gasFmt} of gas a week on ${chain}`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and check the protocol's own points or rewards page once a week.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Write the wallet, the dates and every transaction hash in a farm log, and claim only from a link the protocol itself publishes, never from a reply or a DM.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: `Net: the plan costs about $${planCost} in total — $${planGas} of gas over about ${PLAN_TRANSACTIONS} transactions on ${chain} plus $${capital} of capital at risk — against a model-implied launch value of $${implied.toLocaleString('en-US')}, so the farm costs about ${pctText} of the priced value.`,
      cost: `$${planCost} total plan cost`,
      time: `${hold} days held`,
    },
  ];
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n.
 *
 * The watchlist is the floor: every slug it names. The early radar then adds
 * every other rankable pre-token protocol — no floor, no cap, no wrapped
 * fill — so the board holds all 203 rankable pre-token protocols on this
 * snapshot. Each row is scored by the one fitted curve, so the ranking is
 * TVL-monotone by construction; the page states that plainly. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const comps = snapshot.protocols.filter(isComp);
  const fit = fitCurve(comps);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, { p: SnapshotProtocol; set: 'watchlist' | 'early' }>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, { p, set: 'watchlist' });
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, { p, set: 'early' });
  }

  const scored = [...chosen.values()].map(({ p, set }) => {
    const implied = curveValue(p.tvl_usd, fit);
    const age = ageDays(snapshot.as_of, p.listed_at);
    const gas = gasPerTx(chainOf(p));
    const capital = capitalFor(p);
    const planGas = Math.round(gas * PLAN_TRANSACTIONS * 100) / 100;
    const planCost = Math.round((planGas + capital) * 100) / 100;
    return { p, set, implied, age, gas, capital, planGas, planCost };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const pct = Math.round((s.planCost / s.implied) * 100 * 1e4) / 1e4;
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      set: s.set,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.age,
      implied_value_usd: s.implied,
      model: {
        curve_value_usd: s.implied,
        growth_pct: s.p.change_7d === null ? null : round4(s.p.change_7d),
        age_days: s.age,
        gas_per_tx_usd: s.gas,
        plan_gas_usd: s.planGas,
        plan_capital_usd: s.capital,
        plan_cost_usd: s.planCost,
        plan_cost_pct: pct,
        verdict: verdictFor(s.implied, s.planGas),
      },
      farm_steps: farmSteps(s.p, s.age, s.implied).map(stepText),
    };
  });
}

/** The live-token protocols, by market cap, for the dashboard's Live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd !== null && p.mcap_usd > 0)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl_ratio: p.mcap_usd !== null && p.tvl_usd > 0 ? Math.round((p.mcap_usd / p.tvl_usd) * 1e4) / 1e4 : null,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    curve_value_usd: row.model.curve_value_usd,
    gas_per_tx_usd: row.model.gas_per_tx_usd,
    plan_gas_usd: row.model.plan_gas_usd,
    plan_capital_usd: row.model.plan_capital_usd,
    plan_cost_usd: row.model.plan_cost_usd,
    plan_cost_pct: row.model.plan_cost_pct,
    verdict: row.model.verdict,
    watchlist: watchlist.has(row.slug),
    set: row.set,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const comps = snapshot.protocols.filter(isComp);
  const fit = fitCurve(comps);
  const watch = new Set(snapshot.watchlist);
  const early = board.filter((r) => r.set === 'early').length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    fit: { intercept: round4(fit.intercept), slope: round4(fit.slope), r_squared: round4(fit.r_squared), comps: fit.comps },
    validation: validateCurve(comps),
    scatter: scatterPoints(comps),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, watch)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
