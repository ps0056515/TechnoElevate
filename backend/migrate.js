require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

async function run() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS bd_ops_snapshot (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      payload JSONB NOT NULL DEFAULT '{}',
      source_filename TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS bd_ops_vp_targets (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      monthly_engineer_target INTEGER,
      net_engineer_actual INTEGER,
      revenue_fy_target_cr NUMERIC(12,2),
      revenue_mtd_cr NUMERIC(12,2),
      revenue_ytd_cr NUMERIC(12,2),
      period_label TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `DO $vp$
     BEGIN
       IF EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'bd_ops_vp_targets' AND column_name = 'monthly_engineer_target' AND is_nullable = 'NO') THEN
         ALTER TABLE bd_ops_vp_targets ALTER COLUMN monthly_engineer_target DROP NOT NULL;
       END IF;
       IF EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'bd_ops_vp_targets' AND column_name = 'net_engineer_actual' AND is_nullable = 'NO') THEN
         ALTER TABLE bd_ops_vp_targets ALTER COLUMN net_engineer_actual DROP NOT NULL;
       END IF;
       IF EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'bd_ops_vp_targets' AND column_name = 'revenue_fy_target_cr' AND is_nullable = 'NO') THEN
         ALTER TABLE bd_ops_vp_targets ALTER COLUMN revenue_fy_target_cr DROP NOT NULL;
       END IF;
       IF EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'bd_ops_vp_targets' AND column_name = 'revenue_mtd_cr' AND is_nullable = 'NO') THEN
         ALTER TABLE bd_ops_vp_targets ALTER COLUMN revenue_mtd_cr DROP NOT NULL;
       END IF;
     END$vp$`,
    `INSERT INTO bd_ops_vp_targets (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
    "ALTER TABLE engagements ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'",
    "ALTER TABLE engagements ADD COLUMN IF NOT EXISTS end_date DATE",
    "ALTER TABLE engagements ADD COLUMN IF NOT EXISTS end_reason TEXT",
    "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
    "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS submitted_count INTEGER DEFAULT 0",
    "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS interview_count INTEGER DEFAULT 0",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS phase VARCHAR(30) DEFAULT 'discovery'",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget DECIMAL(12,2) DEFAULT 0",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_spend DECIMAL(12,2) DEFAULT 0",
    `CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
      engagement_id INTEGER REFERENCES engagements(id) ON DELETE SET NULL,
      client VARCHAR(100) NOT NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      issued_date DATE NOT NULL,
      due_date DATE NOT NULL,
      paid_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS project_milestones (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      due_date DATE,
      completed BOOLEAN DEFAULT FALSE,
      completed_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS project_talent (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      talent_id INTEGER REFERENCES talent(id) ON DELETE CASCADE,
      role VARCHAR(100),
      joined_date DATE DEFAULT CURRENT_DATE,
      UNIQUE(project_id, talent_id)
    )`,
    `CREATE TABLE IF NOT EXISTS requirement_candidates (
      id SERIAL PRIMARY KEY,
      req_id INTEGER REFERENCES requirements(id) ON DELETE CASCADE,
      talent_id INTEGER REFERENCES talent(id) ON DELETE CASCADE,
      status VARCHAR(30) DEFAULT 'submitted',
      submitted_date DATE DEFAULT CURRENT_DATE,
      feedback TEXT,
      rejection_reason TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
  ];

  for (const s of stmts) {
    await pool.query(s);
    console.log('OK:', s.trim().slice(0, 70));
  }
  await pool.end();
  console.log('\nAll migrations completed successfully.');
}

run().catch(e => { console.error('Migration error:', e.message); process.exit(1); });
