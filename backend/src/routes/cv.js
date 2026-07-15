import { Router } from 'express';
import multer from 'multer';
import { listCvs, addCv, renameCv, deleteCv } from '../controllers/cvController.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.get('/', listCvs);
router.post('/', upload.single('cv'), addCv);
router.patch('/:id', renameCv);
router.delete('/:id', deleteCv);

export default router;
