import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jobsRouter from './routes/jobs.js';
import cvRouter from './routes/cv.js';
import applicationsRouter from './routes/applications.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend rodando ✅' });
});

app.use('/api/jobs', jobsRouter);
app.use('/api/cv', cvRouter);
app.use('/api/applications', applicationsRouter);
app.use('/generated-cvs', express.static(path.join(__dirname, '..', 'generated-cvs')));

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
