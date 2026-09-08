import express from 'express';
import { Transaction, User } from '../models.js';
import { auth } from '../middleware/auth.js';
import { admin } from '../middleware/admin.js';

const router = express.Router();
router.use(auth);
router.use(admin);

router.get('/transactions/pending', async (req, res) => {
  try {
    const transactions = await Transaction.getPending();
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/transactions/:id/approve', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Not found' });
    if (transaction.status !== 'pending') return res.status(400).json({ error: 'Already processed' });
    
    await Transaction.updateStatus(transaction.id, 'approved', req.user.id);
    
    if (transaction.type === 'deposit') {
      await User.updateBalance(transaction.user_id, transaction.amount);
    } else if (transaction.type === 'withdrawal') {
      await User.updateBalance(transaction.user_id, -transaction.amount);
    }
    
    res.json({ message: 'Approved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/transactions/:id/reject', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Not found' });
    if (transaction.status !== 'pending') return res.status(400).json({ error: 'Already processed' });
    
    await Transaction.updateStatus(transaction.id, 'rejected', req.user.id);
    res.json({ message: 'Rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await User.getAll();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard/stats', async (req, res) => {
  try {
    const stats = await Transaction.getStats();
    const users = await User.getAll();
    res.json({
      totalUsers: users.length,
      ...stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
