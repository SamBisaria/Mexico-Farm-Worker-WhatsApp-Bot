const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'jobs.db'));

// Initialize database tables
db.serialize(() => {
  // Workers table
  db.run(`CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    location TEXT,
    language TEXT DEFAULT 'es',
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Employers table
  db.run(`CREATE TABLE IF NOT EXISTS employers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    company_name TEXT,
    is_admin BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Jobs table
  db.run(`CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employer_id INTEGER,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    pay_rate TEXT NOT NULL,
    pay_type TEXT NOT NULL,
    transport_provided BOOLEAN DEFAULT 0,
    duration TEXT,
    description TEXT,
    date TEXT NOT NULL,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employer_id) REFERENCES employers (id)
  )`);

  // Job applications table (for tracking)
  db.run(`CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id INTEGER,
    job_id INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers (id),
    FOREIGN KEY (job_id) REFERENCES jobs (id)
  )`);
  // Ensure worker demographics columns exist (adds columns on existing DBs)
  const requiredWorkerColumns = [
    { name: 'zip', def: 'TEXT' },
    { name: 'age', def: 'INTEGER' },
    { name: 'gender', def: 'TEXT' },
    { name: 'experience', def: 'INTEGER' },
    { name: 'latitude', def: 'REAL' },
    { name: 'longitude', def: 'REAL' },
    { name: 'address', def: 'TEXT' }
  ];

  db.all("PRAGMA table_info('workers')", (err, rows) => {
    if (err) {
      console.error('Failed reading workers table info', err);
    } else {
      const existing = rows.map(r => r.name);
      requiredWorkerColumns.forEach(col => {
        if (!existing.includes(col.name)) {
          db.run(`ALTER TABLE workers ADD COLUMN ${col.name} ${col.def}`);
        }
      });
    }
  });

  // Ensure job location columns exist
  const requiredJobColumns = [
    { name: 'latitude', def: 'REAL' },
    { name: 'longitude', def: 'REAL' },
    { name: 'address', def: 'TEXT' }
  ];

  db.all("PRAGMA table_info('jobs')", (err, rows) => {
    if (err) {
      console.error('Failed reading jobs table info', err);
    } else {
      const existing = rows.map(r => r.name);
      requiredJobColumns.forEach(col => {
        if (!existing.includes(col.name)) {
          db.run(`ALTER TABLE jobs ADD COLUMN ${col.name} ${col.def}`);
        }
      });
    }
  });

  console.log('Database initialized');
});

module.exports = db;