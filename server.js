const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'casino_super_secret_key_99';
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-Memory Database (Replace with PostgreSQL on Railway for production)
const users = {};
const deposits = [];

const ROULETTE_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

// REST Auth Routes
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Provide username and password' });
  if (users[username.toLowerCase()]) return res.status(400).json({ error: 'Username taken' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { username, password: hashedPassword, balance: 1000.00 };
  users[username.toLowerCase()] = user;

  const token = jwt.sign({ username }, JWT_SECRET);
  res.json({ token, username, balance: user.balance });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users[username.toLowerCase()];
  if (!user) return res.status(400).json({ error: 'User not found' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Invalid password' });

  const token = jwt.sign({ username }, JWT_SECRET);
  res.json({ token, username, balance: user.balance });
});

// Socket State Management
const activeBets = {};

io.on('connection', (socket) => {
  let currentUser = null;

  socket.on('auth', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      currentUser = users[decoded.username.toLowerCase()];
      if (currentUser) {
        socket.emit('user_state', { username: currentUser.username, balance: currentUser.balance });
      }
    } catch (e) {
      socket.emit('auth_error');
    }
  });

  // Roulette Bet Placement
  socket.on('roulette_bet', (betData) => {
    if (!currentUser) return socket.emit('err_msg', 'Must be logged in');
    if (currentUser.balance < betData.amount) return socket.emit('err_msg', 'Insufficient Balance');

    currentUser.balance -= betData.amount;
    if (!activeBets[socket.id]) activeBets[socket.id] = [];
    activeBets[socket.id].push(betData);

    socket.emit('balance_update', currentUser.balance);
    socket.emit('bet_confirmed', betData);
  });

  // Roulette Spin Execution
  socket.on('roulette_spin', () => {
    if (!currentUser) return;
    const userBets = activeBets[socket.id] || [];
    if (userBets.length === 0) return socket.emit('err_msg', 'Place at least one chip!');

    const winningIndex = Math.floor(Math.random() * ROULETTE_NUMBERS.length);
    const winningNumber = ROULETTE_NUMBERS[winningIndex];

    socket.emit('roulette_start_spin', { winningIndex, winningNumber });

    setTimeout(() => {
      let totalPayout = 0;
      userBets.forEach(bet => {
        let win = false;
        let mult = 0;

        if (bet.type === 'number' && parseInt(bet.target) === winningNumber) { win = true; mult = 36; }
        else if (bet.type === 'red' && RED_NUMBERS.includes(winningNumber)) { win = true; mult = 2; }
        else if (bet.type === 'black' && !RED_NUMBERS.includes(winningNumber) && winningNumber !== 0) { win = true; mult = 2; }
        else if (bet.type === 'even' && winningNumber % 2 === 0 && winningNumber !== 0) { win = true; mult = 2; }
        else if (bet.type === 'odd' && winningNumber % 2 !== 0) { win = true; mult = 2; }

        if (win) totalPayout += bet.amount * mult;
      });

      currentUser.balance += totalPayout;
      activeBets[socket.id] = [];

      socket.emit('roulette_result', {
        winningNumber,
        isRed: RED_NUMBERS.includes(winningNumber),
        payout: totalPayout
      });

      socket.emit('balance_update', currentUser.balance);
    }, 8200);
  });

  // Slots Mechanics
  socket.on('slots_spin', (data) => {
    if (!currentUser) return;
    const bet = parseFloat(data.bet);
    if (currentUser.balance < bet) return socket.emit('err_msg', 'Insufficient Balance');

    currentUser.balance -= bet;
    const symbols = ['💎', '7️⃣', '🔔', '🍋', '🍒', '👑'];
    const r1 = symbols[Math.floor(Math.random() * symbols.length)];
    const r2 = symbols[Math.floor(Math.random() * symbols.length)];
    const r3 = symbols[Math.floor(Math.random() * symbols.length)];

    let payout = 0;
    if (r1 === r2 && r2 === r3) payout = bet * (r1 === '👑' ? 50 : 15);
    else if (r1 === r2 || r2 === r3 || r1 === r3) payout = bet * 2;

    currentUser.balance += payout;
    socket.emit('slots_result', { reels: [r1, r2, r3], payout, balance: currentUser.balance });
  });

  // Deposit Request
  socket.on('request_deposit', (data) => {
    if (!currentUser) return;
    const dep = {
      id: Date.now(),
      username: currentUser.username,
      amount: parseFloat(data.amount),
      status: 'pending'
    };
    deposits.push(dep);
    io.emit('update_deposits', deposits);
    socket.emit('dep_notice', 'Deposit request submitted for admin review!');
  });

  // Admin Events
  socket.on('admin_init', () => socket.emit('update_deposits', deposits));
  socket.on('approve_dep', (id) => {
    const dep = deposits.find(d => d.id === id);
    if (dep && dep.status === 'pending') {
      dep.status = 'approved';
      if (users[dep.username.toLowerCase()]) {
        users[dep.username.toLowerCase()].balance += dep.amount;
      }
      io.emit('update_deposits', deposits);
    }
  });
  socket.on('decline_dep', (id) => {
    const dep = deposits.find(d => d.id === id);
    if (dep) dep.status = 'declined';
    io.emit('update_deposits', deposits);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`1xBet-style Casino running on port ${PORT}`));
