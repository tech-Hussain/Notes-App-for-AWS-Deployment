import { Router } from 'express';

import authRoutes from './auth.routes';
import healthRoutes from './health.routes';
import noteRoutes from './note.routes';

const router = Router();

router.use('/api', healthRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/notes', noteRoutes);

export default router;