require('dotenv').config();
const pool = require('./db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Schema created.');
}

async function seed() {
  await runSchema();

  // Clear existing data
  await pool.query(`TRUNCATE project_documents, case_studies, user_settings, users, attention_issues, bench_idle_weekly, requirements, projects, contracts, engagement_checklist_items, engagements, talent, health_metrics, leads RESTART IDENTITY CASCADE`);

  // Users
  const adminHash   = await bcrypt.hash('admin123', 10);
  const opsHash     = await bcrypt.hash('ops123', 10);
  await pool.query(`
    INSERT INTO users (name, email, password_hash, role, initials, color) VALUES
    ('Sarah K.',    'sarah@techno.com', $1, 'Delivery Lead',  'SK', 'linear-gradient(135deg, #4f7cff, #a55eea)'),
    ('Admin User',  'admin@techno.com', $1, 'Administrator',  'AU', 'linear-gradient(135deg, #ff4757, #a55eea)'),
    ('Ops Manager', 'ops@techno.com',   $2, 'Operations',     'OM', 'linear-gradient(135deg, #2ed573, #4f7cff)')
  `, [adminHash, opsHash]);

  // Default settings for each user
  const users = await pool.query('SELECT id FROM users');
  for (const u of users.rows) {
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [u.id]);
  }

  // Attention Issues
  await pool.query(`
    INSERT INTO attention_issues (priority, entity_name, entity_type, entity_id, issue_description, action_label, days_stalled) VALUES
    ('HIGH', 'Req-402', 'requirement', 'Req-402', 'No profile submissions', 'Source Now', 4),
    ('HIGH', 'SOW-Tesla-2026', 'contract', 'SOW-Tesla-2026', 'Expiring in 6 days', 'Renew SOW', 0),
    ('MED', 'Project-Delta', 'project', 'proj-delta', 'Blocking issue open', 'Resolve Block', 3),
    ('MED', 'John Doe', 'talent', 'talent-1', 'On bench, no active req', 'Assign to Req', 7),
    ('HIGH', 'Req-389', 'requirement', 'Req-389', 'Client feedback pending 5 days', 'Follow Up', 5),
    ('MED', 'SOW-Nvidia-2025', 'contract', 'SOW-Nvidia-2025', 'Invoice overdue $12,400', 'Send Invoice', 0),
    ('LOW', 'Project-Orion', 'project', 'proj-orion', 'Utilization below 70%', 'Review Team', 2)
  `);

  // Talent
  await pool.query(`
    INSERT INTO talent (name, role, status, bench_start_date, idle_hours, current_client, skills, pay_rate) VALUES
    ('John Doe', 'MERN Developer', 'bench', '2026-03-15', 72, NULL, ARRAY['React','Node.js','MongoDB'], 9500),
    ('Priya Singh', 'DevOps Engineer', 'bench', '2026-03-20', 48, NULL, ARRAY['AWS','Docker','Kubernetes'], 10500),
    ('Mark Chen', 'Data Scientist', 'bench', '2026-03-25', 32, NULL, ARRAY['Python','TensorFlow','SQL'], 11000),
    ('Sarah Patel', 'Java Backend Dev', 'bench', '2026-04-01', 24, NULL, ARRAY['Java','Spring Boot','PostgreSQL'], 9800),
    ('Alex Kim', 'React Developer', 'bench', '2026-04-05', 16, NULL, ARRAY['React','TypeScript','GraphQL'], 9200),
    ('Tom Rivera', 'Cloud Architect', 'bench', '2026-04-07', 8, NULL, ARRAY['AWS','Azure','Terraform'], 13500),
    ('Nina Okafor', 'Business Analyst', 'bench', '2026-04-08', 4, NULL, ARRAY['JIRA','Confluence','SQL'], 7800),
    ('Ravi Kumar', 'Full Stack Dev', 'bench', '2026-04-09', 2, NULL, ARRAY['Vue.js','Python','Django'], 9000),
    ('Lisa Wong', 'QA Engineer', 'bench', '2026-04-09', 2, NULL, ARRAY['Selenium','Cypress','JIRA'], 7500),
    ('James Hall', 'UI/UX Designer', 'bench', '2026-04-10', 0, NULL, ARRAY['Figma','Adobe XD','CSS'], 8200),
    ('Maria Garcia', 'Project Manager', 'bench', '2026-04-10', 0, NULL, ARRAY['PMP','Agile','JIRA'], 10000),
    ('David Park', 'Security Engineer', 'bench', '2026-04-10', 0, NULL, ARRAY['Penetration Testing','SIEM','ISO27001'], 12000),
    ('Emma Johnson', 'MERN Developer', 'in_process', NULL, 0, 'Tesla', ARRAY['React','Node.js','MongoDB'], 9500),
    ('Carlos Mendez', 'DevOps Engineer', 'in_process', NULL, 0, 'Nvidia', ARRAY['AWS','CI/CD','Docker'], 10500),
    ('Anita Roy', 'Data Engineer', 'in_process', NULL, 0, 'Microsoft', ARRAY['Spark','Kafka','Python'], 10800),
    ('Brian Lee', 'Backend Dev', 'in_process', NULL, 0, 'Apple', ARRAY['Go','gRPC','PostgreSQL'], 9800),
    ('Sophie Turner', 'Cloud Architect', 'in_process', NULL, 0, 'Amazon', ARRAY['AWS','CDK','Lambda'], 13500),
    ('Omar Hassan', 'React Dev', 'in_process', NULL, 0, 'Google', ARRAY['React','TypeScript','Redux'], 9200),
    ('Zoe Adams', 'QA Lead', 'in_process', NULL, 0, 'Meta', ARRAY['Automation','Selenium','TestNG'], 8500),
    ('Victor Ruiz', 'Java Dev', 'in_process', NULL, 0, 'Oracle', ARRAY['Java','Spring','Hibernate'], 9800),
    ('Alice Brown', 'MERN Dev', 'in_process', NULL, 0, 'IBM', ARRAY['React','Express','MongoDB'], 9500),
    ('Kevin White', 'Data Scientist', 'in_process', NULL, 0, 'Salesforce', ARRAY['Python','ML','NLP'], 11000),
    ('Hannah Clark', 'DevOps', 'in_process', NULL, 0, 'Cisco', ARRAY['Jenkins','Ansible','Terraform'], 10500),
    ('Michael Scott', 'PM', 'in_process', NULL, 0, 'SAP', ARRAY['Agile','Scrum','Kanban'], 10000),
    ('Lily Nguyen', 'UI Dev', 'in_process', NULL, 0, 'HP', ARRAY['React','CSS','Figma'], 8200),
    ('Daniel Kim', 'Full Stack', 'in_process', NULL, 0, 'Dell', ARRAY['Next.js','FastAPI','Redis'], 9000),
    ('Ava Martinez', 'Cloud Eng', 'in_process', NULL, 0, 'VMware', ARRAY['Azure','Terraform','Kubernetes'], 12500),
    ('Ethan Wilson', 'Security', 'in_process', NULL, 0, 'Crowdstrike', ARRAY['SIEM','Splunk','Python'], 12000),
    ('Isabella Thomas', 'BA', 'in_process', NULL, 0, 'Deloitte', ARRAY['Requirements','JIRA','Tableau'], 7800),
    ('Noah Jackson', 'Backend', 'in_process', NULL, 0, 'Accenture', ARRAY['Python','Django','PostgreSQL'], 9800),
    ('Mia White', 'React Dev', 'interviewing', NULL, 0, 'Tesla', ARRAY['React','Redux','Jest'], 9200),
    ('Lucas Harris', 'Java Dev', 'interviewing', NULL, 0, 'Nvidia', ARRAY['Java','Spring','Kafka'], 9800),
    ('Charlotte Martin', 'Data Eng', 'interviewing', NULL, 0, 'Microsoft', ARRAY['Python','Airflow','Spark'], 10800),
    ('Liam Thompson', 'DevOps', 'interviewing', NULL, 0, 'Google', ARRAY['GCP','Terraform','Helm'], 10500),
    ('Amelia Garcia', 'Full Stack', 'interviewing', NULL, 0, 'Amazon', ARRAY['Node.js','React','DynamoDB'], 9000),
    ('Mason Lee', 'Cloud Arch', 'interviewing', NULL, 0, 'Apple', ARRAY['AWS','Serverless','CDK'], 13500),
    ('Ella Robinson', 'QA', 'interviewing', NULL, 0, 'Meta', ARRAY['Appium','Postman','BDD'], 7500),
    ('Aiden Walker', 'MERN Dev', 'interviewing', NULL, 0, 'Stripe', ARRAY['MongoDB','Express','React','Node.js'], 9500),
    ('Sophia Hall', 'BE Dev', 'offered', NULL, 0, 'Tesla', ARRAY['Python','FastAPI','PostgreSQL'], 9800),
    ('James Allen', 'Architect', 'offered', NULL, 0, 'Nvidia', ARRAY['AWS','Microservices','Docker'], 14000),
    ('Olivia Young', 'PM', 'offered', NULL, 0, 'Microsoft', ARRAY['PMP','Agile','Risk Mgmt'], 10000),
    ('William Hernandez', 'FE Dev', 'offered', NULL, 0, 'Google', ARRAY['Angular','TypeScript','Nx'], 9200),
    ('Harper King', 'Data Scientist', 'deployed', NULL, 0, 'Tesla', ARRAY['TensorFlow','PyTorch','SQL'], 11000),
    ('Benjamin Wright', 'DevOps', 'deployed', NULL, 0, 'Nvidia', ARRAY['AWS','Ansible','Jenkins'], 10500),
    ('Evelyn Lopez', 'Java Dev', 'deployed', NULL, 0, 'Microsoft', ARRAY['Java','Spring Boot','Kubernetes'], 9800),
    ('Alexander Scott', 'React Dev', 'deployed', NULL, 0, 'Google', ARRAY['React','GraphQL','TypeScript'], 9200),
    ('Abigail Green', 'Cloud Arch', 'deployed', NULL, 0, 'Amazon', ARRAY['AWS','CDK','Lambda'], 13500),
    ('Michael Adams', 'Full Stack', 'deployed', NULL, 0, 'Apple', ARRAY['MERN','GraphQL','Redis'], 9000)
  `);

  // Bench Idle Weekly
  await pool.query(`
    INSERT INTO bench_idle_weekly (week_label, week_start, total_hours) VALUES
    ('Week 1', '2026-03-16', 88),
    ('Week 2', '2026-03-23', 140),
    ('Week 3', '2026-03-30', 220),
    ('Week 4', '2026-04-06', 360)
  `);

  // Requirements Pipeline
  await pool.query(`
    INSERT INTO requirements (req_id, title, client, stage, days_in_stage, stalled, priority, role_type, bill_rate, pay_rate) VALUES
    ('Req-401', 'Senior React Developer', 'Tesla', 'intake', 1, false, 'HIGH', 'Frontend', 16000, 9200),
    ('Req-402', 'MERN Stack Developer', 'Nvidia', 'sourcing', 4, true, 'HIGH', 'Full Stack', 17000, 9500),
    ('Req-403', 'Cloud Architect', 'Microsoft', 'sourcing', 2, false, 'MED', 'Cloud', 22000, 13500),
    ('Req-404', 'DevOps Engineer', 'Google', 'sourcing', 1, false, 'HIGH', 'DevOps', 18000, 10500),
    ('Req-405', 'Data Scientist', 'Amazon', 'submission', 3, false, 'MED', 'Data', 19000, 11000),
    ('Req-406', 'Java Backend Dev', 'Apple', 'submission', 2, false, 'HIGH', 'Backend', 16500, 9800),
    ('Req-407', 'Security Engineer', 'Meta', 'submission', 1, false, 'MED', 'Security', 20000, 12000),
    ('Req-408', 'UI/UX Designer', 'Stripe', 'submission', 2, false, 'LOW', 'Design', 13500, 8200),
    ('Req-409', 'QA Automation Eng', 'Tesla', 'screening', 2, false, 'MED', 'QA', 12500, 7500),
    ('Req-410', 'Python Developer', 'Nvidia', 'screening', 3, false, 'HIGH', 'Backend', 16000, 9800),
    ('Req-411', 'Kubernetes Admin', 'Microsoft', 'screening', 1, false, 'HIGH', 'DevOps', 18000, 10500),
    ('Req-412', 'Product Manager', 'Google', 'screening', 2, false, 'MED', 'PM', 16500, 10000),
    ('Req-413', 'AI/ML Engineer', 'Amazon', 'screening', 1, false, 'HIGH', 'AI/ML', 21000, 13000),
    ('Req-414', 'Full Stack (MERN)', 'IBM', 'screening', 3, false, 'MED', 'Full Stack', 15500, 9500),
    ('Req-415', 'React Native Dev', 'Apple', 'interviewing', 2, false, 'HIGH', 'Mobile', 17000, 10000),
    ('Req-416', 'Go Developer', 'Meta', 'interviewing', 1, false, 'MED', 'Backend', 17500, 10500),
    ('Req-417', 'Data Engineer', 'Stripe', 'interviewing', 3, false, 'HIGH', 'Data', 18000, 10800),
    ('Req-418', 'Angular Developer', 'Oracle', 'interviewing', 1, false, 'MED', 'Frontend', 15000, 9200),
    ('Req-419', 'Site Reliability Eng', 'Tesla', 'interviewing', 2, false, 'HIGH', 'DevOps', 19500, 11500),
    ('Req-420', 'Business Analyst', 'Nvidia', 'interviewing', 1, false, 'LOW', 'BA', 13000, 7800),
    ('Req-421', 'Scrum Master', 'Microsoft', 'closure', 1, false, 'MED', 'PM', 15000, 9500),
    ('Req-389', 'Senior Java Architect', 'Google', 'closure', 5, true, 'HIGH', 'Architecture', 23000, 14000),
    ('Req-390', 'Cloud DevOps Lead', 'Amazon', 'intake', 0, false, 'HIGH', 'Cloud/DevOps', 21000, 12500),
    ('Req-391', 'React Developer', 'Netflix', 'sourcing', 1, false, 'MED', 'Frontend', 16000, 9200),
    ('Req-392', 'Python ML Engineer', 'Uber', 'sourcing', 2, false, 'HIGH', 'AI/ML', 20000, 12500),
    ('Req-393', 'Full Stack PHP', 'Airbnb', 'submission', 1, false, 'LOW', 'Full Stack', 13000, 8500),
    ('Req-394', 'iOS Developer', 'Apple', 'screening', 2, false, 'MED', 'Mobile', 17500, 10500),
    ('Req-395', 'Android Developer', 'Google', 'interviewing', 1, false, 'MED', 'Mobile', 17000, 10200),
    ('Req-396', 'Blockchain Dev', 'Coinbase', 'intake', 0, false, 'HIGH', 'Blockchain', 22000, 14000),
    ('Req-397', 'Salesforce Admin', 'SAP', 'sourcing', 1, false, 'LOW', 'CRM', 12500, 7500)
  `);

  // Projects (with industry, sector, geography)
  await pool.query(`
    INSERT INTO projects (name, client, stage, blocking_issue, team_size, start_date, end_date, utilization_pct, industry, sector, geography) VALUES
    ('Project Alpha', 'Tesla', 'green', NULL, 8, '2026-01-15', '2026-07-15', 94, 'Manufacturing', 'Electric Vehicles', 'US West'),
    ('Project Beta', 'Nvidia', 'green', NULL, 6, '2026-02-01', '2026-08-01', 88, 'Technology', 'Semiconductors', 'US West'),
    ('Project Delta', 'Microsoft', 'blocked', 'Integration API failing — vendor delay', 5, '2026-01-20', '2026-06-20', 62, 'Technology', 'Cloud & SaaS', 'US West'),
    ('Project Orion', 'Google', 'at_risk', 'Resource gap: need 2 more Java Devs', 4, '2026-03-01', '2026-09-01', 68, 'Technology', 'AI & Search', 'US West'),
    ('Project Phoenix', 'Amazon', 'green', NULL, 10, '2025-10-01', '2026-04-30', 91, 'Retail', 'E-Commerce & Logistics', 'US East'),
    ('Project Sigma', 'Apple', 'at_risk', 'Scope creep — change request pending', 7, '2026-02-15', '2026-10-15', 74, 'Technology', 'Consumer Electronics', 'US West'),
    ('Project Zeta', 'Meta', 'green', NULL, 5, '2026-03-10', '2026-09-10', 87, 'Technology', 'Social Media', 'US West'),
    ('Project Titan', 'Stripe', 'blocked', 'Security audit hold — compliance issue', 3, '2026-01-05', '2026-05-05', 55, 'FinTech', 'Payments', 'US West'),
    ('Project Nova', 'Oracle', 'completed', NULL, 6, '2025-06-01', '2026-03-31', 100, 'Technology', 'Enterprise Software', 'US East'),
    ('Project Pulse', 'IBM', 'green', NULL, 9, '2026-04-01', '2026-12-31', 82, 'Technology', 'Consulting & Services', 'US East')
  `);

  // Contracts
  await pool.query(`
    INSERT INTO contracts (sow_id, client, start_date, end_date, value, status, invoice_overdue, invoice_amount, utilization_pct) VALUES
    ('SOW-Tesla-2026', 'Tesla', '2026-01-01', '2026-04-16', 480000, 'expiring_soon', false, 0, 94),
    ('SOW-Nvidia-2025', 'Nvidia', '2025-06-01', '2026-06-01', 320000, 'active', true, 12400, 88),
    ('SOW-Microsoft-2026', 'Microsoft', '2026-01-01', '2026-12-31', 750000, 'active', false, 0, 62),
    ('SOW-Google-2026', 'Google', '2026-02-01', '2026-08-01', 290000, 'active', false, 0, 68),
    ('SOW-Amazon-2025', 'Amazon', '2025-10-01', '2026-04-30', 560000, 'expiring_soon', false, 0, 91),
    ('SOW-Apple-2026', 'Apple', '2026-02-15', '2026-10-15', 420000, 'active', true, 8800, 74),
    ('SOW-Meta-2026', 'Meta', '2026-03-10', '2026-09-10', 180000, 'active', false, 0, 87),
    ('SOW-Stripe-2026', 'Stripe', '2026-01-05', '2026-05-05', 240000, 'expiring_soon', false, 0, 55),
    ('SOW-Oracle-2025', 'Oracle', '2025-06-01', '2026-03-31', 310000, 'expired', false, 0, 100),
    ('SOW-IBM-2026', 'IBM', '2026-04-01', '2026-12-31', 680000, 'active', false, 0, 82)
  `);

  // Engagements + Checklist
  const engResult = await pool.query(`
    INSERT INTO engagements (talent_name, client, role, start_date) VALUES
    ('Emma Johnson', 'Tesla', 'MERN Developer', '2026-04-01'),
    ('Carlos Mendez', 'Nvidia', 'DevOps Engineer', '2026-03-15'),
    ('Harper King', 'Tesla', 'Data Scientist', '2026-02-01'),
    ('Benjamin Wright', 'Nvidia', 'DevOps Engineer', '2026-01-20'),
    ('Evelyn Lopez', 'Microsoft', 'Java Developer', '2026-03-01')
    RETURNING id, talent_name
  `);

  const stages = [
    { num: 1, name: 'Onboarding Docs' },
    { num: 2, name: 'Background Check' },
    { num: 3, name: 'Client Intro' },
    { num: 4, name: 'Access Provisioning' },
    { num: 5, name: 'First Week Check-in' },
    { num: 6, name: 'Month-1 Review' },
    { num: 7, name: 'Ongoing Compliance' }
  ];

  for (const eng of engResult.rows) {
    const completedCount = eng.talent_name === 'Harper King' ? 7 :
                           eng.talent_name === 'Benjamin Wright' ? 6 :
                           eng.talent_name === 'Evelyn Lopez' ? 5 :
                           eng.talent_name === 'Carlos Mendez' ? 3 : 2;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const completed = i < completedCount;
      const overdue = !completed && i === completedCount && (eng.talent_name === 'Emma Johnson' || eng.talent_name === 'Carlos Mendez');
      const dueDate = new Date('2026-04-10');
      dueDate.setDate(dueDate.getDate() - (stages.length - i) * 7);

      await pool.query(`
        INSERT INTO engagement_checklist_items (engagement_id, stage_number, stage_name, item_name, completed, due_date, overdue) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [eng.id, stage.num, stage.name, `${stage.name} — ${eng.talent_name}`, completed, dueDate.toISOString().split('T')[0], overdue]);
    }
  }

  // Health Metrics
  await pool.query(`
    INSERT INTO health_metrics (metric_key, metric_label, metric_value, metric_unit, trend) VALUES
    ('win_rate', 'Win Rate', 67, '%', 'up'),
    ('avg_time_to_submit', 'Avg Time-to-Submit', 3.2, 'days', 'down'),
    ('revenue_at_risk', 'Revenue at Risk', 142000, 'USD', 'up'),
    ('bench_cost', 'Bench Cost (Monthly)', 38400, 'USD', 'up'),
    ('active_reqs', 'Active Requirements', 30, 'count', 'up'),
    ('deployed_talent', 'Deployed Talent', 142, 'count', 'up'),
    ('active_contracts', 'Active Contracts', 8, 'count', 'flat'),
    ('avg_utilization', 'Avg Utilization', 80.1, '%', 'down')
  `);

  // Leads
  await pool.query(`
    INSERT INTO leads (company_name, contact_name, contact_email, contact_phone, source, status, estimated_value, notes, follow_up_date) VALUES
    ('SpaceX', 'Elon M.', 'elon@spacex.com', '+1 310 555 0101', 'Referral', 'qualified', 350000, 'Looking for 5 backend devs', '2026-04-15'),
    ('OpenAI', 'Sam A.', 'sam@openai.com', '+1 415 555 0202', 'LinkedIn', 'proposal_sent', 580000, 'ML engineers needed', '2026-04-12'),
    ('Stripe', 'Patrick C.', 'pc@stripe.com', '+1 415 555 0303', 'Inbound', 'contacted', 220000, 'React + Node.js team', '2026-04-20'),
    ('Figma', 'Dylan F.', 'dylan@figma.com', '+1 415 555 0404', 'Event', 'new', 140000, 'UX designers and FE devs', '2026-04-18'),
    ('Databricks', 'Ali G.', 'ali@databricks.com', '+1 650 555 0505', 'Partner', 'negotiation', 460000, 'Data engineers + architects', '2026-04-11'),
    ('Vercel', 'Guillermo R.', 'gr@vercel.com', '+1 415 555 0606', 'Cold Outreach', 'won', 180000, 'SOW signed', NULL),
    ('Cloudflare', 'Matthew P.', 'mp@cloudflare.com', '+1 650 555 0707', 'Referral', 'contacted', 290000, 'Security engineers needed', '2026-04-25'),
    ('Notion', 'Ivan Z.', 'ivan@notion.so', '+1 415 555 0808', 'LinkedIn', 'new', 95000, 'Product-focused FE team', '2026-04-30'),
    ('Rippling', 'Parker C.', 'pc@rippling.com', '+1 415 555 0909', 'Inbound', 'qualified', 415000, 'Full-stack platform engineers', '2026-04-22'),
    ('Brex', 'Henrique D.', 'hd@brex.com', '+1 415 555 1010', 'Cold Outreach', 'lost', 260000, 'Went with competitor', NULL)
  `);

  // Case Studies
  await pool.query(`
    INSERT INTO case_studies (project_id, title, client, industry, sector, challenge, solution, results, metrics, tags, published, ai_generated) VALUES
    (1, 'Accelerating EV Manufacturing with Cloud-Native Data Pipelines', 'Tesla', 'Manufacturing', 'Electric Vehicles',
     'Tesla needed to consolidate sensor data from 3 manufacturing plants into a real-time analytics platform to reduce production defect rates and improve line throughput.',
     'TechnoElevate deployed a team of 8 engineers — including data engineers, cloud architects, and React developers — to build a cloud-native pipeline on AWS using Kafka, Spark Streaming, and a React-based operations dashboard.',
     'The platform went live in 18 weeks, reducing defect detection time from 4 hours to under 12 minutes. Production throughput improved by 23% in Q1 2026.',
     '{"defect_detection_improvement": "95%", "throughput_gain": "23%", "time_to_live": "18 weeks", "team_size": "8 engineers", "cost_saved": "$420K annually"}',
     ARRAY['AWS', 'Kafka', 'Spark', 'React', 'Data Engineering'], true, false),

    (5, 'E-Commerce Fulfillment Optimisation for Amazon Logistics', 'Amazon', 'Retail', 'E-Commerce & Logistics',
     'Amazon''s logistics team required a scalable order routing engine capable of processing 2M+ daily transactions with sub-100ms latency to support Prime Day peak loads.',
     'TechnoElevate provided a 10-member cross-functional team to redesign the routing service using Go microservices, AWS Lambda, and DynamoDB, with a Cypress-tested frontend dashboard for operations visibility.',
     'The new routing engine handled 3.4M transactions on Prime Day 2026 with 99.98% uptime and average latency of 67ms — well within SLA targets.',
     '{"peak_tps": "39K TPS", "latency": "67ms avg", "uptime": "99.98%", "prime_day_transactions": "3.4M", "SLA_breaches": "0"}',
     ARRAY['Go', 'AWS Lambda', 'DynamoDB', 'Microservices', 'Cypress'], true, false),

    (8, 'Payments Compliance & Security Modernisation for Stripe', 'Stripe', 'FinTech', 'Payments',
     'Following a PCI-DSS audit, Stripe''s internal platform team identified critical security gaps in their token vaulting service. They needed a specialist team to remediate findings and modernise the service within a tight 16-week window.',
     'TechnoElevate embedded 3 security engineers and 2 backend developers into Stripe''s platform team. The engagement covered threat modelling, encryption key rotation, zero-trust network policy implementation, and comprehensive pen-testing.',
     'All 14 critical and high-severity audit findings were resolved within 12 weeks, 4 weeks ahead of schedule. The team achieved PCI-DSS Level 1 compliance recertification.',
     '{"audit_findings_resolved": "14/14", "weeks_ahead_of_schedule": "4", "compliance_achieved": "PCI-DSS Level 1", "vulnerabilities_patched": "47"}',
     ARRAY['Security', 'PCI-DSS', 'Penetration Testing', 'Zero Trust', 'Encryption'], true, false),

    (9, 'Enterprise ERP Modernisation for Oracle Financial Services', 'Oracle', 'Technology', 'Enterprise Software',
     'Oracle''s financial services division was operating a legacy ERP system built on 15-year-old Java monolith architecture. The system caused $2.1M in annual maintenance costs and had a 4-hour daily maintenance window.',
     'TechnoElevate led the full modernisation — decomposing the monolith into 12 Spring Boot microservices, migrating data to PostgreSQL, and building a new Angular-based self-service portal for 4,000 internal users.',
     'The modernised platform eliminated the daily maintenance window, reduced infra costs by 61%, and improved transaction processing speed by 8x. The project was delivered on time and 7% under budget.',
     '{"maintenance_cost_reduction": "61%", "transaction_speed_improvement": "8x", "maintenance_window_eliminated": "4h/day", "users_migrated": "4000", "delivery": "On time, 7% under budget"}',
     ARRAY['Java', 'Spring Boot', 'Microservices', 'PostgreSQL', 'Angular'], true, false),

    (4, 'AI-Powered Search Infrastructure for Google Cloud', 'Google', 'Technology', 'AI & Search',
     'Google''s Cloud team needed to integrate a vector search capability into their internal developer tools portal to improve documentation discovery across 40,000+ pages.',
     'TechnoElevate deployed a 4-member AI/ML team to design and implement a vector embedding pipeline using Python, OpenAI embeddings, and Pinecone, with a React frontend for semantic search.',
     'Developer documentation discovery time dropped by 74%. The search portal now handles 120K queries/day with p99 latency under 200ms. Internal NPS for the tool went from 34 to 81.',
     '{"search_latency_p99": "< 200ms", "daily_queries": "120K", "discovery_time_reduction": "74%", "nps_improvement": "34 → 81"}',
     ARRAY['Python', 'OpenAI', 'Vector Search', 'Pinecone', 'React', 'AI/ML'], false, false)
  `);

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
