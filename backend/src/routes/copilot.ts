import express from 'express';
import { optionalAuth } from '../middleware/auth';
import { generateText } from '../lib/openai';
import ZUCK_SYSTEM_PROMPT from '../agents/zuck';

const router = express.Router();

// POST /api/copilot/chat — Generic Zuck co-pilot chat (not tied to specific product)
router.post('/chat', optionalAuth, async (req: any, res) => {
  try {
    const { prompt, system, temperature, maxTokens } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ code: 'bad_request', message: 'Missing prompt' });
    }

    // Dev-friendly fallback only when explicitly in dev mode or missing API key
    const devMode = process.env.COPILOT_DEV_MODE === 'true' || !process.env.OPENAI_API_KEY;
    if (devMode) {
      return res.status(200).json({ output: `DEV (generic Zuck co-pilot)\n\n${prompt}` });
    }

    const systemPrompt = system || ZUCK_SYSTEM_PROMPT;
    const text = await generateText({ system: systemPrompt, prompt, temperature, maxTokens });
    return res.status(200).json({ output: text });
  } catch (err) {
    console.error('copilot.chat error', err);
    if (process.env.COPILOT_DEV_MODE === 'true' || !process.env.OPENAI_API_KEY) {
      return res.status(200).json({ output: 'DEV fallback due to error. Echoing prompt:\n\n' + (req.body?.prompt || '') });
    }
    return res.status(500).json({ code: 'internal_error', message: 'Chat failed' });
  }
});

export default router;


