/**
 * Read BD_DAR.xlsx (or same layout) into a snapshot object for KPI engine + storage.
 * Sheet names in the wild: "BD" vs "BD Data", "Bench Intv Data" vs "Bench Interview", etc.
 * We match case-insensitively and with token (substring) fallbacks.
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

function sheetToObjects(wb, name) {
  if (!name) return [];
  const sheet = wb.Sheets[name];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!raw.length) return [];
  const hdr = raw[0].map((h) => String(h).trim());
  return raw
    .slice(1)
    .filter((r) => r.some((c) => c !== '' && c !== null && c !== undefined))
    .map((r) => {
      const o = {};
      hdr.forEach((h, i) => {
        if (h) o[h] = r[i];
      });
      return o;
    });
}

/**
 * @param {string[]} sheetNames - wb.SheetNames
 * @param {string[][]} patternGroups - ordered: try each pattern in order across groups
 * @returns {string | null} actual sheet name in workbook
 */
function pickSheet(sheetNames, patternGroups) {
  const set = sheetNames.map((s) => s.trim());
  if (!set.length) return null;

  const setLower = new Map();
  for (const n of set) {
    setLower.set(n.toLowerCase().replace(/\s+/g, ' ').trim(), n);
  }

  for (const group of patternGroups) {
    for (const p of group) {
      const key = p.toLowerCase().replace(/\s+/g, ' ').trim();
      if (setLower.has(key)) return setLower.get(key);
    }
  }
  for (const group of patternGroups) {
    for (const p of group) {
      const toks = p.toLowerCase().replace(/\s+/g, ' ').trim().split(/\s+/).filter((t) => t.length > 0);
      const found = set.find((n) => {
        const ln = n.toLowerCase().replace(/\s+/g, ' ');
        return toks.length > 0 && toks.every((t) => ln.includes(t));
      });
      if (found) return found;
    }
  }
  return null;
}

/** RKN / common variants — one row per "logical" sheet. */
const PATTERNS = {
  bd: [
    ['BD Data', 'bd data', 'BD', 'B.D Data', 'BDD', 'B D Data', 'BDDAR', 'BDDar'],
    ['BDDar Data', 'BDDar'],
  ],
  bench: [
    ['Bench Data', 'bench data', 'Bench', 'BENCH', 'BENCH DATA'],
  ],
  bench_interview: [
    ['Bench Intv Data', 'bench intv data', 'Bench Interview', 'bench interview', 'Bench intv', 'Bench Intv', 'BENCH INTERVIEW', 'BENCH INTV'],
  ],
  market_interview: [
    ['Market Intv Data', 'market intv data', 'Market Interview', 'market interview', 'Market intv', 'Market Intv', 'MARKET INTERVIEW'],
  ],
};

/**
 * @param {import('xlsx').WorkBook} wb
 * @returns {{ bd: string | null, bench: string | null, bench_interview: string | null, market_interview: string | null }}
 */
function resolveAllSheetNames(wb) {
  const names = wb.SheetNames || [];
  return {
    bd: pickSheet(names, PATTERNS.bd),
    bench: pickSheet(names, PATTERNS.bench),
    bench_interview: pickSheet(names, PATTERNS.bench_interview),
    market_interview: pickSheet(names, PATTERNS.market_interview),
  };
}

/**
 * @param {string} filePath - absolute or relative path to BD_DAR.xlsx
 * @returns {{ bd: object[], bench: object[], bench_interview: object[], market_interview: object[], _dar_meta?: { resolved_sheets, source_path } }}
 */
function loadBdDarSnapshot(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const resolved = resolveAllSheetNames(wb);
  if (!resolved.bd) {
    const have = (wb.SheetNames || []).join(', ');
    throw new Error(
      `No BD sheet in workbook. Need a tab like "BD" or "BD Data". Found: [${have}]`
    );
  }

  const snap = {
    bd: sheetToObjects(wb, resolved.bd),
    bench: resolved.bench ? sheetToObjects(wb, resolved.bench) : [],
    bench_interview: resolved.bench_interview ? sheetToObjects(wb, resolved.bench_interview) : [],
    market_interview: resolved.market_interview ? sheetToObjects(wb, resolved.market_interview) : [],
    _dar_meta: {
      resolved_sheets: resolved,
      source_path: path.resolve(filePath),
    },
  };
  return snap;
}

/**
 * Preferred locations (first match on disk):
 * 1) reference/BD_DAR.xlsx — committed template area
 * 2) legacy backend/BD_DAR.xlsx
 * 3) reference/BD_Operations_Dashboard (1).xlsx — same "BD Data" / Bench* sheets as the DAR (OK for sync)
 */
function defaultBdDarPath() {
  const refDar = path.join(__dirname, 'reference', 'BD_DAR.xlsx');
  const rootDar = path.join(__dirname, 'BD_DAR.xlsx');
  const refDash = path.join(__dirname, 'reference', 'BD_Operations_Dashboard (1).xlsx');
  if (fs.existsSync(refDar)) return refDar;
  if (fs.existsSync(rootDar)) return rootDar;
  if (fs.existsSync(refDash)) return refDash;
  return refDar;
}

module.exports = {
  loadBdDarSnapshot,
  defaultBdDarPath,
  sheetToObjects,
  resolveAllSheetNames,
  pickSheet,
};
