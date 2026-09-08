import express from 'express';
import { User } from '../models.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = 'your-secret-key-change-me';

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const user = await User.create({ username, email, password });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ user, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isValid = await User.comparePassword(user, password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ user: {
      id: user.id,
      username: user.username,
      email: user.email,
      balance: user.balance,
      role: user.role
    }, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    res.json(user);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
