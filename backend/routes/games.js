import express from 'express';
import { getDb } from '../database.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const games = await db.all('SELECT * FROM games WHERE is_active = 1');
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const game = await db.get('SELECT * FROM games WHERE id = ?', req.params.id);
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
