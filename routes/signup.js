const express = require('express');
const path = require('path');
const db = require('../database/db');
const { geocodeAddress } = require('../utils/geocoder');
const router = express.Router();

// Serve the signup form (static file in public)
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'signup.html'));
});

// Handle form submission
router.post('/', async (req, res) => {
  const { phone, name, age, gender, experience, latitude, longitude, address } = req.body;
  if (!phone) return res.status(400).send('Missing phone');

  const cleanPhone = phone.replace(/[^0-9]/g, '');

  // Get coordinates - either from geolocation or geocode the address
  let lat = latitude;
  let lng = longitude;
  let finalAddress = address;

  if (!lat && !lng && address) {
    // Geocode the address
    const coords = await geocodeAddress(address);
    if (coords) {
      lat = coords.latitude;
      lng = coords.longitude;
      finalAddress = coords.formattedAddress || address;
    }
  }

  // Upsert worker record with provided demographic info
  db.get('SELECT * FROM workers WHERE phone = ?', [cleanPhone], (err, worker) => {
    if (err) return res.status(500).send('Database error');

    if (worker) {
      db.run(
        `UPDATE workers SET name = ?, age = ?, gender = ?, experience = ?, latitude = ?, longitude = ?, address = ?, location = ?, active = 1 WHERE phone = ?`,
        [name || worker.name, age || worker.age, gender || worker.gender, experience || worker.experience, lat, lng, finalAddress, finalAddress, cleanPhone],
        (updateErr) => {
          if (updateErr) return res.status(500).send('Database error');
          res.sendFile(path.join(__dirname, '..', 'public', 'signup-success.html'));
        }
      );
    } else {
      db.run(
        `INSERT INTO workers (phone, name, age, gender, experience, latitude, longitude, address, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cleanPhone, name || null, age || null, gender || null, experience || null, lat, lng, finalAddress, finalAddress],
        (insertErr) => {
          if (insertErr) return res.status(500).send('Database error');
          res.sendFile(path.join(__dirname, '..', 'public', 'signup-success.html'));
        }
      );
    }
  });
});

module.exports = router;
