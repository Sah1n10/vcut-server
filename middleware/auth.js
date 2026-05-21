import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'cuts_secret_key_change_in_production';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided. Please log in.' });

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET); // { id, email, role }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
};

export const requireBarber = (req, res, next) => {
  if (req.user.role !== 'barber' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Access denied. Barbers only.' });
  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  next();
};
