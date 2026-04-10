-- TechnoElevate Operations Platform — PostgreSQL Schema

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
  created_at TIMESTAMP DEFAULT NOW()
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
