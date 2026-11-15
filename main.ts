// Token Radar — entrypoint (Node 22, standard library only).
//
// Reads the sealed snapshot at /input/snapshot.json (or --input <file|dir>),
// scores every rankable pre-token protocol with the radar-3 size curve in
// lib/model.ts, writes the ranked board to /output/board.json, the
// dashboard's data to /output/data.js, copies dashboard/ and screenshots/
// into /output, and writes /output/dossier.json with the vendored make.fun
// library.
//
// The program is deterministic: the snapshot is sealed, the curve is fitted
// from it by pure arithmetic, and the sort breaks ties by slug, so two runs
// write the same bytes. Outside the grader's container, MAKEFUN_OUTPUT_DIR
// stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
const MIN_SCREENSHOTS = 3;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

function fail(message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(1);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  fail(`no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input`);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(`the model wrote a board the gate refuses: ${issue}`);

// The dashboard's own files must be present before anything is written out.
const dashboardDir = join(here, 'dashboard');
const dashboardFiles = existsSync(dashboardDir) ? readdirSync(dashboardDir).filter((n) => statSync(join(dashboardDir, n)).isFile()) : [];
for (const need of ['index.html', 'app.css', 'app.js']) {
  if (!dashboardFiles.includes(need)) fail(`dashboard/ is missing ${need}`);
}

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));
copyFiles(dashboardDir, join(out, 'dashboard'));

const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < MIN_SCREENSHOTS) {
  fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
  const bytes = statSync(join(out, 'screenshots', name)).size;
  if (bytes > SCREENSHOT_CAPS.max_bytes) fail(`screenshots/${name} is ${bytes} bytes, past the ${SCREENSHOT_CAPS.max_bytes} cap`);
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

const top = board[0]!;
const bottom = board[board.length - 1]!;
const fit = radar.fit;
const val = radar.validation;
const dossierBytes = statSync(join(out, 'dossier.json')).size;
process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols in the snapshot, ${snapshot.watchlist.length} on the watchlist\n` +
    `token radar: radar-3 curve fitted on ${fit.comps} comps: log(mcap) = ${fit.intercept} + ${fit.slope} * log(TVL), R^2 = ${fit.r_squared}\n` +
    `token radar: blind error 5-fold x${val.five_fold.factor.toFixed(2)}, time-split ${val.time_splits.map((t) => `x${t.factor.toFixed(2)}`).join(' / ')}, 2025-07 caveat x${val.caveat.factor.toFixed(2)}\n` +
    `token radar: board of ${board.length} rows (${radar.early_size} early finds), rank 1 ${top.slug} at $${top.implied_value_usd.toLocaleString('en-US')} down to rank ${bottom.rank} ${bottom.slug} at $${bottom.implied_value_usd.toLocaleString('en-US')}\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dashboardFiles.length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')} (${dossierBytes} bytes)\n`,
);
