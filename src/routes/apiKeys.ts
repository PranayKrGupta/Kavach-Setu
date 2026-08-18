import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticateToken } from '../middlewares/auth';
import {
  generateApiKey,
  listApiKeys,
  getApiKeyLogs,
  deleteApiKey
} from '../controllers/apiKey.controller';

const router = Router();

// Protect all API Key endpoints
router.use(authenticateToken);

router.post('/', asyncHandler(generateApiKey));
router.get('/', asyncHandler(listApiKeys));
router.get('/:id/logs', asyncHandler(getApiKeyLogs));
router.delete('/:id', asyncHandler(deleteApiKey));

export default router;
