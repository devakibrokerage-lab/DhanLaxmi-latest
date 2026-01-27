import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import BrokerModel from '../Model/BrokerModel.js';
import CustomerModel from '../Model/CustomerModel.js';
import { isBlacklisted } from '../Controllers/AuthController.js';

// protect middleware: verifies bearer token, checks blacklist, loads user
const protect = asyncHandler(async (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authorized' });

  if (typeof isBlacklisted === 'function') {
    if (isBlacklisted(token)) return res.status(401).json({ message: 'Session expired. Please login again.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded expected shape: { id, role }
    if (!decoded || !decoded.id) return res.status(401).json({ message: 'Token invalid' });

    if (decoded.role === 'broker') {
      req.user = await BrokerModel.findById(decoded.id).select('-password');
    } else if (decoded.role === 'customer') {
      req.user = await CustomerModel.findById(decoded.id).select('-password');
    } else {
      // fallback: try to find either
      req.user = await BrokerModel.findById(decoded.id).select('-password') || await CustomerModel.findById(decoded.id).select('-password');
    }

    if (!req.user) return res.status(401).json({ message: 'User not found in database' });

    req.role = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid' });
  }
});

export { protect };
