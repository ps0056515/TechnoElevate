import { describe, it, expect } from 'vitest';
import { calcMargin, marginColor, fmtRate } from '../utils/marginUtils.js';

// ─── calcMargin ───────────────────────────────────────────────────────────────
describe('calcMargin', () => {
  it('returns correct margin % for typical staffing scenario', () => {
    // (16000 - 9200) / 16000 * 100 = 42.5 → rounded to 43
    expect(calcMargin(16000, 9200)).toBe(43);
  });

  it('returns correct margin % for another scenario', () => {
    // (17000 - 9500) / 17000 * 100 = 44.1 → rounded to 44
    expect(calcMargin(17000, 9500)).toBe(44);
  });

  it('handles string inputs (values from form fields)', () => {
    expect(calcMargin('16000', '9200')).toBe(43);
  });

  it('returns null when bill_rate is 0 (no rate set)', () => {
    expect(calcMargin(0, 9500)).toBeNull();
  });

  it('returns null when bill_rate is empty string', () => {
    expect(calcMargin('', 9500)).toBeNull();
  });

  it('returns null when bill_rate is null', () => {
    expect(calcMargin(null, 9500)).toBeNull();
  });

  it('returns null when bill_rate is undefined', () => {
    expect(calcMargin(undefined, 9500)).toBeNull();
  });

  it('returns 100% when pay_rate is 0 (pure revenue, no cost)', () => {
    expect(calcMargin(10000, 0)).toBe(100);
  });

  it('returns 100% when pay_rate is missing/undefined', () => {
    expect(calcMargin(10000, undefined)).toBe(100);
  });

  it('returns 0% when bill_rate equals pay_rate (break-even)', () => {
    expect(calcMargin(10000, 10000)).toBe(0);
  });

  it('returns negative % when pay_rate exceeds bill_rate (loss-making)', () => {
    // (10000 - 12000) / 10000 * 100 = -20
    expect(calcMargin(10000, 12000)).toBe(-20);
  });

  it('rounds to nearest integer', () => {
    // (15000 - 9000) / 15000 * 100 = 40.0
    expect(calcMargin(15000, 9000)).toBe(40);
    // (13000 - 8500) / 13000 * 100 = 34.615... → 35
    expect(calcMargin(13000, 8500)).toBe(35);
  });

  it('works for HIGH value contracts', () => {
    // (23000 - 14000) / 23000 * 100 = 39.13 → 39
    expect(calcMargin(23000, 14000)).toBe(39);
  });

  it('handles float rates', () => {
    // (16500.50 - 9800.25) / 16500.50 * 100 = 40.6... → 41
    expect(calcMargin(16500.50, 9800.25)).toBe(41);
  });
});

// ─── marginColor ─────────────────────────────────────────────────────────────
describe('marginColor', () => {
  it('returns green for margin >= 35% (healthy)', () => {
    expect(marginColor(35)).toBe('var(--green)');
    expect(marginColor(40)).toBe('var(--green)');
    expect(marginColor(100)).toBe('var(--green)');
    expect(marginColor(43)).toBe('var(--green)');
  });

  it('returns amber for margin 20–34% (watch zone)', () => {
    expect(marginColor(20)).toBe('var(--amber)');
    expect(marginColor(25)).toBe('var(--amber)');
    expect(marginColor(34)).toBe('var(--amber)');
  });

  it('returns red for margin below 20% (risky)', () => {
    expect(marginColor(19)).toBe('var(--red)');
    expect(marginColor(10)).toBe('var(--red)');
    expect(marginColor(0)).toBe('var(--red)');
  });

  it('returns red for negative margin (loss-making)', () => {
    expect(marginColor(-5)).toBe('var(--red)');
    expect(marginColor(-20)).toBe('var(--red)');
  });

  it('returns muted for null (no rate configured)', () => {
    expect(marginColor(null)).toBe('var(--text-muted)');
  });

  it('returns muted for undefined', () => {
    expect(marginColor(undefined)).toBe('var(--text-muted)');
  });

  it('uses exact boundary: 35 is green, 34 is amber', () => {
    expect(marginColor(35)).toBe('var(--green)');
    expect(marginColor(34)).toBe('var(--amber)');
  });

  it('uses exact boundary: 20 is amber, 19 is red', () => {
    expect(marginColor(20)).toBe('var(--amber)');
    expect(marginColor(19)).toBe('var(--red)');
  });
});

// ─── fmtRate ─────────────────────────────────────────────────────────────────
describe('fmtRate', () => {
  it('formats a typical monthly rate with $ and commas', () => {
    expect(fmtRate(16000)).toBe('$16,000');
  });

  it('formats a large rate correctly', () => {
    expect(fmtRate(1500000)).toBe('$1,500,000');
  });

  it('formats a small rate', () => {
    expect(fmtRate(7500)).toBe('$7,500');
  });

  it('returns dash for 0 (no rate set)', () => {
    expect(fmtRate(0)).toBe('—');
  });

  it('returns dash for null', () => {
    expect(fmtRate(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(fmtRate(undefined)).toBe('—');
  });

  it('returns dash for empty string', () => {
    expect(fmtRate('')).toBe('—');
  });

  it('handles string numbers from DB responses', () => {
    expect(fmtRate('16000')).toBe('$16,000');
    expect(fmtRate('9500.00')).toBe('$9,500');
  });

  it('returns dash for negative values', () => {
    expect(fmtRate(-500)).toBe('—');
  });
});

// ─── Combined integration of all three utils ──────────────────────────────────
describe('margin calculation pipeline (combined)', () => {
  const scenarios = [
    { role: 'Senior React Developer',   bill: 16000, pay: 9200,  expectedPct: 43, expectedColor: 'var(--green)', expectedFmt: '$16,000' },
    { role: 'Cloud Architect',          bill: 22000, pay: 13500, expectedPct: 39, expectedColor: 'var(--green)', expectedFmt: '$22,000' },
    { role: 'Security Engineer',        bill: 20000, pay: 12000, expectedPct: 40, expectedColor: 'var(--green)', expectedFmt: '$20,000' },
    { role: 'QA Automation Eng',        bill: 12500, pay: 7500,  expectedPct: 40, expectedColor: 'var(--green)', expectedFmt: '$12,500' },
    { role: 'Business Analyst',         bill: 13000, pay: 7800,  expectedPct: 40, expectedColor: 'var(--green)', expectedFmt: '$13,000' },
    { role: 'Full Stack PHP',           bill: 13000, pay: 8500,  expectedPct: 35, expectedColor: 'var(--green)', expectedFmt: '$13,000' },
    { role: 'No rate set',              bill: 0,     pay: 0,     expectedPct: null, expectedColor: 'var(--text-muted)', expectedFmt: '—' },
  ];

  scenarios.forEach(({ role, bill, pay, expectedPct, expectedColor, expectedFmt }) => {
    it(`correctly calculates margin pipeline for: ${role}`, () => {
      const pct = calcMargin(bill, pay);
      expect(pct).toBe(expectedPct);
      expect(marginColor(pct)).toBe(expectedColor);
      expect(fmtRate(bill)).toBe(expectedFmt);
    });
  });
});
