import { Router } from 'express';
import { getPreferences, updatePreferences } from '../controllers/preferencesController.js';

const router = Router();

router.get('/', getPreferences);
router.patch('/', updatePreferences);

export default router;
