import { Router } from 'express';
import { listApplications } from '../controllers/applicationsController.js';

const router = Router();
router.get('/', listApplications);

export default router;
