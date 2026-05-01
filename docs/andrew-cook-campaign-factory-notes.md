# Andrew Cook Campaign Factory Notes

- Source thread: Slack `arbv2-hq`, message `2026-04-28 4:30 PM` and replies through `2026-04-29 11:54 AM`.
- Core concern: Cook believes cloning existing campaigns through the API may leave a detectable clone lineage inside Facebook and wants a path to launch shells without relying purely on clone-from-existing.
- Lian's guidance: the practical workflow is a per-account shell template: 1 campaign, 1 ad group, 1 ad, with 1 Strategis campaign attached. The first manual copy seeds the reusable template.
- Operational requirement: one template per Facebook account.
- Important linker detail: Strategist template campaign can be made by the buyer; the Facebook template campaign needs to exist and be linked to that Strategist campaign so Meta push can find the related Facebook campaign.
- Matching detail: Meta push searches by Strategist campaign, then fetches the related Facebook campaign, so template naming/linkage must stay aligned.
- Risk concern: if Facebook is really associating clone lineage with an individual persona, reusing another person's template may transfer risk to that original creator.
- Product implication for Cook profile: the workbench should prioritize exact shell recreation, per-account template visibility, and fast duplication of approved shell settings even when targeting details are missing from the Strategis record.
