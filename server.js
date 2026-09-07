const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'royalspin_secret_key_2026';
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin12345';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-Memory Database
const users = {};
const deposits = [];
const withdrawals = [];
const betHistory = [];

// Seed Default Admin
(async () => {
  const hash = await bcrypt.hash('admin123', 10);
  users['admin'] = { username: 'admin', password: hash, balance: 1518049, role: 'admin' };
})();

// Auth Endpoints
app.post('/api/auth/register', async (req, res) => {
  const { username, password, adminCode } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  if (users[username.toLowerCase()]) return res.status(400).json({ error: 'User exists' });

  const role = (adminCode === ADMIN_KEY) ? 'admin' : 'user';
  const hashedPassword = await bcrypt.hash(password, 10);
  users[username.toLowerCase()] = { username, password: hashedPassword, balance: 1000.00, role };

  const token = jwt.sign({ username, role }, JWT_SECRET);
  res.json({ token, username, balance: 1000.00, role });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users[username.toLowerCase()];
  if (!user) return res.status(400).json({ error: 'User not found' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Invalid password' });

  const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET);
  res.json({ token, username: user.username, balance: user.balance, role: user.role });
});

// European Roulette Wheel Numbers in Physical Sequence (Clockwise)
const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

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

  socket.on('roulette_place_bet', (bet) => {
    if (!currentUser) return;
    if (currentUser.balance < bet.amount) return socket.emit('err_msg', 'Insufficient Balance');

    currentUser.balance -= bet.amount;
    if (!activeBets[socket.id]) activeBets[socket.id] = [];
    activeBets[socket.id].push(bet);

    socket.emit('balance_update', currentUser.balance);
    socket.emit('bet_confirmed', bet);
  });

  socket.on('roulette_clear_bets', () => {
    if (!currentUser || !activeBets[socket.id]) return;
    const refunded = activeBets[socket.id].reduce((sum, b) => sum + b.amount, 0);
    currentUser.balance += refunded;
    activeBets[socket.id] = [];
    socket.emit('balance_update', currentUser.balance);
    socket.emit('bets_cleared');
  });

  socket.on('roulette_spin_request', () => {
    if (!currentUser) return;
    const userBets = activeBets[socket.id] || [];
    if (userBets.length === 0) return socket.emit('err_msg', 'Place your bets on the felt first!');

    const winningIndex = Math.floor(Math.random() * WHEEL_NUMBERS.length);
    const winningNumber = WHEEL_NUMBERS[winningIndex];

    socket.emit('roulette_spin_start', { winningIndex, winningNumber });

    setTimeout(() => {
      let totalPayout = 0;
      userBets.forEach(b => {
        let win = false, mult = 0;
        if (b.type === 'number' && parseInt(b.target) === winningNumber) { win = true; mult = 36; }
        else if (b.type === 'red' && RED_NUMBERS.includes(winningNumber)) { win = true; mult = 2; }
        else if (b.type === 'black' && !RED_NUMBERS.includes(winningNumber) && winningNumber !== 0) { win = true; mult = 2; }
        else if (b.type === 'even' && winningNumber % 2 === 0 && winningNumber !== 0) { win = true; mult = 2; }
        else if (b.type === 'odd' && winningNumber % 2 !== 0) { win = true; mult = 2; }
        else if (b.type === '1to18' && winningNumber >= 1 && winningNumber <= 18) { win = true; mult = 2; }
        else if (b.type === '19to36' && winningNumber >= 19 && winningNumber <= 36) { win = true; mult = 2; }
        else if (b.type === '1st12' && winningNumber >= 1 && winningNumber <= 12) { win = true; mult = 3; }
        else if (b.type === '2nd12' && winningNumber >= 13 && winningNumber <= 24) { win = true; mult = 3; }
        else if (b.type === '3rd12' && winningNumber >= 25 && winningNumber <= 36) { win = true; mult = 3; }

        if (win) totalPayout += b.amount * mult;
      });

      currentUser.balance += totalPayout;
      activeBets[socket.id] = [];

      socket.emit('roulette_result', { winningNumber, payout: totalPayout });
      socket.emit('balance_update', currentUser.balance);
    }, 6000);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Classic Tabletop Casino running on port ${PORT}`));
