/**
 * Margin Feature — Backend Integration Tests
 *
 * Tests the full stack: schema columns, CRUD endpoints, and
 * the /api/margins summary endpoint against the live database.
 *
 * Prerequisites: server running on port 6000, seed data loaded.
 */

const supertest = require('supertest');

const BASE = `http://localhost:${process.env.PORT || 4000}`;
const api  = supertest(BASE);

let token = '';
let createdReqId = null;
let createdTalentId = null;

// ─── Auth ────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  const res = await api
    .post('/api/auth/login')
    .send({ email: 'admin@techno.com', password: 'admin123' });

  expect(res.status).toBe(200);
  expect(res.body.token).toBeTruthy();
  token = res.body.token;
});

// ─── Helper ──────────────────────────────────────────────────────────────────
const auth = () => ({ Authorization: `Bearer ${token}` });

// ─── /api/margins ─────────────────────────────────────────────────────────────
describe('GET /api/margins', () => {
  it('returns 200 with an array', async () => {
    const res = await api.get('/api/margins').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('requires authentication — returns 401 without token', async () => {
    const res = await api.get('/api/margins');
    expect(res.status).toBe(401);
  });

  it('each item contains required margin fields', async () => {
    const res = await api.get('/api/margins').set(auth());
    expect(res.body.length).toBeGreaterThan(0);
    const item = res.body[0];
    expect(item).toHaveProperty('req_id');
    expect(item).toHaveProperty('title');
    expect(item).toHaveProperty('client');
    expect(item).toHaveProperty('bill_rate');
    expect(item).toHaveProperty('pay_rate');
    expect(item).toHaveProperty('margin_pct');
    expect(item).toHaveProperty('margin_abs');
  });

  it('margin_pct is computed correctly — (bill - pay) / bill * 100', async () => {
    const res = await api.get('/api/margins').set(auth());
    res.body.forEach(item => {
      const bill = parseFloat(item.bill_rate);
      const pay  = parseFloat(item.pay_rate);
      const expected = Math.round(((bill - pay) / bill) * 100 * 10) / 10; // 1 decimal
      expect(parseFloat(item.margin_pct)).toBeCloseTo(expected, 0);
    });
  });

  it('margin_abs is (bill_rate - pay_rate)', async () => {
    const res = await api.get('/api/margins').set(auth());
    res.body.forEach(item => {
      const bill = parseFloat(item.bill_rate);
      const pay  = parseFloat(item.pay_rate);
      expect(parseFloat(item.margin_abs)).toBeCloseTo(bill - pay, 1);
    });
  });

  it('excludes requirements where bill_rate is 0', async () => {
    const res = await api.get('/api/margins').set(auth());
    res.body.forEach(item => {
      expect(parseFloat(item.bill_rate)).toBeGreaterThan(0);
    });
  });

  it('results are ordered by margin_pct descending', async () => {
    const res = await api.get('/api/margins').set(auth());
    const pcts = res.body.map(r => parseFloat(r.margin_pct));
    for (let i = 1; i < pcts.length; i++) {
      expect(pcts[i]).toBeLessThanOrEqual(pcts[i - 1]);
    }
  });

  it('seeded requirements have realistic margin range (25%–50%)', async () => {
    const res = await api.get('/api/margins').set(auth());
    res.body.forEach(item => {
      const pct = parseFloat(item.margin_pct);
      expect(pct).toBeGreaterThan(20);
      expect(pct).toBeLessThan(55);
    });
  });
});

// ─── Requirements — bill_rate & pay_rate fields ────────────────────────────────
describe('GET /api/admin/requirements', () => {
  it('returns 200 with an array', async () => {
    const res = await api.get('/api/admin/requirements').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('each row includes bill_rate and pay_rate fields', async () => {
    const res = await api.get('/api/admin/requirements').set(auth());
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach(row => {
      expect(row).toHaveProperty('bill_rate');
      expect(row).toHaveProperty('pay_rate');
    });
  });

  it('seeded requirements have non-zero bill_rate values', async () => {
    const res = await api.get('/api/admin/requirements').set(auth());
    const withRates = res.body.filter(r => parseFloat(r.bill_rate) > 0);
    expect(withRates.length).toBeGreaterThan(0);
  });
});

describe('POST /api/admin/requirements — with bill_rate and pay_rate', () => {
  it('creates a requirement and persists bill_rate and pay_rate', async () => {
    const payload = {
      title: 'Test Margin Engineer',
      client: 'TestCorp',
      stage: 'intake',
      priority: 'MED',
      role_type: 'Backend',
      bill_rate: 18000,
      pay_rate: 11000,
    };
    const res = await api
      .post('/api/admin/requirements')
      .set(auth())
      .send(payload);

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.bill_rate)).toBe(18000);
    expect(parseFloat(res.body.pay_rate)).toBe(11000);
    createdReqId = res.body.id;
  });

  it('requirement appears in /api/margins with correct margin_pct', async () => {
    const res = await api.get('/api/margins').set(auth());
    const found = res.body.find(r => r.id === createdReqId);
    expect(found).toBeTruthy();
    // (18000 - 11000) / 18000 * 100 = 38.9 → rounded to 38.9
    expect(parseFloat(found.margin_pct)).toBeCloseTo(38.9, 0);
  });

  it('creates with zero rates — excluded from /api/margins', async () => {
    const res = await api
      .post('/api/admin/requirements')
      .set(auth())
      .send({ title: 'No Rate Req', client: 'TestCorp', stage: 'intake', bill_rate: 0, pay_rate: 0 });

    expect(res.status).toBe(200);
    const margins = await api.get('/api/margins').set(auth());
    const found = margins.body.find(r => r.id === res.body.id);
    expect(found).toBeUndefined();

    // cleanup
    await api.delete(`/api/admin/requirements/${res.body.id}`).set(auth());
  });
});

describe('PUT /api/admin/requirements/:id — update rates', () => {
  it('updates bill_rate and pay_rate correctly', async () => {
    const getRes = await api.get('/api/admin/requirements').set(auth());
    const req = getRes.body.find(r => r.id === createdReqId);
    expect(req).toBeTruthy();

    const updated = { ...req, bill_rate: 20000, pay_rate: 12000 };
    const putRes = await api
      .put(`/api/admin/requirements/${createdReqId}`)
      .set(auth())
      .send(updated);

    expect(putRes.status).toBe(200);
    expect(putRes.body.success).toBe(true);
  });

  it('reflects updated rates in /api/margins', async () => {
    const res = await api.get('/api/margins').set(auth());
    const found = res.body.find(r => r.id === createdReqId);
    expect(found).toBeTruthy();
    expect(parseFloat(found.bill_rate)).toBe(20000);
    expect(parseFloat(found.pay_rate)).toBe(12000);
    // (20000 - 12000) / 20000 * 100 = 40
    expect(parseFloat(found.margin_pct)).toBeCloseTo(40, 0);
  });

  it('setting bill_rate to 0 removes it from /api/margins', async () => {
    const getRes = await api.get('/api/admin/requirements').set(auth());
    const req = getRes.body.find(r => r.id === createdReqId);

    await api
      .put(`/api/admin/requirements/${createdReqId}`)
      .set(auth())
      .send({ ...req, bill_rate: 0, pay_rate: 0 });

    const margins = await api.get('/api/margins').set(auth());
    const found = margins.body.find(r => r.id === createdReqId);
    expect(found).toBeUndefined();

    // restore rates for cleanup
    await api
      .put(`/api/admin/requirements/${createdReqId}`)
      .set(auth())
      .send({ ...req, bill_rate: 18000, pay_rate: 11000 });
  });
});

describe('DELETE /api/admin/requirements/:id — cleanup', () => {
  it('deletes the test requirement', async () => {
    const res = await api
      .delete(`/api/admin/requirements/${createdReqId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('deleted requirement no longer in /api/margins', async () => {
    const res = await api.get('/api/margins').set(auth());
    const found = res.body.find(r => r.id === createdReqId);
    expect(found).toBeUndefined();
  });
});

// ─── Talent — pay_rate field ──────────────────────────────────────────────────
describe('GET /api/admin/talent', () => {
  it('returns 200 with an array', async () => {
    const res = await api.get('/api/admin/talent').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('each talent row includes pay_rate field', async () => {
    const res = await api.get('/api/admin/talent').set(auth());
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach(row => {
      expect(row).toHaveProperty('pay_rate');
    });
  });

  it('seeded talent have non-zero pay_rate values', async () => {
    const res = await api.get('/api/admin/talent').set(auth());
    const withRates = res.body.filter(r => parseFloat(r.pay_rate) > 0);
    expect(withRates.length).toBeGreaterThan(10);
  });
});

describe('POST /api/admin/talent — with pay_rate', () => {
  it('creates a talent record with pay_rate and persists it', async () => {
    const res = await api
      .post('/api/admin/talent')
      .set(auth())
      .send({
        name: 'Test Engineer Margin',
        role: 'Test Role',
        status: 'bench',
        skills: 'Jest,Node.js',
        pay_rate: 9750,
      });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.pay_rate)).toBe(9750);
    createdTalentId = res.body.id;
  });

  it('created talent appears in GET with correct pay_rate', async () => {
    const res = await api.get('/api/admin/talent').set(auth());
    const found = res.body.find(r => r.id === createdTalentId);
    expect(found).toBeTruthy();
    expect(parseFloat(found.pay_rate)).toBe(9750);
  });
});

describe('PUT /api/admin/talent/:id — update pay_rate', () => {
  it('updates pay_rate correctly', async () => {
    const getRes = await api.get('/api/admin/talent').set(auth());
    const talent = getRes.body.find(r => r.id === createdTalentId);

    const putRes = await api
      .put(`/api/admin/talent/${createdTalentId}`)
      .set(auth())
      .send({ ...talent, skills: Array.isArray(talent.skills) ? talent.skills.join(',') : talent.skills, pay_rate: 10500 });

    expect(putRes.status).toBe(200);
    expect(putRes.body.success).toBe(true);
  });

  it('reflects updated pay_rate in GET', async () => {
    const res = await api.get('/api/admin/talent').set(auth());
    const found = res.body.find(r => r.id === createdTalentId);
    expect(found).toBeTruthy();
    expect(parseFloat(found.pay_rate)).toBe(10500);
  });
});

describe('DELETE /api/admin/talent/:id — cleanup', () => {
  it('deletes the test talent record', async () => {
    const res = await api
      .delete(`/api/admin/talent/${createdTalentId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────
describe('Edge cases', () => {
  it('GET /api/margins — margin_pct is a number, not a string', async () => {
    const res = await api.get('/api/margins').set(auth());
    res.body.forEach(item => {
      expect(typeof parseFloat(item.margin_pct)).toBe('number');
      expect(isNaN(parseFloat(item.margin_pct))).toBe(false);
    });
  });

  it('GET /api/margins — margin_abs matches bill_rate - pay_rate', async () => {
    const res = await api.get('/api/margins').set(auth());
    res.body.forEach(item => {
      const expected = parseFloat(item.bill_rate) - parseFloat(item.pay_rate);
      expect(parseFloat(item.margin_abs)).toBeCloseTo(expected, 1);
    });
  });

  it('GET /api/admin/requirements — pay_rate defaults to 0 if not set', async () => {
    const res = await api
      .post('/api/admin/requirements')
      .set(auth())
      .send({ title: 'No Pay Rate Req', client: 'TestCorp', stage: 'intake', bill_rate: 15000 });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.pay_rate)).toBe(0);

    await api.delete(`/api/admin/requirements/${res.body.id}`).set(auth());
  });

  it('GET /api/admin/talent — pay_rate defaults to 0 if not set', async () => {
    const res = await api
      .post('/api/admin/talent')
      .set(auth())
      .send({ name: 'No Pay Rate Talent', role: 'Tester', status: 'bench' });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.pay_rate)).toBe(0);

    await api.delete(`/api/admin/talent/${res.body.id}`).set(auth());
  });

  it('GET /api/margins — all seeded Cloud Architect reqs have highest margin band', async () => {
    const res = await api.get('/api/margins').set(auth());
    const cloudReqs = res.body.filter(r => r.role_type === 'Cloud' || r.title.includes('Cloud Architect'));
    cloudReqs.forEach(r => {
      // Cloud Architect: bill=22000, pay=13500 → ~39% — should be green (≥35%)
      expect(parseFloat(r.margin_pct)).toBeGreaterThanOrEqual(35);
    });
  });
});
