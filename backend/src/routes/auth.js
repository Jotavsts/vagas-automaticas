import { Router } from 'express';
import multer from 'multer';
import { register, login } from '../controllers/authController.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.post('/register', upload.single('cv'), register);
router.post('/login', login);

export default router;
