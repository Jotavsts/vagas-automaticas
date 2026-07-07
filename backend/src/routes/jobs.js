import { Router } from 'express';
import { collect, listJobs } from '../controllers/jobsController.js';
import { adaptForJob } from '../controllers/cvController.js';

const router = Router();
router.post('/collect', collect);
router.get('/', listJobs);
router.post('/:id/adapt', adaptForJob);

export default router;
