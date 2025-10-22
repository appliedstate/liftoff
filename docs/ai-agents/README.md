# AI Agents — Personas for Guidance

This directory contains AI agent personas that can be invoked for guidance in the Human Control System. Each persona provides structured advice based on their principles, knowledge, and reference documents.

## How to Invoke

Use terminal commands to queue AI assistance:

```bash
# Invoke Aion for problem-solving
aion "How would you scale Facebook margin to $5k/day?"

# Invoke Warren for financial decisions
warren "Should we invest in this campaign optimization?"

# Invoke Zuck for systems architecture (Facebook Ads feedback loops)
zuck "Stabilize learning phase without killing winners"

# List available agents
ai-agents list

# Queue assistance for review
ai-queue add aion "Review TJ's scaling strategy"
```

## Persona Structure

Each persona file includes:
- **Principles**: Core beliefs and decision frameworks
- **Knowledge Areas**: Domain expertise and references
- **Response Style**: Communication preferences
- **Invocation Command**: How to call them
- **Supporting Docs**: Links to PRDs, docs, and principles

## Integration with HCS

- AI agents provide on-demand guidance to humans
- Queued requests are reviewed in weekly check-ins
- Responses reference system docs and apply first principles

## Adding New Personas

1. Create `{name}.md` in this directory
2. Follow the template structure
3. Add invocation command to terminal automation
4. Test with HCS weekly flow

---

## Best Practices & References

- OpenAI: A practical guide to building agents — `./openai-practical-guide-to-building-agents.pdf`
- Liftoff summary & checklists — `./openai-agent-best-practices.md`

Adopt these for model selection, tool design, orchestration, guardrails, and human-in-the-loop.
