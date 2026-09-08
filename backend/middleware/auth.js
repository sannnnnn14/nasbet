import jwt from 'jsonwebtoken';
import { User } from '../models.js';

const JWT_SECRET = 'your-secret-key-change-me';

export const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = { ...user, id: user.id };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
