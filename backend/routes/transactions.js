import express from 'express';
import { Transaction, User } from '../models.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
router.use(auth);

router.post('/deposit', async (req, res) => {
  try {
    const { amount, method } = req.body;
    if (amount < 10) return res.status(400).json({ error: 'Minimum $10' });
    const transaction = await Transaction.create({
      userId: req.user.id,
      type: 'deposit',
      amount,
      method,
      reference: `DEP-${Date.now()}`
    });
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/withdrawal', async (req, res) => {
  try {
    const { amount, method } = req.body;
    if (amount < 10) return res.status(400).json({ error: 'Minimum $10' });
    if (amount > req.user.balance) return res.status(400).json({ error: 'Insufficient balance' });
    const transaction = await Transaction.create({
      userId: req.user.id,
      type: 'withdrawal',
      amount,
      method,
      reference: `WTH-${Date.now()}`
    });
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const transactions = await Transaction.findByUser(req.user.id);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
