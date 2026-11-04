import { Router } from 'express';

import { createNoteController, deleteNoteController, getNoteController, listNotesController, updateNoteController } from '../controllers/note.controller';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.post('/', createNoteController);
router.get('/', listNotesController);
router.get('/:id', getNoteController);
router.put('/:id', updateNoteController);
router.delete('/:id', deleteNoteController);

export default router;