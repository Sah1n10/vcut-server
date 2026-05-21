import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'cuts_secret_key_change_in_production';

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token.' });
  try { req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token.' }); }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
  next();
};

// CUSTOMER REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'An account with this email already exists.' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, password: hashed, role: 'client' } });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch { res.status(500).json({ error: 'Registration failed.' }); }
});

// CUSTOMER LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'client') return res.status(401).json({ error: 'Invalid email or password.' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch { res.status(500).json({ error: 'Login failed.' }); }
});

// BARBER / ADMIN LOGIN
router.post('/barber-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || (user.role !== 'barber' && user.role !== 'admin'))
      return res.status(401).json({ error: 'Invalid barber credentials.' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid barber credentials.' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch { res.status(500).json({ error: 'Login failed.' }); }
});

// GET CURRENT USER
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token.' });
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch { res.status(401).json({ error: 'Invalid token.' }); }
});

// GET ALL APPROVED BARBERS with store info — public
// Joins User with their BarberApplication to get store city/state/zip
router.get('/barbers', async (req, res) => {
  try {
    const barbers = await prisma.user.findMany({
      where: { role: 'barber' },
      select: { id: true, name: true, email: true, createdAt: true }
    });

    // For each barber, find their application to get store info
    const barbersWithStore = await Promise.all(
      barbers.map(async (b) => {
        const app = await prisma.barberApplication.findUnique({
          where: { email: b.email },
          select: { storeName: true, storeAddress: true, storeCity: true, storeState: true, storeZip: true, specialties: true }
        });
        return { ...b, ...app };
      })
    );

    res.json(barbersWithStore);
  } catch { res.status(500).json({ error: 'Failed to fetch barbers.' }); }
});

// DELETE BARBER — admin only
router.delete('/barbers/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const barber = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!barber) return res.status(404).json({ error: 'Barber not found.' });
    if (barber.role !== 'barber') return res.status(400).json({ error: 'User is not a barber.' });
    await prisma.appointment.deleteMany({ where: { userId: parseInt(req.params.id) } });
    await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: `${barber.name} has been removed.` });
  } catch { res.status(500).json({ error: 'Failed to remove barber.' }); }
});

export default router;