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

const JWT_SECRET = 'a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4';

// ============ DATABASE ============
let db;

function openDb() {
  return new Promise((resolve, reject) => {
    const dbPath = join(__dirname, 'casino.db');
    
    // Delete existing database if it exists (clean slate)
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
        console.log('🗑️  Deleted old database');
      } catch (e) {
        console.log('Could not delete old database');
      }
    }
    
    const database = new sqlite3.Database(
      dbPath,
      sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      (err) => {
        if (err) reject(err);
        else resolve(database);
      }
    );
  });
}

function promisify(db) {
  return {
    get: (sql, params) => new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    }),
    all: (sql, params) => new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    run: (sql, params) => new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    }),
    exec: (sql) => new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    })
  };
}

async function getDb() {
  if (!db) {
    const rawDb = await openDb();
    db = promisify(rawDb);
    await initDb();
  }
  return db;
}

async function initDb() {
  console.log('📦 Creating database tables...');
  
  // Create tables
  await db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      balance REAL DEFAULT 1000,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      method TEXT NOT NULL,
      reference TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      min_bet REAL DEFAULT 1,
      max_bet REAL DEFAULT 1000,
      rtp INTEGER DEFAULT 96,
      is_active INTEGER DEFAULT 1
    );
  `);

  // Create admin user - USING HARDCODED VALUES to avoid null issues
  const adminEmail = 'admin@casino.com';
  const adminUsername = 'admin';
  const adminPassword = 'admin123';
  
  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  
  await db.run(
    'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
    adminUsername, adminEmail, hashedPassword, 'admin'
  );
  console.log('✅ Admin created: admin@casino.com / admin123');

  // Create sample games
  await db.exec(`
    INSERT INTO games (name, type, description, min_bet, max_bet) VALUES
    ('Sweet Bonanza', 'slot', 'Sweet slot game with multipliers', 0.50, 100),
    ('European Roulette', 'roulette', 'Classic roulette with single zero', 1.00, 500),
    ('Blackjack Pro', 'blackjack', 'Professional blackjack', 5.00, 1000),
    ('Crazy Time', 'live', 'Live game show with crazy multipliers', 1.00, 500),
    ('Mega Jackpot', 'jackpot', 'Progressive jackpot', 2.00, 200)
  `);
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

    const db = await getDb();
    
    const existing = await db.get('SELECT * FROM users WHERE email = ? OR username = ?', email, username);
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      username, email, hashedPassword
    );
    
    const user = await db.get(
      'SELECT id, username, email, balance, role FROM users WHERE id = ?', 
      result.lastID
    );
    
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

    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', email);
    
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
    const db = await getDb();
    const user = await db.get(
      'SELECT id, username, email, balance, role FROM users WHERE id = ?', 
      decoded.userId
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
    const db = await getDb();
    const games = await db.all('SELECT * FROM games WHERE is_active = 1');
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
    
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO transactions (user_id, type, amount, method, status, reference) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      decoded.userId, 'deposit', amount, method || 'credit_card', 'pending', `DEP-${Date.now()}`
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
    
    const db = await getDb();
    const user = await db.get('SELECT balance FROM users WHERE id = ?', decoded.userId);
    
    if (amount > user.balance) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const result = await db.run(
      `INSERT INTO transactions (user_id, type, amount, method, status, reference) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      decoded.userId, 'withdrawal', amount, method || 'bank_transfer', 'pending', `WTH-${Date.now()}`
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
    const db = await getDb();
    const transactions = await db.all(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      decoded.userId
    );
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN ROUTES ============
app.get('/api/admin/transactions/pending', async (req, res) => {
  try {
    const db = await getDb();
    const transactions = await db.all(`
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
    const db = await getDb();
    
    const transaction = await db.get('SELECT * FROM transactions WHERE id = ?', req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.status !== 'pending') {
      return res.status(400).json({ error: 'Transaction already processed' });
    }
    
    await db.run('UPDATE transactions SET status = ? WHERE id = ?', 'approved', req.params.id);
    
    if (transaction.type === 'deposit') {
      await db.run('UPDATE users SET balance = balance + ? WHERE id = ?', transaction.amount, transaction.user_id);
    } else if (transaction.type === 'withdrawal') {
      await db.run('UPDATE users SET balance = balance - ? WHERE id = ?', transaction.amount, transaction.user_id);
    }
    
    res.json({ message: 'Transaction approved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/transactions/:id/reject', async (req, res) => {
  try {
    const db = await getDb();
    
    const transaction = await db.get('SELECT * FROM transactions WHERE id = ?', req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.status !== 'pending') {
      return res.status(400).json({ error: 'Transaction already processed' });
    }
    
    await db.run('UPDATE transactions SET status = ? WHERE id = ?', 'rejected', req.params.id);
    res.json({ message: 'Transaction rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const db = await getDb();
    const users = await db.all('SELECT id, username, email, balance, role, created_at FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/dashboard/stats', async (req, res) => {
  try {
    const db = await getDb();
    const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
    const pending = await db.get('SELECT COUNT(*) as count FROM transactions WHERE status = "pending"');
    const deposits = await db.get('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = "deposit" AND status = "approved"');
    const withdrawals = await db.get('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = "withdrawal" AND status = "approved"');
    
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

// Initialize database and start server
try {
  await getDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`🔑 Admin: admin@casino.com / admin123`);
    console.log(`📊 API: http://localhost:${PORT}/api/games`);
    console.log(`❤️  Health: http://localhost:${PORT}/health\n`);
  });
} catch (error) {
  console.error('Failed to start:', error);
}
