import express from 'express';
import { evaluateGoogleRsocCompliance } from '../lib/googleRsocPolicy';

const router = express.Router();

router.post('/run', (req, res) => {
  try {
    const result = evaluateGoogleRsocCompliance(req.body || {});
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Google RSOC policy evaluation failed' });
  }
});

export default router;
