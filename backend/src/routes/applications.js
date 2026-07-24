import { Router } from 'express';
import { listApplications, updateApplicationStatus } from '../controllers/applicationsController.js';

const router = Router();
router.get('/', listApplications);
router.patch('/:id/status', updateApplicationStatus);

export default router;

