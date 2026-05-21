import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireBarber } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET all appointments — barbers/admin only
router.get('/', requireAuth, requireBarber, async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(appointments);
  } catch {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET my appointments — logged in client
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(appointments);
  } catch {
    res.status(500).json({ error: 'Failed to fetch your appointments' });
  }
});

// GET my appointments on a specific date — used to warn about existing bookings
// GET /api/appointments/my-date?date=2026-05-20
router.get('/my-date', requireAuth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const appointments = await prisma.appointment.findMany({
      where: {
        userId: req.user.id,
        date,
        status: { notIn: ['cancelled'] }
      },
      select: { id: true, service: true, barber: true, time: true, guestName: true }
    });

    res.json(appointments);
  } catch {
    res.status(500).json({ error: 'Failed to check your appointments' });
  }
});

// GET availability — barber slots taken on a date (public)
router.get('/availability', async (req, res) => {
  try {
    const { barber, date } = req.query;
    if (!barber || !date)
      return res.status(400).json({ error: 'barber and date required' });

    const booked = await prisma.appointment.findMany({
      where: { barber, date, status: { notIn: ['cancelled'] } },
      select: { time: true }
    });

    res.json(booked.map(a => a.time));
  } catch {
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// GET single appointment
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { user: { select: { name: true, email: true } } }
    });
    if (!appointment) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'client' && appointment.userId !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });
    res.json(appointment);
  } catch {
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// POST create appointment
// Supports guestName for group bookings (one account, multiple people)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { service, barber, date, time, notes, guestName } = req.body;

    if (!service || !barber || !date || !time)
      return res.status(400).json({ error: 'All required fields must be filled' });

    // Block: same barber already booked at same date + time by anyone
    const conflict = await prisma.appointment.findFirst({
      where: {
        barber,
        date,
        time,
        status: { notIn: ['cancelled'] }
      }
    });

    if (conflict)
      return res.status(409).json({
        error: `${barber} is already booked at ${time} on that date. Please choose a different time or barber.`
      });

    const appointment = await prisma.appointment.create({
      data: {
        userId: req.user.id,
        service,
        barber,
        date,
        time,
        notes: notes || '',
        guestName: guestName?.trim() || null
      }
    });

    res.status(201).json(appointment);
  } catch {
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// PATCH update status — barbers only
router.patch('/:id', requireAuth, requireBarber, async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await prisma.appointment.update({
      where: { id: parseInt(req.params.id) },
      data: { status }
    });
    res.json(appointment);
  } catch {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// DELETE — barber deletes any, client cancels their own
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!appointment) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'client' && appointment.userId !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });

    await prisma.appointment.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Appointment deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

export default router;
