-- TechnoElevate Operations Platform — PostgreSQL Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'View Only',
  initials VARCHAR(4),
  color VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(50),
  bio TEXT,
  timezone VARCHAR(50) DEFAULT 'IST (UTC+5:30)',
  date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  currency VARCHAR(20) DEFAULT 'USD ($)',
  company_name VARCHAR(100) DEFAULT 'TechnoElevate',
  stale_threshold_days INTEGER DEFAULT 3,
  bench_alert_days INTEGER DEFAULT 7,
  notif_stalled_reqs BOOLEAN DEFAULT TRUE,
  notif_expiring_sow BOOLEAN DEFAULT TRUE,
  notif_bench_idle BOOLEAN DEFAULT TRUE,
  notif_invoice_overdue BOOLEAN DEFAULT TRUE,
  notif_email_alerts BOOLEAN DEFAULT TRUE,
  notif_push_alerts BOOLEAN DEFAULT TRUE,
  notif_weekly_digest BOOLEAN DEFAULT TRUE,
  notif_daily_standup BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attention_issues (
  id SERIAL PRIMARY KEY,
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('HIGH','MED','LOW')),
  entity_name VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50),
  issue_description TEXT NOT NULL,
  action_label VARCHAR(100) NOT NULL,
  days_stalled INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS talent (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(100),
  status VARCHAR(30) NOT NULL CHECK (status IN ('bench','in_process','interviewing','offered','deployed')),
  bench_start_date DATE,
  idle_hours INTEGER DEFAULT 0,
  current_client VARCHAR(100),
  skills TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bench_idle_weekly (
  id SERIAL PRIMARY KEY,
  week_label VARCHAR(20) NOT NULL,
  week_start DATE NOT NULL,
  total_hours INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS requirements (
  id SERIAL PRIMARY KEY,
  req_id VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  client VARCHAR(100),
  stage VARCHAR(30) NOT NULL CHECK (stage IN ('intake','sourcing','submission','screening','interviewing','closure')),
  days_in_stage INTEGER DEFAULT 0,
  stalled BOOLEAN DEFAULT FALSE,
  priority VARCHAR(10) DEFAULT 'MED',
  role_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  client VARCHAR(100),
  stage VARCHAR(30) NOT NULL CHECK (stage IN ('green','at_risk','blocked','completed')),
  blocking_issue TEXT,
  team_size INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  utilization_pct INTEGER DEFAULT 0,
  industry VARCHAR(100),
  sector VARCHAR(100),
  geography VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add new columns to existing projects table (safe — skipped if already exist)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS geography VARCHAR(100);

-- Margin tracking: pay_rate on talent, bill_rate + pay_rate on requirements
ALTER TABLE talent ADD COLUMN IF NOT EXISTS pay_rate DECIMAL(10,2) DEFAULT 0;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS bill_rate DECIMAL(10,2) DEFAULT 0;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS pay_rate DECIMAL(10,2) DEFAULT 0;

-- Lead → Requirement traceability
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL;

-- Talent assignment + Contract linkage on requirements
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS assigned_talent_id INTEGER REFERENCES talent(id) ON DELETE SET NULL;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL;

-- Engagement traceability back to requirement
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS req_id INTEGER REFERENCES requirements(id) ON DELETE SET NULL;

-- ── FEATURE ADDITIONS ─────────────────────────────────────────────────────────

-- Engagement closure tracking
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed'));
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS end_reason TEXT;

-- Requirement rejection + candidate count tracking
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS submitted_count INTEGER DEFAULT 0;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS interview_count INTEGER DEFAULT 0;

-- Project delivery phase
ALTER TABLE projects ADD COLUMN IF NOT EXISTS phase VARCHAR(30) DEFAULT 'discovery' CHECK (phase IN ('discovery','design','development','testing','uat','go_live','delivered'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget DECIMAL(12,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_spend DECIMAL(12,2) DEFAULT 0;

-- Invoices (linked to contracts and/or engagements)
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE SET NULL,
  client VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  issued_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','paid','overdue')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Project milestones
CREATE TABLE IF NOT EXISTS project_milestones (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  due_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  completed_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Project team composition (talent assigned to projects)
CREATE TABLE IF NOT EXISTS project_talent (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  talent_id INTEGER REFERENCES talent(id) ON DELETE CASCADE,
  role VARCHAR(100),
  joined_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(project_id, talent_id)
);

-- Multiple candidates per requirement
CREATE TABLE IF NOT EXISTS requirement_candidates (
  id SERIAL PRIMARY KEY,
  req_id INTEGER REFERENCES requirements(id) ON DELETE CASCADE,
  talent_id INTEGER REFERENCES talent(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'submitted' CHECK (status IN ('submitted','screening','interviewing','offered','rejected','placed')),
  submitted_date DATE DEFAULT CURRENT_DATE,
  feedback TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_studies (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  client VARCHAR(100),
  industry VARCHAR(100),
  sector VARCHAR(100),
  challenge TEXT,
  solution TEXT,
  results TEXT,
  metrics JSONB DEFAULT '{}',
  tags TEXT[],
  published BOOLEAN DEFAULT FALSE,
  ai_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_documents (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  doc_type VARCHAR(30) DEFAULT 'Other' CHECK (doc_type IN ('RFP','SOW','Proposal','Amendment','Other')),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  sow_id VARCHAR(50) NOT NULL,
  client VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  value DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(30) NOT NULL CHECK (status IN ('active','expiring_soon','expired')),
  invoice_overdue BOOLEAN DEFAULT FALSE,
  invoice_amount DECIMAL(12,2) DEFAULT 0,
  utilization_pct INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engagements (
  id SERIAL PRIMARY KEY,
  talent_id INTEGER REFERENCES talent(id),
  talent_name VARCHAR(100),
  client VARCHAR(100) NOT NULL,
  role VARCHAR(100),
  start_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engagement_checklist_items (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id),
  stage_number INTEGER NOT NULL,
  stage_name VARCHAR(100) NOT NULL,
  item_name VARCHAR(200) NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  due_date DATE,
  overdue BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS health_metrics (
  id SERIAL PRIMARY KEY,
  metric_key VARCHAR(50) UNIQUE NOT NULL,
  metric_label VARCHAR(100) NOT NULL,
  metric_value DECIMAL(12,2),
  metric_unit VARCHAR(20),
  trend VARCHAR(10) CHECK (trend IN ('up','down','flat')),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(100) NOT NULL,
  contact_name VARCHAR(100),
  contact_email VARCHAR(150),
  contact_phone VARCHAR(50),
  source VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','proposal_sent','negotiation','won','lost')),
  estimated_value DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  follow_up_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
