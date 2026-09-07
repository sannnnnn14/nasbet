const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'royalspin_ultra_secret_key_99';
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin12345'; // Secret code to create admin account

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-Memory DB (Replace with PostgreSQL/Supabase for production)
const users = {}; // username -> { username, password, balance, role }
const deposits = [];
const withdrawals = [];
const betHistory = [];

// Seed Default Admin Account (Username: admin | Pass: admin123)
(async () => {
  const hash = await bcrypt.hash('admin123', 10);
  users['admin'] = { username: 'admin', password: hash, balance: 999999, role: 'admin' };
})();

const ROULETTE_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

// Auth Endpoints
app.post('/api/auth/register', async (req, res) => {
  const { username, password, adminCode } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  if (users[username.toLowerCase()]) return res.status(400).json({ error: 'User exists' });

  const role = (adminCode && adminCode === ADMIN_KEY) ? 'admin' : 'user';
  const hashedPassword = await bcrypt.hash(password, 10);
  users[username.toLowerCase()] = { username, password: hashedPassword, balance: 1000.00, role };

  const token = jwt.sign({ username, role }, JWT_SECRET);
  res.json({ token, username, balance: 1000.00, role });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users[username.toLowerCase()];
  if (!user) return res.status(400).json({ error: 'Invalid user' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Invalid password' });

  const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET);
  res.json({ token, username: user.username, balance: user.balance, role: user.role });
});

// Admin Middleware Guard
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Access denied: Admins only' });
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/api/admin/verify', requireAdmin, (req, res) => res.json({ ok: true }));

// Socket Logic
const activeBets = {};

io.on('connection', (socket) => {
  let currentUser = null;

  socket.on('auth', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      currentUser = users[decoded.username.toLowerCase()];
      if (currentUser) {
        socket.emit('user_state', { username: currentUser.username, balance: currentUser.balance, role: currentUser.role });
      }
    } catch (e) {
      socket.emit('auth_error');
    }
  });

  // Deposit Request with Payment Methods
  socket.on('request_deposit', (data) => {
    if (!currentUser) return;
    const dep = {
      id: Date.now(),
      username: currentUser.username,
      method: data.method, // USDT-TRC20, Credit Card, FastPay
      amount: parseFloat(data.amount),
      txHash: data.txHash || 'N/A',
      status: 'pending',
      date: new Date().toISOString()
    };
    deposits.push(dep);
    io.emit('admin_deposits_update', deposits);
    socket.emit('notice', 'Deposit request submitted successfully! Awaiting Admin Approval.');
  });

  // Withdrawal Request
  socket.on('request_withdrawal', (data) => {
    if (!currentUser) return;
    const amt = parseFloat(data.amount);
    if (currentUser.balance < amt) return socket.emit('err_msg', 'Insufficient funds for withdrawal!');

    currentUser.balance -= amt;
    const w = {
      id: Date.now(),
      username: currentUser.username,
      method: data.method,
      address: data.address,
      amount: amt,
      status: 'pending',
      date: new Date().toISOString()
    };
    withdrawals.push(w);
    socket.emit('balance_update', currentUser.balance);
    io.emit('admin_withdrawals_update', withdrawals);
    socket.emit('notice', 'Withdrawal request created!');
  });

  // 3D Roulette Betting
  socket.on('roulette_place_bet', (bet) => {
    if (!currentUser) return;
    if (currentUser.balance < bet.amount) return socket.emit('err_msg', 'Insufficient Balance');

    currentUser.balance -= bet.amount;
    if (!activeBets[socket.id]) activeBets[socket.id] = [];
    activeBets[socket.id].push(bet);

    socket.emit('balance_update', currentUser.balance);
    socket.emit('bet_confirmed', bet);
  });

  socket.on('roulette_spin_request', () => {
    if (!currentUser) return;
    const userBets = activeBets[socket.id] || [];
    if (userBets.length === 0) return socket.emit('err_msg', 'Place chips on table first!');

    const winningIndex = Math.floor(Math.random() * ROULETTE_NUMBERS.length);
    const winningNumber = ROULETTE_NUMBERS[winningIndex];

    socket.emit('roulette_start_3d_spin', { winningIndex, winningNumber });

    setTimeout(() => {
      let totalPayout = 0;
      userBets.forEach(b => {
        let win = false, mult = 0;
        if (b.type === 'number' && parseInt(b.target) === winningNumber) { win = true; mult = 36; }
        else if (b.type === 'red' && RED_NUMBERS.includes(winningNumber)) { win = true; mult = 2; }
        else if (b.type === 'black' && !RED_NUMBERS.includes(winningNumber) && winningNumber !== 0) { win = true; mult = 2; }
        else if (b.type === 'even' && winningNumber % 2 === 0 && winningNumber !== 0) { win = true; mult = 2; }
        else if (b.type === 'odd' && winningNumber % 2 !== 0) { win = true; mult = 2; }

        if (win) totalPayout += b.amount * mult;
      });

      currentUser.balance += totalPayout;
      activeBets[socket.id] = [];

      betHistory.unshift({
        id: Date.now(),
        user: currentUser.username,
        game: '3D Roulette',
        winningNumber,
        payout: totalPayout,
        date: new Date().toLocaleTimeString()
      });

      socket.emit('roulette_result', { winningNumber, payout: totalPayout });
      socket.emit('balance_update', currentUser.balance);
      io.emit('history_update', betHistory);
    }, 9000);
  });

  // Admin Socket Listeners
  socket.on('admin_init', () => {
    if (currentUser && currentUser.role === 'admin') {
      socket.emit('admin_data', { deposits, withdrawals, users, betHistory });
    }
  });

  socket.on('admin_approve_deposit', (id) => {
    const dep = deposits.find(d => d.id === id);
    if (dep && dep.status === 'pending') {
      dep.status = 'approved';
      if (users[dep.username.toLowerCase()]) {
        users[dep.username.toLowerCase()].balance += dep.amount;
      }
      io.emit('admin_deposits_update', deposits);
      io.emit('balance_update_for_user', { username: dep.username, newBal: users[dep.username.toLowerCase()].balance });
    }
  });

  socket.on('admin_decline_deposit', (id) => {
    const dep = deposits.find(d => d.id === id);
    if (dep) dep.status = 'declined';
    io.emit('admin_deposits_update', deposits);
  });

  socket.on('admin_approve_withdrawal', (id) => {
    const w = withdrawals.find(item => item.id === id);
    if (w && w.status === 'pending') {
      w.status = 'approved';
      io.emit('admin_withdrawals_update', withdrawals);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`RoyalSpin 3D Live on port ${PORT}`));
