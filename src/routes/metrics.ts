import { Router } from 'express';
import { RequestLog } from '../models/RequestLog';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Get all API keys for this user
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: { id: true }
    });
    const keyIds = apiKeys.map(k => k.id);

    if (keyIds.length === 0) {
      return res.json({ data: [] });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Aggregate logs from MongoDB
    const metrics = await RequestLog.aggregate([
      {
        $match: {
          apiKeyId: { $in: keyIds },
          timestamp: { $gte: twentyFourHoursAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
            hour: { $hour: "$timestamp" },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
          "_id.hour": 1
        }
      }
    ]);

    // Format the metrics for Chart.js
    const formattedData = metrics.map(m => ({
      hour: `${m._id.year}-${String(m._id.month).padStart(2, '0')}-${String(m._id.day).padStart(2, '0')}T${String(m._id.hour).padStart(2, '0')}:00:00.000Z`,
      status: m._id.status,
      count: m.count
    }));

    res.json({ data: formattedData });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
