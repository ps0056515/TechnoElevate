/**
 * 1) Save BD_DAR.xlsx to bd_ops_snapshot
 * 2) Generate TechnoElevate_From_BD_DAR.xlsx
 * 3) node onboard-excel.js --reset (keeps Administrator users)
 *
 * Usage:
 *   node sync-bd-dar-full.js
 *   node sync-bd-dar-full.js --in=C:\path\BD_DAR.xlsx
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const pool = require('./db');
const { loadBdDarSnapshot, defaultBdDarPath } = require('./loadBdDarSnapshot');

const argv = process.argv.slice(2);
const inArg = argv.find((a) => a.startsWith('--in='));
const p = inArg ? path.resolve(inArg.replace(/^--in=/, '')) : defaultBdDarPath();

async function main() {
  if (!fs.existsSync(p)) {
    console.error('File not found:', p);
    process.exit(1);
  }
  console.log('Loading', p);
  const payload = loadBdDarSnapshot(p);
  if (payload._dar_meta?.resolved_sheets) {
    console.log('Excel tabs used:', JSON.stringify(payload._dar_meta.resolved_sheets, null, 2));
  }
  await pool.query(
    `INSERT INTO bd_ops_snapshot (id, payload, source_filename, updated_at)
     VALUES (1, $1::jsonb, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET payload = $1::jsonb, source_filename = $2, updated_at = NOW()`,
    [JSON.stringify(payload), path.basename(p)]
  );
  console.log('Snapshot saved. Rows BD/bench/bi/mi:', payload.bd.length, payload.bench.length, payload.bench_interview.length, payload.market_interview.length);

  const backRoot = __dirname;
  const outXlsx = path.join(backRoot, 'TechnoElevate_From_BD_DAR.xlsx');
  const r1 = spawnSync(process.execPath, [path.join(backRoot, 'import-bd-dar.js'), '--in=' + p, '--out=' + outXlsx], {
    cwd: backRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (r1.status !== 0) {
    await pool.end();
    process.exit(1);
  }
  const r2 = spawnSync(process.execPath, [path.join(backRoot, 'onboard-excel.js'), '--reset', '--file=' + outXlsx], {
    cwd: backRoot,
    stdio: 'inherit',
    env: process.env,
  });
  await pool.end();
  process.exit(r2.status || 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
