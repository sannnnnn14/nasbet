const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-Memory Database (Replace with PostgreSQL / Supabase for production)
let users = {
  'user_1': { id: 'user_1', name: 'Player 1', balance: 1000.00 }
};

let deposits = [];

// European Roulette Numbers in Order on Wheel
const ROULETTE_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

let gameState = {
  spinning: false,
  winningNumber: null,
  winningIndex: null,
  currentBets: []
};

// WebSocket Logic
io.on('connection', (socket) => {
  // Sync initial user state
  socket.emit('init_user', users['user_1']);

  // Handle Deposit Request
  socket.on('request_deposit', (data) => {
    const deposit = {
      id: Date.now(),
      userId: 'user_1',
      amount: parseFloat(data.amount),
      status: 'pending',
      date: new Date().toLocaleTimeString()
    };
    deposits.push(deposit);
    io.emit('update_deposits', deposits);
    socket.emit('deposit_notice', { message: 'Deposit requested! Waiting for admin approval.' });
  });

  // Handle Place Bet
  socket.on('place_bet', (bet) => {
    if (gameState.spinning) return socket.emit('error_msg', 'Wheel is spinning! Wait for next round.');
    const user = users['user_1'];
    if (user.balance < bet.amount) return socket.emit('error_msg', 'Insufficient Balance!');

    user.balance -= bet.amount;
    gameState.currentBets.push({ userId: 'user_1', ...bet });
    socket.emit('balance_update', user.balance);
    io.emit('bet_placed', bet);
  });

  // Handle Spin Request
  socket.on('spin_wheel', () => {
    if (gameState.spinning) return;
    gameState.spinning = true;

    // Pick random winning pocket
    const winningIndex = Math.floor(Math.random() * ROULETTE_NUMBERS.length);
    const winningNumber = ROULETTE_NUMBERS[winningIndex];

    io.emit('start_spin', { winningIndex, winningNumber });

    // Process payouts after spin animation finishes (8 seconds)
    setTimeout(() => {
      gameState.spinning = false;
      let totalPayout = 0;

      gameState.currentBets.forEach(bet => {
        let win = false;
        let multiplier = 0;

        if (bet.type === 'number' && parseInt(bet.value) === winningNumber) {
          win = true; multiplier = 36;
        } else if (bet.type === 'red' && RED_NUMBERS.includes(winningNumber)) {
          win = true; multiplier = 2;
        } else if (bet.type === 'black' && !RED_NUMBERS.includes(winningNumber) && winningNumber !== 0) {
          win = true; multiplier = 2;
        } else if (bet.type === 'even' && winningNumber % 2 === 0 && winningNumber !== 0) {
          win = true; multiplier = 2;
        } else if (bet.type === 'odd' && winningNumber % 2 !== 0) {
          win = true; multiplier = 2;
        }

        if (win) {
          totalPayout += bet.amount * multiplier;
        }
      });

      users['user_1'].balance += totalPayout;
      gameState.currentBets = [];

      io.emit('spin_result', {
        winningNumber,
        isRed: RED_NUMBERS.includes(winningNumber),
        payout: totalPayout
      });

      io.emit('balance_update', users['user_1'].balance);
    }, 8200);
  });

  // Admin Actions
  socket.on('admin_get_data', () => {
    socket.emit('admin_data', { users, deposits });
  });

  socket.on('approve_deposit', (depId) => {
    const dep = deposits.find(d => d.id === depId);
    if (dep && dep.status === 'pending') {
      dep.status = 'approved';
      users[dep.userId].balance += dep.amount;
      io.emit('balance_update', users['user_1'].balance);
      io.emit('update_deposits', deposits);
    }
  });

  socket.on('decline_deposit', (depId) => {
    const dep = deposits.find(d => d.id === depId);
    if (dep && dep.status === 'pending') {
      dep.status = 'declined';
      io.emit('update_deposits', deposits);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server live on port ${PORT}`);
});
