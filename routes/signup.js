const express = require('express');
const path = require('path');
const db = require('../database/db');
const router = express.Router();

// Serve the signup form (static file in public)
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'signup.html'));
});

// Handle form submission
router.post('/', (req, res) => {
  const { phone, name, zip, age, gender, experience } = req.body;
  if (!phone) return res.status(400).send('Missing phone');

  const cleanPhone = phone.replace(/[^0-9]/g, '');

  // Upsert worker record with provided demographic info
  db.get('SELECT * FROM workers WHERE phone = ?', [cleanPhone], (err, worker) => {
    if (err) return res.status(500).send('Database error');

    if (worker) {
      db.run(
        `UPDATE workers SET name = ?, location = ?, zip = ?, age = ?, gender = ?, experience = ?, active = 1 WHERE phone = ?`,
        [name || worker.name, zip || worker.location, zip || worker.zip, age || worker.age, gender || worker.gender, experience || worker.experience, cleanPhone],
        (updateErr) => {
          if (updateErr) return res.status(500).send('Database error');
          res.sendFile(path.join(__dirname, '..', 'public', 'signup-success.html'));
        }
      );
    } else {
      db.run(
        `INSERT INTO workers (phone, name, location, zip, age, gender, experience) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [cleanPhone, name || null, zip || null, zip || null, age || null, gender || null, experience || null],
        (insertErr) => {
          if (insertErr) return res.status(500).send('Database error');
          res.sendFile(path.join(__dirname, '..', 'public', 'signup-success.html'));
        }
      );
    }
  });
});

module.exports = router;
