import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import appointmentRoutes from './routes/appointments.js';
import authRoutes from './routes/auth.js';
import applicationRoutes from './routes/applications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve uploaded documents statically (admin can preview files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth',         authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/applications', applicationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'BarberBook API running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
