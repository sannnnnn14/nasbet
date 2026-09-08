import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDb } from './database.js';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/games.js';
import transactionRoutes from './routes/transactions.js';
import adminRoutes from './routes/admin.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('join-game', (gameId) => socket.join(`game-${gameId}`));
  socket.on('bet-placed', (data) => {
    io.to(`game-${data.gameId}`).emit('bet-update', data);
  });
  socket.on('disconnect', () => console.log('Client disconnected'));
});

const PORT = process.env.PORT || 5000;

// Initialize database and start server
await initDb();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export { io };
