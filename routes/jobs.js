const express = require('express');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { sendJobToWorkers } = require('./whatsapp');
const router = express.Router();

// Get all jobs (for employers)
router.get('/', authenticateToken, (req, res) => {
  const query = req.user.is_admin 
    ? 'SELECT * FROM jobs WHERE active = 1'
    : 'SELECT * FROM jobs WHERE employer_id = ? AND active = 1';
  
  const params = req.user.is_admin ? [] : [req.user.id];
  
  db.all(query, params, (err, jobs) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(jobs);
  });
});

// Create new job
router.post('/', authenticateToken, async (req, res) => {
  const { title, location, pay_rate, pay_type, transport_provided, duration, description, date, latitude, longitude, address } = req.body;
  
  // Import geocoder
  const { geocodeAddress } = require('../utils/geocoder');

  // Get coordinates - either from request or geocode the address
  let lat = latitude;
  let lng = longitude;
  let finalAddress = address || location;

  if (!lat && !lng && (address || location)) {
    // Geocode the address
    const coords = await geocodeAddress(address || location);
    if (coords) {
      lat = coords.latitude;
      lng = coords.longitude;
      finalAddress = coords.formattedAddress || address || location;
    }
  }
  
  db.run(
    `INSERT INTO jobs (employer_id, title, location, pay_rate, pay_type, transport_provided, duration, description, date, latitude, longitude, address) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, title, finalAddress, pay_rate, pay_type, transport_provided, duration, description, date, lat, lng, finalAddress],
    async function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Send WhatsApp notifications to recommended workers
      const jobId = this.lastID;
      await sendJobToWorkers({
        id: jobId,
        title,
        location: finalAddress,
        pay_rate,
        pay_type,
        transport_provided,
        duration,
        date,
        latitude: lat,
        longitude: lng,
        address: finalAddress
      });
      
      res.json({ message: 'Job posted successfully', id: jobId });
    }
  );
});

// Delete job
router.delete('/:id', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  const query = req.user.is_admin
    ? 'UPDATE jobs SET active = 0 WHERE id = ?'
    : 'UPDATE jobs SET active = 0 WHERE id = ? AND employer_id = ?';
  
  const params = req.user.is_admin ? [jobId] : [jobId, req.user.id];
  
  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }
    res.json({ message: 'Job deleted successfully' });
  });
});

module.exports = router;

// Public endpoint: list active jobs for the website
router.get('/public', (req, res) => {
  db.all(
    'SELECT * FROM jobs WHERE active = 1 AND date >= date("now")',
    [],
    (err, jobs) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(jobs);
    }
  );
});