import express from 'express';
import { optionalAuth } from '../middleware/auth';
import { generateText } from '../lib/openai';
import ZUCK_SYSTEM_PROMPT from '../agents/zuck';
import ELON_SYSTEM_PROMPT from '../agents/elon';

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
    // Slash-command routing: /elon or /zuck at start of prompt selects persona
    let effectivePrompt: string = prompt;
    let effectiveSystem = system || ZUCK_SYSTEM_PROMPT;
    let personaLabel = 'Zuck';
    const slashMatch = /^\/(elon|zuck)\b[:\s]*/i.exec(effectivePrompt);
    if (slashMatch) {
      const who = (slashMatch[1] || '').toLowerCase();
      effectivePrompt = effectivePrompt.replace(/^\/(elon|zuck)\b[:\s]*/i, '');
      if (who === 'elon') {
        effectiveSystem = ELON_SYSTEM_PROMPT;
        personaLabel = 'Elon';
      } else {
        effectiveSystem = ZUCK_SYSTEM_PROMPT;
        personaLabel = 'Zuck';
      }
    }

    if (devMode) {
      return res.status(200).json({ output: `DEV (${personaLabel} co-pilot)\n\n${effectivePrompt}` });
    }

    const text = await generateText({ system: effectiveSystem, prompt: effectivePrompt, temperature, maxTokens });
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


