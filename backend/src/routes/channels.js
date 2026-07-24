import { Router } from 'express';
import { listChannels, addChannel, removeChannel } from '../controllers/channelsController.js';

const router = Router();

router.get('/', listChannels);
router.post('/', addChannel);
router.delete('/:channel', removeChannel);

export default router;
