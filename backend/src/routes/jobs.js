import { Router } from 'express';
import { collect, listJobs } from '../controllers/jobsController.js';

const router = Router();
router.post('/collect', collect);
router.get('/', listJobs);

export default router;
