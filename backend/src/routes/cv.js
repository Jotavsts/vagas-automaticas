import { Router } from 'express';
import { getCv } from '../controllers/cvController.js';

const router = Router();
router.get('/', getCv);

export default router;
