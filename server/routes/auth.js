const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, authenticate } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === email ? 'Email already in use' : 'Username already taken'
      });
    }

    const user = new User({ username, email, password });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({ token, user: user.toJSON() });
  } catch (err) {
    console.error('Register error:', err.message); 
    res.status(500).json({ error: err.message});
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await user.comparePassword(password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    user.lastSeen = Date.now();
    await user.save();

    const token = generateToken(user._id);
    res.json({ token, user: user.toJSON() });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user.toJSON() });
});

// Update profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { username, color } = req.body;
    const updates = {};
    if (username) updates.username = username;
    if (color) updates.color = color;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ user: user.toJSON() });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
