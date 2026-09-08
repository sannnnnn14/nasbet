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

// ============ DATABASE ============
let db;

function initDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = join(__dirname, 'casino.db');
    
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
        console.log('🗑️ Deleted old database');
      } catch (e) {}
    }
    
    const database = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else {
        db = database;
        resolve(database);
      }
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID });
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

async function setupDatabase() {
  console.log('📦 Setting up database...');
  
  // Create tables
  await runQuery(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    email TEXT,
    password TEXT,
    balance REAL DEFAULT 1000,
    role TEXT DEFAULT 'user',
    created_at TEXT
  )`);

  await runQuery(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    amount REAL,
    status TEXT DEFAULT 'pending',
    method TEXT,
    reference TEXT,
    created_at TEXT
  )`);

  await runQuery(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT,
    description TEXT,
    min_bet REAL,
    max_bet REAL,
    rtp INTEGER,
    is_active INTEGER DEFAULT 1
  )`);

  // Check if admin exists
  const admin = await getQuery('SELECT * FROM users WHERE username = ?', ['admin']);
  
  if (!admin) {
    const hashedPassword = await bcrypt.hash('admin123', 12);
    await runQuery(
      'INSERT INTO users (username, email, password, role, balance, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['admin', 'admin@casino.com', hashedPassword, 'admin', 1000, new Date().toISOString()]
    );
    console.log('✅ Admin created');
  }

  // Check if games exist
  const games = await getQuery('SELECT COUNT(*) as count FROM games');
  if (games.count === 0) {
    await runQuery(`INSERT INTO games (name, type, description, min_bet, max_bet) VALUES
      ('Sweet Bonanza', 'slot', 'Sweet slot game', 0.50, 100),
      ('European Roulette', 'roulette', 'Classic roulette', 1.00, 500),
      ('Blackjack Pro', 'blackjack', 'Professional blackjack', 5.00, 1000),
      ('Crazy Time', 'live', 'Live game show', 1.00, 500),
      ('Mega Jackpot', 'jackpot', 'Progressive jackpot', 2.00, 200)`
    );
    console.log('✅ Games created');
  }

  console.log('✅ Database ready!');
}

// ============ HTML PAGE ============
const htmlPage = `
<!DOCTYPE html>
<html>
<head>
    <title>🎰 PLAY BIG WIN BIGGER</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            background: #0a0a1a;
            color: #fff;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .container {
            text-align: center;
            padding: 40px;
            max-width: 800px;
        }
        h1 {
            font-size: 4rem;
            margin-bottom: 20px;
            background: linear-gradient(135deg, #f7971e, #ffd200);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle {
            font-size: 1.2rem;
            color: #aaa;
            margin-bottom: 30px;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin: 40px 0;
        }
        .feature {
            background: rgba(255,255,255,0.05);
            padding: 20px;
            border-radius: 12px;
            border: 1px solid rgba(255,215,0,0.1);
        }
        .feature h3 { color: #ffd700; margin-bottom: 8px; }
        .feature p { color: #888; font-size: 0.9rem; }
        .btn {
            display: inline-block;
            padding: 16px 48px;
            background: linear-gradient(135deg, #f7971e, #ffd200);
            color: #0a0a1a;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            font-size: 1.2rem;
            margin-top: 20px;
            border: none;
            cursor: pointer;
            transition: transform 0.3s;
        }
        .btn:hover { transform: scale(1.05); }
        .info {
            margin-top: 30px;
            padding: 20px;
            background: rgba(255,255,255,0.03);
            border-radius: 12px;
            border: 1px solid rgba(255,215,0,0.1);
        }
        .info code {
            background: #1a1a2e;
            padding: 4px 12px;
            border-radius: 6px;
            color: #ffd700;
        }
        .status-dot {
            display: inline-block;
            width: 12px;
            height: 12px;
            background: #2ecc71;
            border-radius: 50%;
            animation: pulse 2s infinite;
            margin-right: 8px;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.3; }
            100% { opacity: 1; }
        }
        .endpoints {
            text-align: left;
            margin: 20px 0;
            padding: 20px;
            background: rgba(0,0,0,0.3);
            border-radius: 8px;
        }
        .endpoints li {
            color: #aaa;
            padding: 4px 0;
            list-style: none;
        }
        .endpoints li span {
            color: #ffd700;
        }
        .api-test {
            margin-top: 20px;
            padding: 15px;
            background: rgba(46, 204, 113, 0.1);
            border-radius: 8px;
            border: 1px solid rgba(46, 204, 113, 0.2);
        }
        .api-test a {
            color: #2ecc71;
            text-decoration: none;
        }
        .api-test a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎰 PLAY BIG<br>WIN BIGGER</h1>
        <p class="subtitle">Your favorite casino games, all in one place.</p>
        
        <div class="features">
            <div class="feature">
                <h3>🎮 Games</h3>
                <p>Slots, Roulette, Blackjack</p>
            </div>
            <div class="feature">
                <h3>🏆 Jackpots</h3>
                <p>Win big prizes</p>
            </div>
            <div class="feature">
                <h3>🔒 Secure</h3>
                <p>Licensed & regulated</p>
            </div>
        </div>

        <button class="btn" onclick="alert('Welcome to the casino! Use the API endpoints below.')">🎯 PLAY NOW</button>

        <div class="info">
            <p>
                <span class="status-dot"></span>
                API Status: <strong style="color: #2ecc71;">Online</strong>
            </p>
            <p style="margin-top: 10px; color: #888;">
                🔑 Admin: <code>admin@casino.com</code> / <code>admin123</code>
            </p>
            
            <div class="api-test">
                <p style="color: #2ecc71;">✅ Test API endpoints:</p>
                <p style="margin-top: 8px;">
                    <a href="/api/games" target="_blank">📊 /api/games</a>
                </p>
                <p style="margin-top: 5px;">
                    <a href="/api/admin/users" target="_blank">👥 /api/admin/users</a>
                </p>
                <p style="margin-top: 5px;">
                    <a href="/api/admin/dashboard/stats" target="_blank">📈 /api/admin/dashboard/stats</a>
                </p>
            </div>

            <div class="endpoints">
                <h4 style="color: #ffd700; margin-bottom: 10px;">📡 API Endpoints:</h4>
                <ul>
                    <li><span>POST</span> /api/auth/register - Register</li>
                    <li><span>POST</span> /api/auth/login - Login</li>
                    <li><span>GET</span> /api/games - Get games</li>
                    <li><span>POST</span> /api/transactions/deposit - Deposit</li>
                    <li><span>POST</span> /api/transactions/withdrawal - Withdraw</li>
                    <li><span>GET</span> /api/admin/users - Admin: Users</li>
                    <li><span>GET</span> /api/admin/transactions/pending - Admin: Pending</li>
                </ul>
            </div>
        </div>
    </div>

    <script>
        fetch('/api/games')
            .then(res => res.json())
            .then(data => console.log('✅ API Working! Games:', data.length))
            .catch(err => console.error('❌ API Error:', err));
    </script>
</body>
</html>
`;

// ============ ROUTES ============

// Home page - MUST COME BEFORE API ROUTES
app.get('/', (req, res) => {
  res.send(htmlPage);
});

// ============ API ROUTES ============

// Auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    
    const existing = await getQuery('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) return res.status(400).json({ error: 'User exists' });
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await runQuery(
      'INSERT INTO users (username, email, password, balance, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, 1000, 'user', new Date().toISOString()]
    );
    
    const user = await getQuery('SELECT id, username, email, balance, role FROM users WHERE id = ?', [result.lastID]);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ user, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await getQuery('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({
      user: { id: user.id, username: user.username, email: user.email, balance: user.balance, role: user.role },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getQuery('SELECT id, username, email, balance, role FROM users WHERE id = ?', [decoded.userId]);
    res.json(user);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Games
app.get('/api/games', async (req, res) => {
  try {
    const games = await allQuery('SELECT * FROM games WHERE is_active = 1');
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transactions
app.post('/api/transactions/deposit', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { amount, method } = req.body;
    
    if (!amount || amount < 10) {
      return res.status(400).json({ error: 'Minimum $10' });
    }
    
    const result = await runQuery(
      'INSERT INTO transactions (user_id, type, amount, method, status, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [decoded.userId, 'deposit', amount, method || 'credit_card', 'pending', `DEP-${Date.now()}`, new Date().toISOString()]
    );
    
    res.json({ id: result.lastID, status: 'pending', message: 'Deposit submitted' });
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
      return res.status(400).json({ error: 'Minimum $10' });
    }
    
    const user = await getQuery('SELECT balance FROM users WHERE id = ?', [decoded.userId]);
    if (amount > user.balance) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const result = await runQuery(
      'INSERT INTO transactions (user_id, type, amount, method, status, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [decoded.userId, 'withdrawal', amount, method || 'bank_transfer', 'pending', `WTH-${Date.now()}`, new Date().toISOString()]
    );
    
    res.json({ id: result.lastID, status: 'pending', message: 'Withdrawal submitted' });
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

// Admin
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
    if (!transaction) return res.status(404).json({ error: 'Not found' });
    if (transaction.status !== 'pending') return res.status(400).json({ error: 'Already processed' });
    
    await runQuery('UPDATE transactions SET status = ? WHERE id = ?', ['approved', req.params.id]);
    
    if (transaction.type === 'deposit') {
      await runQuery('UPDATE users SET balance = balance + ? WHERE id = ?', [transaction.amount, transaction.user_id]);
    } else if (transaction.type === 'withdrawal') {
      await runQuery('UPDATE users SET balance = balance - ? WHERE id = ?', [transaction.amount, transaction.user_id]);
    }
    
    res.json({ message: 'Approved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/transactions/:id/reject', async (req, res) => {
  try {
    const transaction = await getQuery('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (!transaction) return res.status(404).json({ error: 'Not found' });
    if (transaction.status !== 'pending') return res.status(400).json({ error: 'Already processed' });
    
    await runQuery('UPDATE transactions SET status = ? WHERE id = ?', ['rejected', req.params.id]);
    res.json({ message: 'Rejected' });
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

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ START ============
const PORT = process.env.PORT || 5000;

console.log('🚀 Starting Casino App...');

try {
  await initDatabase();
  await setupDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Server running on port ${PORT}`);
    console.log(`🔑 Admin: admin@casino.com / admin123`);
    console.log(`🌐 Open: http://localhost:${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api/games\n`);
  });
} catch (error) {
  console.error('❌ Failed to start:', error);
  process.exit(1);
}
