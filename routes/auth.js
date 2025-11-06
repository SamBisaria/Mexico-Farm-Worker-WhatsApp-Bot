const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const router = express.Router();

// Register employer
router.post('/register', async (req, res) => {
  const { email, password, company_name } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO employers (email, password, company_name) VALUES (?, ?, ?)',
      [email, hashedPassword, company_name],
      function(err) {
        if (err) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        res.json({ message: 'Registration successful', id: this.lastID });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get(
    'SELECT * FROM employers WHERE email = ?',
    [email],
    async (err, employer) => {
      if (err || !employer) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const validPassword = await bcrypt.compare(password, employer.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const token = jwt.sign(
        { id: employer.id, email: employer.email, is_admin: employer.is_admin },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.json({ token, company_name: employer.company_name });
    }
  );
});

module.exports = router;