import { Router } from 'express';
import { collect, listJobs } from '../controllers/jobsController.js';
import { adaptForJob, generatePdfForJob, approveJob } from '../controllers/cvController.js';

const router = Router();
router.post('/collect', collect);
router.get('/', listJobs);
router.post('/:id/adapt', adaptForJob);
router.post('/:id/generate-pdf', generatePdfForJob);
router.post('/:id/approve', approveJob);

export default router;
