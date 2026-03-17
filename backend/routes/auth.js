const express = require('express');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'ptd_secret_2025';

// Lazy-load heavy deps so server starts even if bcryptjs/jwt not installed
let jwt, bcrypt, User;
try {
  jwt    = require('jsonwebtoken');
  bcrypt = require('bcryptjs');
  User   = require('../models/User');
} catch(e) {
  console.warn('[auth] Optional packages not loaded:', e.message);
}

const signToken = (payload) => {
  if (jwt) return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
  return Buffer.from(JSON.stringify(payload)).toString('base64'); // fallback non-secure token
};

// ── POST /api/auth/login ───────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });

    // ── Hardcoded admin / operator (always works, no DB needed) ──
    const BUILTIN = {
      admin:    { pass: 'admin123',    role: 'admin' },
      operator: { pass: 'operator123', role: 'operator' },
    };
    if (BUILTIN[username] && BUILTIN[username].pass === password) {
      const token = signToken({ username, role: BUILTIN[username].role });
      return res.json({ token, role: BUILTIN[username].role, username, clientName: '' });
    }

    // ── DB Users (bcrypt) ──
    if (User && bcrypt) {
      const user = await User.findOne({ username, active: true });
      if (user) {
        const match = await bcrypt.compare(password, user.password);
        if (match) {
          const token = signToken({ id: user._id, username: user.username, role: user.role, clientName: user.clientName });
          return res.json({ token, role: user.role, username: user.username, clientName: user.clientName });
        }
      }
    }

    return res.status(401).json({ error: 'Invalid username or password' });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/register ────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    if (!User) return res.status(503).json({ error: 'User model not available' });
    const { username, password, role, clientName, email } = req.body;
    const user = new User({ username, password, role: role || 'operator', clientName: clientName || '', email: email || '' });
    await user.save();
    res.status(201).json({ message: 'User created', username: user.username, role: user.role });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/auth/users ────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    if (!User) return res.json([{ username: 'admin', role: 'admin' }, { username: 'operator', role: 'operator' }]);
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
