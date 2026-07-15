import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jobsRouter from './routes/jobs.js';
import cvRouter from './routes/cv.js';
import applicationsRouter from './routes/applications.js';
import authRouter from './routes/auth.js';
import { requireAuth } from './middleware/requireAuth.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend rodando ✅' });
});

app.use('/api/auth', authRouter);
app.use('/api/jobs', requireAuth, jobsRouter);
app.use('/api/cv', requireAuth, cvRouter);
app.use('/api/applications', requireAuth, applicationsRouter);
app.use('/generated-cvs', express.static(path.join(__dirname, '..', 'generated-cvs')));

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
