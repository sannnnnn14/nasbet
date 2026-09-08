import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db;

// Simple wrapper for sqlite3
function openDb() {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(
      join(__dirname, 'casino.db'),
      sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      (err) => {
        if (err) reject(err);
        else resolve(database);
      }
    );
  });
}

// Promisify db methods
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

export async function getDb() {
  if (!db) {
    const rawDb = await openDb();
    db = promisify(rawDb);
    db.raw = rawDb;
    
    // Create all tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        balance REAL DEFAULT 1000,
        role TEXT DEFAULT 'user',
        is_verified INTEGER DEFAULT 0,
        last_login TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        method TEXT NOT NULL,
        reference TEXT,
        description TEXT,
        processed_at TEXT,
        processed_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        min_bet REAL DEFAULT 1,
        max_bet REAL DEFAULT 1000,
        rtp INTEGER DEFAULT 96,
        is_active INTEGER DEFAULT 1,
        image_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS game_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        game_id INTEGER NOT NULL,
        bet_amount REAL NOT NULL,
        win_amount REAL DEFAULT 0,
        result TEXT,
        played_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (game_id) REFERENCES games (id)
      );
    `);

    // Insert default admin user
    const admin = await db.get('SELECT * FROM users WHERE username = ?', 'admin');
    if (!admin) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await db.run(
        'INSERT INTO users (username, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?)',
        'admin', 'admin@casino.com', hashedPassword, 'admin', 1
      );
      console.log('✅ Admin user created');
    }

    // Insert sample games
    const gamesCount = await db.get('SELECT COUNT(*) as count FROM games');
    if (gamesCount.count === 0) {
      await db.exec(`
        INSERT INTO games (name, type, description, min_bet, max_bet, rtp) VALUES
        ('Sweet Bonanza', 'slot', 'Sweet and fruity slot game with huge multipliers', 0.50, 100.00, 96),
        ('European Roulette', 'roulette', 'Classic European roulette with single zero', 1.00, 500.00, 97),
        ('Blackjack Pro', 'blackjack', 'Professional blackjack with perfect strategy', 5.00, 1000.00, 99),
        ('Crazy Time', 'live', 'Live game show with crazy multipliers', 1.00, 500.00, 96),
        ('Mega Jackpot', 'jackpot', 'Progressive jackpot with massive prizes', 2.00, 200.00, 92)
      `);
      console.log('✅ Sample games created');
    }
  }
  return db;
}

export async function initDb() {
  return getDb();
}
