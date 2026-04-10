require('dotenv').config();
const pool = require('./db');
const fs = require('fs');
const path = require('path');

async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Schema created.');
}

async function seed() {
  await runSchema();

  // Clear existing data
  await pool.query(`TRUNCATE attention_issues, bench_idle_weekly, requirements, projects, contracts, engagement_checklist_items, engagements, talent, health_metrics RESTART IDENTITY CASCADE`);

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
    INSERT INTO talent (name, role, status, bench_start_date, idle_hours, current_client, skills) VALUES
    ('John Doe', 'MERN Developer', 'bench', '2026-03-15', 72, NULL, ARRAY['React','Node.js','MongoDB']),
    ('Priya Singh', 'DevOps Engineer', 'bench', '2026-03-20', 48, NULL, ARRAY['AWS','Docker','Kubernetes']),
    ('Mark Chen', 'Data Scientist', 'bench', '2026-03-25', 32, NULL, ARRAY['Python','TensorFlow','SQL']),
    ('Sarah Patel', 'Java Backend Dev', 'bench', '2026-04-01', 24, NULL, ARRAY['Java','Spring Boot','PostgreSQL']),
    ('Alex Kim', 'React Developer', 'bench', '2026-04-05', 16, NULL, ARRAY['React','TypeScript','GraphQL']),
    ('Tom Rivera', 'Cloud Architect', 'bench', '2026-04-07', 8, NULL, ARRAY['AWS','Azure','Terraform']),
    ('Nina Okafor', 'Business Analyst', 'bench', '2026-04-08', 4, NULL, ARRAY['JIRA','Confluence','SQL']),
    ('Ravi Kumar', 'Full Stack Dev', 'bench', '2026-04-09', 2, NULL, ARRAY['Vue.js','Python','Django']),
    ('Lisa Wong', 'QA Engineer', 'bench', '2026-04-09', 2, NULL, ARRAY['Selenium','Cypress','JIRA']),
    ('James Hall', 'UI/UX Designer', 'bench', '2026-04-10', 0, NULL, ARRAY['Figma','Adobe XD','CSS']),
    ('Maria Garcia', 'Project Manager', 'bench', '2026-04-10', 0, NULL, ARRAY['PMP','Agile','JIRA']),
    ('David Park', 'Security Engineer', 'bench', '2026-04-10', 0, NULL, ARRAY['Penetration Testing','SIEM','ISO27001']),
    ('Emma Johnson', 'MERN Developer', 'in_process', NULL, 0, 'Tesla', ARRAY['React','Node.js','MongoDB']),
    ('Carlos Mendez', 'DevOps Engineer', 'in_process', NULL, 0, 'Nvidia', ARRAY['AWS','CI/CD','Docker']),
    ('Anita Roy', 'Data Engineer', 'in_process', NULL, 0, 'Microsoft', ARRAY['Spark','Kafka','Python']),
    ('Brian Lee', 'Backend Dev', 'in_process', NULL, 0, 'Apple', ARRAY['Go','gRPC','PostgreSQL']),
    ('Sophie Turner', 'Cloud Architect', 'in_process', NULL, 0, 'Amazon', ARRAY['AWS','CDK','Lambda']),
    ('Omar Hassan', 'React Dev', 'in_process', NULL, 0, 'Google', ARRAY['React','TypeScript','Redux']),
    ('Zoe Adams', 'QA Lead', 'in_process', NULL, 0, 'Meta', ARRAY['Automation','Selenium','TestNG']),
    ('Victor Ruiz', 'Java Dev', 'in_process', NULL, 0, 'Oracle', ARRAY['Java','Spring','Hibernate']),
    ('Alice Brown', 'MERN Dev', 'in_process', NULL, 0, 'IBM', ARRAY['React','Express','MongoDB']),
    ('Kevin White', 'Data Scientist', 'in_process', NULL, 0, 'Salesforce', ARRAY['Python','ML','NLP']),
    ('Hannah Clark', 'DevOps', 'in_process', NULL, 0, 'Cisco', ARRAY['Jenkins','Ansible','Terraform']),
    ('Michael Scott', 'PM', 'in_process', NULL, 0, 'SAP', ARRAY['Agile','Scrum','Kanban']),
    ('Lily Nguyen', 'UI Dev', 'in_process', NULL, 0, 'HP', ARRAY['React','CSS','Figma']),
    ('Daniel Kim', 'Full Stack', 'in_process', NULL, 0, 'Dell', ARRAY['Next.js','FastAPI','Redis']),
    ('Ava Martinez', 'Cloud Eng', 'in_process', NULL, 0, 'VMware', ARRAY['Azure','Terraform','Kubernetes']),
    ('Ethan Wilson', 'Security', 'in_process', NULL, 0, 'Crowdstrike', ARRAY['SIEM','Splunk','Python']),
    ('Isabella Thomas', 'BA', 'in_process', NULL, 0, 'Deloitte', ARRAY['Requirements','JIRA','Tableau']),
    ('Noah Jackson', 'Backend', 'in_process', NULL, 0, 'Accenture', ARRAY['Python','Django','PostgreSQL']),
    ('Mia White', 'React Dev', 'interviewing', NULL, 0, 'Tesla', ARRAY['React','Redux','Jest']),
    ('Lucas Harris', 'Java Dev', 'interviewing', NULL, 0, 'Nvidia', ARRAY['Java','Spring','Kafka']),
    ('Charlotte Martin', 'Data Eng', 'interviewing', NULL, 0, 'Microsoft', ARRAY['Python','Airflow','Spark']),
    ('Liam Thompson', 'DevOps', 'interviewing', NULL, 0, 'Google', ARRAY['GCP','Terraform','Helm']),
    ('Amelia Garcia', 'Full Stack', 'interviewing', NULL, 0, 'Amazon', ARRAY['Node.js','React','DynamoDB']),
    ('Mason Lee', 'Cloud Arch', 'interviewing', NULL, 0, 'Apple', ARRAY['AWS','Serverless','CDK']),
    ('Ella Robinson', 'QA', 'interviewing', NULL, 0, 'Meta', ARRAY['Appium','Postman','BDD']),
    ('Aiden Walker', 'MERN Dev', 'interviewing', NULL, 0, 'Stripe', ARRAY['MongoDB','Express','React','Node.js']),
    ('Sophia Hall', 'BE Dev', 'offered', NULL, 0, 'Tesla', ARRAY['Python','FastAPI','PostgreSQL']),
    ('James Allen', 'Architect', 'offered', NULL, 0, 'Nvidia', ARRAY['AWS','Microservices','Docker']),
    ('Olivia Young', 'PM', 'offered', NULL, 0, 'Microsoft', ARRAY['PMP','Agile','Risk Mgmt']),
    ('William Hernandez', 'FE Dev', 'offered', NULL, 0, 'Google', ARRAY['Angular','TypeScript','Nx']),
    ('Harper King', 'Data Scientist', 'deployed', NULL, 0, 'Tesla', ARRAY['TensorFlow','PyTorch','SQL']),
    ('Benjamin Wright', 'DevOps', 'deployed', NULL, 0, 'Nvidia', ARRAY['AWS','Ansible','Jenkins']),
    ('Evelyn Lopez', 'Java Dev', 'deployed', NULL, 0, 'Microsoft', ARRAY['Java','Spring Boot','Kubernetes']),
    ('Alexander Scott', 'React Dev', 'deployed', NULL, 0, 'Google', ARRAY['React','GraphQL','TypeScript']),
    ('Abigail Green', 'Cloud Arch', 'deployed', NULL, 0, 'Amazon', ARRAY['AWS','CDK','Lambda']),
    ('Michael Adams', 'Full Stack', 'deployed', NULL, 0, 'Apple', ARRAY['MERN','GraphQL','Redis'])
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
    INSERT INTO requirements (req_id, title, client, stage, days_in_stage, stalled, priority, role_type) VALUES
    ('Req-401', 'Senior React Developer', 'Tesla', 'intake', 1, false, 'HIGH', 'Frontend'),
    ('Req-402', 'MERN Stack Developer', 'Nvidia', 'sourcing', 4, true, 'HIGH', 'Full Stack'),
    ('Req-403', 'Cloud Architect', 'Microsoft', 'sourcing', 2, false, 'MED', 'Cloud'),
    ('Req-404', 'DevOps Engineer', 'Google', 'sourcing', 1, false, 'HIGH', 'DevOps'),
    ('Req-405', 'Data Scientist', 'Amazon', 'submission', 3, false, 'MED', 'Data'),
    ('Req-406', 'Java Backend Dev', 'Apple', 'submission', 2, false, 'HIGH', 'Backend'),
    ('Req-407', 'Security Engineer', 'Meta', 'submission', 1, false, 'MED', 'Security'),
    ('Req-408', 'UI/UX Designer', 'Stripe', 'submission', 2, false, 'LOW', 'Design'),
    ('Req-409', 'QA Automation Eng', 'Tesla', 'screening', 2, false, 'MED', 'QA'),
    ('Req-410', 'Python Developer', 'Nvidia', 'screening', 3, false, 'HIGH', 'Backend'),
    ('Req-411', 'Kubernetes Admin', 'Microsoft', 'screening', 1, false, 'HIGH', 'DevOps'),
    ('Req-412', 'Product Manager', 'Google', 'screening', 2, false, 'MED', 'PM'),
    ('Req-413', 'AI/ML Engineer', 'Amazon', 'screening', 1, false, 'HIGH', 'AI/ML'),
    ('Req-414', 'Full Stack (MERN)', 'IBM', 'screening', 3, false, 'MED', 'Full Stack'),
    ('Req-415', 'React Native Dev', 'Apple', 'interviewing', 2, false, 'HIGH', 'Mobile'),
    ('Req-416', 'Go Developer', 'Meta', 'interviewing', 1, false, 'MED', 'Backend'),
    ('Req-417', 'Data Engineer', 'Stripe', 'interviewing', 3, false, 'HIGH', 'Data'),
    ('Req-418', 'Angular Developer', 'Oracle', 'interviewing', 1, false, 'MED', 'Frontend'),
    ('Req-419', 'Site Reliability Eng', 'Tesla', 'interviewing', 2, false, 'HIGH', 'DevOps'),
    ('Req-420', 'Business Analyst', 'Nvidia', 'interviewing', 1, false, 'LOW', 'BA'),
    ('Req-421', 'Scrum Master', 'Microsoft', 'closure', 1, false, 'MED', 'PM'),
    ('Req-389', 'Senior Java Architect', 'Google', 'closure', 5, true, 'HIGH', 'Architecture'),
    ('Req-390', 'Cloud DevOps Lead', 'Amazon', 'intake', 0, false, 'HIGH', 'Cloud/DevOps'),
    ('Req-391', 'React Developer', 'Netflix', 'sourcing', 1, false, 'MED', 'Frontend'),
    ('Req-392', 'Python ML Engineer', 'Uber', 'sourcing', 2, false, 'HIGH', 'AI/ML'),
    ('Req-393', 'Full Stack PHP', 'Airbnb', 'submission', 1, false, 'LOW', 'Full Stack'),
    ('Req-394', 'iOS Developer', 'Apple', 'screening', 2, false, 'MED', 'Mobile'),
    ('Req-395', 'Android Developer', 'Google', 'interviewing', 1, false, 'MED', 'Mobile'),
    ('Req-396', 'Blockchain Dev', 'Coinbase', 'intake', 0, false, 'HIGH', 'Blockchain'),
    ('Req-397', 'Salesforce Admin', 'SAP', 'sourcing', 1, false, 'LOW', 'CRM')
  `);

  // Projects
  await pool.query(`
    INSERT INTO projects (name, client, stage, blocking_issue, team_size, start_date, end_date, utilization_pct) VALUES
    ('Project Alpha', 'Tesla', 'green', NULL, 8, '2026-01-15', '2026-07-15', 94),
    ('Project Beta', 'Nvidia', 'green', NULL, 6, '2026-02-01', '2026-08-01', 88),
    ('Project Delta', 'Microsoft', 'blocked', 'Integration API failing — vendor delay', 5, '2026-01-20', '2026-06-20', 62),
    ('Project Orion', 'Google', 'at_risk', 'Resource gap: need 2 more Java Devs', 4, '2026-03-01', '2026-09-01', 68),
    ('Project Phoenix', 'Amazon', 'green', NULL, 10, '2025-10-01', '2026-04-30', 91),
    ('Project Sigma', 'Apple', 'at_risk', 'Scope creep — change request pending', 7, '2026-02-15', '2026-10-15', 74),
    ('Project Zeta', 'Meta', 'green', NULL, 5, '2026-03-10', '2026-09-10', 87),
    ('Project Titan', 'Stripe', 'blocked', 'Security audit hold — compliance issue', 3, '2026-01-05', '2026-05-05', 55),
    ('Project Nova', 'Oracle', 'completed', NULL, 6, '2025-06-01', '2026-03-31', 100),
    ('Project Pulse', 'IBM', 'green', NULL, 9, '2026-04-01', '2026-12-31', 82)
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

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
