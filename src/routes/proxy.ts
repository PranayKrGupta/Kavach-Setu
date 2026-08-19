import { Router } from 'express';
import { handleProxyRequest } from '../controllers/proxyController';

const router = Router();

// Handle all HTTP methods for the root slug and nested subpaths
router.all('/:slug', handleProxyRequest);
router.all('/:slug/*', handleProxyRequest);

export default router;
