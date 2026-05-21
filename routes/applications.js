import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();
const prisma = new PrismaClient();

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only.' });
  next();
};

// POST /api/applications — barber submits application with documents
router.post('/', upload.fields([
  { name: 'licenseFile',      maxCount: 1 },
  { name: 'insuranceFile',    maxCount: 1 },
  { name: 'certificateFiles', maxCount: 5 },
]), async (req, res) => {
  try {
    const {
      name, email, password, phone,
      storeName, storeAddress, storeCity, storeState, storeZip, storePhone,
      yearsExperience, specialties, bio
    } = req.body;

    if (!name || !email || !password || !phone || !storeName || !storeAddress || !storeCity || !storeState || !storeZip || !yearsExperience || !specialties || !bio)
      return res.status(400).json({ error: 'All required fields must be filled.' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    if (!req.files?.licenseFile?.[0])
      return res.status(400).json({ error: 'Barber license document is required.' });

    if (!req.files?.insuranceFile?.[0])
      return res.status(400).json({ error: 'Insurance document is required.' });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'An account with this email already exists.' });

    const existingApp = await prisma.barberApplication.findUnique({ where: { email } });
    if (existingApp) return res.status(400).json({ error: 'An application with this email already exists.' });

    const hashed       = await bcrypt.hash(password, 10);
    const licenseFile  = req.files.licenseFile[0].filename;
    const insuranceFile = req.files.insuranceFile[0].filename;
    const certFiles    = (req.files.certificateFiles || []).map(f => f.filename);

    const application = await prisma.barberApplication.create({
      data: {
        name, email, password: hashed, phone,
        storeName, storeAddress, storeCity, storeState,
        storeZip, storePhone: storePhone || '',
        yearsExperience, specialties, bio,
        licenseFile, insuranceFile,
        certificateFiles: JSON.stringify(certFiles),
        status: 'pending',
      }
    });

    res.status(201).json({ message: 'Application submitted. You will be notified once reviewed.', id: application.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit application.' });
  }
});

// GET all applications — admin only
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const applications = await prisma.barberApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, phone: true,
        storeName: true, storeAddress: true, storeCity: true, storeState: true, storeZip: true, storePhone: true,
        yearsExperience: true, specialties: true, bio: true,
        licenseFile: true, insuranceFile: true, certificateFiles: true,
        status: true, adminNote: true, createdAt: true, reviewedAt: true
      }
    });
    res.json(applications);
  } catch {
    res.status(500).json({ error: 'Failed to fetch applications.' });
  }
});

// POST approve — admin only
router.post('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const app = await prisma.barberApplication.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!app) return res.status(404).json({ error: 'Application not found.' });
    if (app.status !== 'pending') return res.status(400).json({ error: 'Application already reviewed.' });

    const existing = await prisma.user.findUnique({ where: { email: app.email } });
    if (existing) return res.status(400).json({ error: 'A user with this email already exists.' });

    await prisma.user.create({
      data: { name: app.name, email: app.email, password: app.password, role: 'barber' }
    });

    await prisma.barberApplication.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'approved', reviewedAt: new Date() }
    });

    res.json({ message: `${app.name}'s application approved. Barber account created.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve application.' });
  }
});

// POST reject — admin only
router.post('/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { adminNote } = req.body;
    const app = await prisma.barberApplication.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!app) return res.status(404).json({ error: 'Application not found.' });
    if (app.status !== 'pending') return res.status(400).json({ error: 'Application already reviewed.' });

    await prisma.barberApplication.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'rejected', adminNote: adminNote || '', reviewedAt: new Date() }
    });

    res.json({ message: 'Application rejected.' });
  } catch {
    res.status(500).json({ error: 'Failed to reject application.' });
  }
});

export default router;
