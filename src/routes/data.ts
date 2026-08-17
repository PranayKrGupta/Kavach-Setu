import { Router } from 'express';
import { rateLimiter } from '../middleware/rateLimit';

const router = Router();

router.get('/', rateLimiter, (req, res) => {
  res.json({
    message: 'Success! You have accessed the protected data route.',
    data: {
      timestamp: new Date().toISOString(),
      randomValue: Math.floor(Math.random() * 1000)
    }
  });
});

export default router;
