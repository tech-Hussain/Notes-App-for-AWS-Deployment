import { Router } from 'express';

import { authMiddleware } from '../middleware/authMiddleware';
import {
    changePasswordController,
    getAuthenticatedUserController,
    loginUser,
    logoutUser,
    registerUser,
    updateProfileController,
} from '../controllers/auth.controller';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', authMiddleware, logoutUser);
router.get('/me', authMiddleware, getAuthenticatedUserController);
router.put('/profile', authMiddleware, updateProfileController);
router.put('/change-password', authMiddleware, changePasswordController);

export default router;