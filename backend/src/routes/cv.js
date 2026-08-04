import { Router } from 'express';
import multer from 'multer';
import { listCvs, addCv, renameCv, deleteCv, getWildcard, generateWildcard, generateWildcardPdf } from '../controllers/cvController.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.get('/', listCvs);
router.post('/', upload.single('cv'), addCv);

// Wildcard (antes de /:id para não conflitar)
router.get('/wildcard', getWildcard);
router.post('/wildcard', generateWildcard);
router.post('/wildcard/pdf', generateWildcardPdf);

router.patch('/:id', renameCv);
router.delete('/:id', deleteCv);

export default router;
