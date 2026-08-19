import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticateToken } from '../middlewares/auth';
import {
  createEndpoint,
  listEndpoints,
  getEndpointLogs,
  toggleEndpointActive,
  deleteEndpoint
} from '../controllers/endpoint.controller';

const router = Router();

// Require authentication for all endpoint management routes
router.use(authenticateToken);

router.post('/', asyncHandler(createEndpoint));
router.get('/', asyncHandler(listEndpoints));
router.get('/:id/logs', asyncHandler(getEndpointLogs));
router.patch('/:id/toggle', asyncHandler(toggleEndpointActive));
router.delete('/:id', asyncHandler(deleteEndpoint));

export default router;
