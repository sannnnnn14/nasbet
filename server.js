import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'your-secret-key-change-this';

// ============ SIMPLE DATABASE ============
let db;

function initDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = join(__dirname, 'casino.db');
    
    // Delete existing database
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
        console.log('🗑️ Deleted old database');
      } catch (e) {
        console.log('Could not delete old database');
      }
    }
    
    const database = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      db = database;
      resolve(database);
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function createTables() {
  console.log('📦 Creating database tables...');
  
  // Create users table - NO NOT NULL constraints to avoid issues
  await runQuery(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      email TEXT,
      password TEXT,
      balance REAL,
      role TEXT,
      created_at TEXT
    )
  `);

  // Create transactions table
  await runQuery(`
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      amount REAL,
      status TEXT,
      method TEXT,
      reference TEXT,
      created_at TEXT
    )
  `);

  // Create games table
  await runQuery(`
    CREATE TABLE games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      type TEXT,
      description TEXT,
      min_bet REAL,
      max_bet REAL,
      rtp INTEGER,
      is_active INTEGER
    )
  `);

  console.log('✅ Tables created');

  // Insert admin user - using direct SQL with hardcoded values
  const adminEmail = 'admin@casino.com';
  const adminUsername = 'admin';
  const adminPassword = 'admin123';
  
  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  
  await runQuery(
    `INSERT INTO users (username, email, password, balance, role, created_at) 
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [adminUsername, adminEmail, hashedPassword, 1000, 'admin']
  );
  console.log('✅ Admin created: admin@casino.com / admin123');

  // Insert games
  await runQuery(
    `INSERT INTO games (name, type, description, min_bet, max_bet, rtp, is_active) VALUES
     ('Sweet Bonanza', 'slot', 'Sweet slot game', 0.50, 100, 96, 1),
     ('European Roulette', 'roulette', 'Classic roulette', 1.00, 500, 97, 1),
     ('Blackjack Pro', 'blackjack', 'Professional blackjack', 5.00, 1000, 99, 1),
     ('Crazy Time', 'live', 'Live game show', 1.00, 500, 96, 1),
     ('Mega Jackpot', 'jackpot', 'Progressive jackpot', 2.00, 200, 92, 1)`
  );
  console.log('✅ Games created');
  console.log('✅ Database ready!');
}

// ============ AUTH ROUTES ============
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existing = await getQuery('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await runQuery(
      'INSERT INTO users (username, email, password, balance, role, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      [username, email, hashedPassword, 1000, 'user']
    );
    
    const user = await getQuery('SELECT id, username, email, balance, role FROM users WHERE id = ?', [result.lastID]);
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ user, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await getQuery('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getQuery(
      'SELECT id, username, email, balance, role FROM users WHERE id = ?', 
      [decoded.userId]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ============ GAME ROUTES ============
app.get('/api/games', async (req, res) => {
  try {
    const games = await allQuery('SELECT * FROM games WHERE is_active = 1');
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ TRANSACTION ROUTES ============
app.post('/api/transactions/deposit', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const { amount, method } = req.body;
    
    if (!amount || amount < 10) {
      return res.status(400).json({ error: 'Minimum deposit is $10' });
    }
    
    const result = await runQuery(
      `INSERT INTO transactions (user_id, type, amount, method, status, reference, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [decoded.userId, 'deposit', amount, method || 'credit_card', 'pending', `DEP-${Date.now()}`]
    );
    
    res.json({ 
      id: result.lastID, 
      status: 'pending',
      message: 'Deposit request submitted for approval'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transactions/withdrawal', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const { amount, method } = req.body;
    
    if (!amount || amount < 10) {
      return res.status(400).json({ error: 'Minimum withdrawal is $10' });
    }
    
    const user = await getQuery('SELECT balance FROM users WHERE id = ?', [decoded.userId]);
    
    if (amount > user.balance) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const result = await runQuery(
      `INSERT INTO transactions (user_id, type, amount, method, status, reference, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [decoded.userId, 'withdrawal', amount, method || 'bank_transfer', 'pending', `WTH-${Date.now()}`]
    );
    
    res.json({ 
      id: result.lastID, 
      status: 'pending',
      message: 'Withdrawal request submitted for approval'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const transactions = await allQuery(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [decoded.userId]
    );
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN ROUTES ============
app.get('/api/admin/transactions/pending', async (req, res) => {
  try {
    const transactions = await allQuery(`
      SELECT t.*, u.username, u.email 
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.status = 'pending'
      ORDER BY t.created_at ASC
    `);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/transactions/:id/approve', async (req, res) => {
  try {
    const transaction = await getQuery('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.status !== 'pending') {
      return res.status(400).json({ error: 'Transaction already processed' });
    }
    
    await runQuery('UPDATE transactions SET status = ? WHERE id = ?', ['approved', req.params.id]);
    
    if (transaction.type === 'deposit') {
      await runQuery('UPDATE users SET balance = balance + ? WHERE id = ?', [transaction.amount, transaction.user_id]);
    } else if (transaction.type === 'withdrawal') {
      await runQuery('UPDATE users SET balance = balance - ? WHERE id = ?', [transaction.amount, transaction.user_id]);
    }
    
    res.json({ message: 'Transaction approved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/transactions/:id/reject', async (req, res) => {
  try {
    const transaction = await getQuery('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.status !== 'pending') {
      return res.status(400).json({ error: 'Transaction already processed' });
    }
    
    await runQuery('UPDATE transactions SET status = ? WHERE id = ?', ['rejected', req.params.id]);
    res.json({ message: 'Transaction rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await allQuery('SELECT id, username, email, balance, role, created_at FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/dashboard/stats', async (req, res) => {
  try {
    const totalUsers = await getQuery('SELECT COUNT(*) as count FROM users');
    const pending = await getQuery('SELECT COUNT(*) as count FROM transactions WHERE status = "pending"');
    const deposits = await getQuery('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = "deposit" AND status = "approved"');
    const withdrawals = await getQuery('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = "withdrawal" AND status = "approved"');
    
    res.json({
      totalUsers: totalUsers.count || 0,
      pendingTransactions: pending.count || 0,
      totalDeposits: deposits.total || 0,
      totalWithdrawals: withdrawals.total || 0,
      revenue: (deposits.total || 0) - (withdrawals.total || 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;

console.log('🚀 Starting Casino App...');

try {
  await initDatabase();
  await createTables();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Server running on port ${PORT}`);
    console.log(`🔑 Admin: admin@casino.com / admin123`);
    console.log(`📊 API: http://localhost:${PORT}/api/games`);
    console.log(`❤️  Health: http://localhost:${PORT}/health\n`);
  });
} catch (error) {
  console.error('❌ Failed to start:', error);
  process.exit(1);
}
