/**
 * List sheet names in a BD_DAR xlsx and show how loadBdDarSnapshot maps them.
 *
 *   node inspect-bd-dar.js
 *   node inspect-bd-dar.js --in=C:\path\BD_DAR.xlsx
 */
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { defaultBdDarPath, resolveAllSheetNames, loadBdDarSnapshot } = require('./loadBdDarSnapshot');

const argv = process.argv.slice(2);
const inArg = argv.find((a) => a.startsWith('--in='));
const p = inArg ? path.resolve(inArg.replace(/^--in=/, '')) : defaultBdDarPath();

if (!fs.existsSync(p)) {
  console.error('Not found:', p);
  console.error('Copy BD_DAR.xlsx here or pass --in=');
  process.exit(1);
}

const wb = XLSX.readFile(p, { cellDates: true });
console.log('File:', p);
console.log('Tabs in workbook:', (wb.SheetNames || []).join(' | '));
const rs = resolveAllSheetNames(wb);
console.log('Resolved mapping:');
console.log('  bd              →', rs.bd || '(missing — views need this)');
console.log('  bench           →', rs.bench || '(optional)');
console.log('  bench_interview →', rs.bench_interview || '(optional)');
console.log('  market_interview→', rs.market_interview || '(optional)');

try {
  const snap = loadBdDarSnapshot(p);
  console.log('Row counts from snapshot:');
  console.log('  bd:', snap.bd.length, '· bench:', snap.bench.length, '· bench intv:', snap.bench_interview.length, '· market intv:', snap.market_interview.length);
  console.log('OK — this file will drive the BD Operations views after snapshot save.');
} catch (e) {
  console.error('loadBdDarSnapshot error:', e.message);
  process.exit(1);
}
