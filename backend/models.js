import { getDb } from './database.js';
import bcrypt from 'bcryptjs';

export const User = {
  async create({ username, email, password }) {
    const db = await getDb();
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      username, email, hashedPassword
    );
    return this.findById(result.lastID);
  },

  async findByEmail(email) {
    const db = await getDb();
    return db.get('SELECT * FROM users WHERE email = ?', email);
  },

  async findById(id) {
    const db = await getDb();
    return db.get('SELECT id, username, email, balance, role, is_verified, created_at FROM users WHERE id = ?', id);
  },

  async updateBalance(id, amount) {
    const db = await getDb();
    await db.run('UPDATE users SET balance = balance + ? WHERE id = ?', amount, id);
    return this.findById(id);
  },

  async getAll() {
    const db = await getDb();
    return db.all('SELECT id, username, email, balance, role, is_verified, created_at FROM users');
  },

  async comparePassword(user, password) {
    return bcrypt.compare(password, user.password);
  }
};

export const Transaction = {
  async create({ userId, type, amount, method, status = 'pending', reference = null }) {
    const db = await getDb();
    const result = await db.run(
      'INSERT INTO transactions (user_id, type, amount, method, status, reference) VALUES (?, ?, ?, ?, ?, ?)',
      userId, type, amount, method, status, reference
    );
    return this.findById(result.lastID);
  },

  async findById(id) {
    const db = await getDb();
    return db.get('SELECT * FROM transactions WHERE id = ?', id);
  },

  async findByUser(userId, limit = 50) {
    const db = await getDb();
    return db.all(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      userId, limit
    );
  },

  async getPending() {
    const db = await getDb();
    return db.all(`
      SELECT t.*, u.username, u.email 
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.status = 'pending'
      ORDER BY t.created_at ASC
    `);
  },

  async updateStatus(id, status, processedBy = null) {
    const db = await getDb();
    await db.run(
      'UPDATE transactions SET status = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ? WHERE id = ?',
      status, processedBy, id
    );
    return this.findById(id);
  },

  async getStats() {
    const db = await getDb();
    const totalDeposits = await db.get('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = "deposit" AND status = "approved"');
    const totalWithdrawals = await db.get('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = "withdrawal" AND status = "approved"');
    const pending = await db.get('SELECT COUNT(*) as count FROM transactions WHERE status = "pending"');
    return {
      totalDeposits: totalDeposits.total,
      totalWithdrawals: totalWithdrawals.total,
      pendingTransactions: pending.count
    };
  }
};
