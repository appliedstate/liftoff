---
date: 2026-04-29
title: "Media Buying — Facebook Ops Sync"
type: transcript
participants:
  - Eric Roach
  - Anastasia Uldanova
  - Phillip Bennett
  - Narbeh Ghazalian
  - Ben
  - Andrew Cook
  - Scott Anderson
  - TJ Babbel
  - Brianne Hodenfield
context:
  team: Media Buying / Facebook
  company: Liftoff
source:
  medium: google_meet
  recording: n/a
  transcript_source: ai_paste_from_operator
tags:
  - meeting
  - media-buying
  - facebook
  - operations
  - redirects
---

# Raw Transcript

> Transcript pasted by operator from the Google Meet transcript. Lightly normalized for readability only.

```text
[00:00:00] Anastasia Uldanova: Hey guys.
[00:00:01] Eric Roach: How we doing? Give it a few minutes for everybody to join.
[00:00:05] Phillip Bennett: Hey, how's it going?
[00:00:11] Anastasia Uldanova: While we waiting for others, Phil, can I ask you when you had that account disabled or page disabled and had to go to Facebook?
[00:00:19] Phillip Bennett: When I had that page disabled, they asked for my ID and I was let back in the same day.
[00:00:32] Anastasia Uldanova: Good for you.

[00:00:44] Narbeh Ghazalian: Yep. I'm up.
[00:00:47] Eric Roach: Anastasia, real quick. Have you been working on trying to get your buy-side account back, like your identity?

[00:02:30] Anastasia Uldanova: We decided we can appeal some safer ads that were flagged as political or social issues because they are not related to that. Probably if that flag is removed, my account will be safe. The first appeal was not approved. Then I clicked something and was able to speak with Facebook support. They kept changing the support team and the last one sent me a link to upload my ID. I was hesitant because it doesn't seem right when you appeal the ad and they jump to ID. I'm not sure whether uploading the ID helps the case or makes it worse, because if it's restricted for good, maybe it is better not to upload the ID and later start a fresh account.

[00:03:53] Eric Roach: It's asking you for driver's license ID?
[00:03:58] Anastasia Uldanova: Yeah, but that's weird because usually when you appeal ads they work at that level, not the ID level.
[00:04:10] Eric Roach: Your actual identity is restricted, so maybe that might help solve the root issue because Phil just said when he ran into his issue, he uploaded his ID and his account was restored.
[00:04:25] Ben: I can maybe explain it better. Phil's issue was "prove you are who you say you are to run this page." They don't ask you that in the event of a personal ban for other reasons, which is what Anastasia got. They're not concerned she is who she says she is. That's not the problem.

[00:05:20] Ben: It's not that one ad. For those specific ones, instead of appealing, what I would have done is categorize them because I don't even think that campaign was live.
[00:06:01] Anastasia Uldanova: It was a misflagged ad for trials as a job.
[00:06:10] Ben: For those last ones, if the issue is social or political categorization, just categorize it and it goes away.

[00:06:35] Narbeh Ghazalian: There is a bigger thing. Anastasia, you had an ad account disabled because of the jobs stuff, right? I'm assuming that counted as a strike. Then if you continued doing things and got more violations, Facebook may be saying the person committing this is doing it somewhere else, so we're banning her account.
[00:06:58] Anastasia Uldanova: But I didn't do that again. That's the point.
[00:07:07] Narbeh Ghazalian: You didn't do jobs, but still had rejections. It feels like a domino effect. There is possibly a scenario where if we get the ad account restored, then you can make a case to restore the personal because that original account was restored.

[00:07:58] Ben: Andrew appealed his account and they did not overturn it, so I would expect the same result. I'm not saying don't do it.
[00:08:10] Narbeh Ghazalian: Even if there's only a 10% or 20% chance, it's still worth doing because the next step doesn't change by appealing it or not. High reward, low risk.
[00:08:46] Ben: The question is what is the benefit if we pay a lot of money to get an ad account overturned. If that doesn't help get the personal back, the money is lit on fire.
[00:09:10] Narbeh Ghazalian: If we think of it as a strike system, reversing the ad-account strikes may move us from strike three back to strike one. There is also a trust-score factor in the business manager.
[00:10:29] Narbeh Ghazalian: Kunal had said we have to clear out hard rejections before we can do certain other operations like adding more pages. Having rejected stuff in the business manager is not great for trust.

[00:11:34] Ben: Is your ban lifted, Andrew?
[00:11:38] Eric Roach: Supposed to be by end of the day, right Andrew?
[00:11:43] Andrew Cook: It said on the 29th, so not yet. I talked to someone and uploaded my ID. It gives me an option to confirm my identity and request review if I believe the account shouldn't be restricted.

[00:12:37] Anastasia Uldanova: What's crazy is when I check competitor ads, we are not even close to the worst offenders. Their ads are crazy. It looks like Facebook is going account by account.
[00:12:57] Ben: They're probably just not caught yet. One of the biggest ad libraries I posted in the channel a month ago is gone overnight.

[00:13:54] Ben: My question is just what benefit do we get if we pay to restore an ad account. Is it because it improves the chance of getting the personal back? I don't know.
[00:14:20] Narbeh Ghazalian: The benefit is keeping the business manager clean and reversing compounding strikes.
[00:16:45] Narbeh Ghazalian: Having rejected stuff in that business manager is not great for the trust score. That's the benefit of reversing it.
[00:16:58] Andrew Cook: When I talk to support, they tell me the system scans the account. They said delete the bad stuff and maybe one day the account just reenables because the AI checks whether the bad stuff is still in there.
[00:17:27] Narbeh Ghazalian: That's consistent with what Kunal said. Keep the business manager clean. Clean out blemishes.
[00:18:15] Anastasia Uldanova: Facebook says you can delete but it may still be counted somewhere. So you may delete from the UI, but is it deleted from the system completely?
[00:19:12] Ben: If the rejection is just for not categorizing, categorize it and it goes away. It's not a mark. Make sure you're doing that.

[00:20:05] Eric Roach: We currently have three ad accounts restricted in the business manager. The first one, the group one, is probably worth getting fixed. Cook appealed his and it didn't go through. Anastasia can't appeal hers because she isn't the admin.
[00:22:24] Eric Roach: I've spent time this week building my own lens to the world. Ben and I were talking about identifying ads in the system that are not running or not making money and knowing which ones to remove. I could probably put together a list for each person of ads in the system that are active or paused but not producing and should be removed. Would that be helpful?
[00:23:40] TJ Babbel: Yeah, I'd be curious to see that.

[00:23:48] Eric Roach: I've also spent time pushing toward tools that make it easier to deploy from scratch, not just clone and redeploy. There has been conversation with Lean and Tama today about removing final bottlenecks there. There should be good progress in the next couple days. I might jump on with Cook and walk through it because even if his restrictions move out, setup remains his biggest bottleneck. If it works, we can prototype, test, and roll it out to everybody.

[00:26:00] Eric Roach: The third big piece is coming up with new ideas to test and launch. I also built a tool where I indexed our rejections and merged them with Facebook news, compliance, and guidelines, and can now Q&A why Facebook might reject a given ad. It tends to touch multiple things: health, money, near me, and other sensitive signals together can create a recipe for a problem.

[00:28:18] Eric Roach: Those pieces are in my own world at the moment, so I need to think about how to share them. The first one I want to share is the launch tool and see if it is helpful. Lean's world and my world are separate right now, which is good for prototyping but not for long-term use.

[00:29:15] Eric Roach: Outside of that, there has been a big push to get the Adnet business manager going. That opens the door for Bri and Mike. Ben has been leading that. We capped out our first revenue limit at $5,000 a day, and Narv got it approved to $10,000 a day yesterday.
[00:29:56] Narbeh Ghazalian: The Simply World attribution issue was not magical buttons. System1 screwed up setting up the segment, so the attribution wasn't working. Our revenue wasn't being attributed to our account. They fixed that. Nolan is checking if we can find the lost revenue.
[00:31:11] Ben: The point is it ran for two weeks and showed very consistent RPCs no matter the category. Then attribution was fixed and now it seems fine. It makes me wonder whether this has happened on any other sites where we thought the site was bad.

[00:32:23] Eric Roach: I also ran an experiment on comment and emoji sentiment around our ads. That data does exist, and hypothetically should be available through the graph and API, though we haven't set that up. My method was browser-level and I don't want to do that long term because I don't want to trigger Facebook boogeymen. It was able to identify comments, but initially wasn't surfacing hidden comments, which made our ads look better than they really were. If sentiment is high on the list of things we should know, then maybe we should track it and correlate it with later rejections.

[00:34:18] Eric Roach: We have a Shutterstock account issue and payment issue left over from something Dan was working on. Is anybody using Shutterstock at this point?
[00:34:53] Multiple: Yes, a little bit.
[00:35:22] Eric Roach: Has anyone used it in the last month?
[00:35:27] TJ Babbel: Yeah, maybe six images.
[00:35:31] Anastasia Uldanova: Less than ten, mainly when image generators fail.
[00:36:02] TJ Babbel: If we're retesting Taboola, Shutterstock may be used more there.
[00:36:25] Phillip Bennett: On Taboola I used Shutterstock more.
[00:37:19] Brianne Hodenfield: Taboola also has Getty Images integrated. There may be enough there for launch. ChatGPT image editing has improved a lot too.
[00:39:02] Eric Roach: If someone has the Shutterstock credentials, Slack them to me so I don't have to dig through Dan's stuff.

[00:40:57] Eric Roach: Two more engineering tasks: push forward on the new redirect URLs, and get the revenue fire for the Facebook pixel moving forward. Also, if we test Taboola, we need to re-engage Taboola integration because it had been unhooked due to Strategis stats errors. That matters for both testing and the new listicle effort Bri is spearheading.

[00:43:26] Ben: If Andrew gets his account back, it might be good to start with a new redirect URL. Maybe use a new URL coming out of the gate, especially if the account has extra scrutiny.
[00:44:28] Eric Roach: Scott shared a clever naming convention idea. Once you roll it out, you need to know when and how to use it.
[00:45:21] Narbeh Ghazalian: Lean analyzed time from launch to first deceptive-advertising hit. It's all over the place, but the highest concentration seems to be around two weeks. We need a way to know once something is flagged so that redirect URL is flagged and does not get used again, even if it happens in eight days.
[00:47:41] Narbeh Ghazalian: If a redirect gets marked as spam through user feedback, we need to stop launching new campaigns on it immediately.
[00:48:08] Scott Anderson: I dropped a note in the ARB room. My thought is to prefix redirect names with a date window so buyers can know what to use by date. We could phase out old redirects rather than stopping them abruptly. If a redirect gets burned, we move to the next one.
[00:49:35] Scott Anderson: We can likely buy several at once and have them ready. The goal is to put the thinking into the dropdown so buyers don't have to think.
[00:51:56] Eric Roach: We also have a list of ad accounts that will be closed due to inactivity within 30 days of the notice date, and that notice was eight or nine days ago. So we have about three weeks to react. If ad-account capacity is constrained, it's probably worth getting something spending in there, but only safe things.

[00:52:58] Ben: For redirect domains, could we keep them similar by namespace, like Knowledge Warehouse variants and Spotted By Us variants, so people don't have to remember eight thousand different names?
[00:54:52] Scott Anderson: We may be able to use conditional dropdowns or backend logic. Broadly the concept makes sense. Before anything goes live, we can mock it up and make sure it matches how buyers actually need it to work.
[00:56:32] Andrew Cook: Even if Strategis auto-assigns the redirect, having similar names is still helpful because if you're in Facebook uploading the link and assigning a page, you can notice if it's wrong.

[00:58:22] Eric Roach: Let's go into quick buyer rotations.
[00:59:35] TJ Babbel: Costs have been a bit higher on Facebook and NewsBreak. Several categories contribute daily, but not with big enough margin to scale hard. I've been testing new categories, including many exploratory categories from System1. Some have good RPCs but are niche, like flood damage or general liability. The challenge is spinning them to a broader audience. I'm also launching more on Trivia Library for diversification. No major Facebook issues on my side, just the occasional rejection. The pipeline tool voice generation was erroring, but Ben explained the workaround.

[01:06:17] Phillip Bennett: I don't have much because I was out last week. I've been trying to define new categories by looking at ad-spy tools and seeing what works on native or Yahoo feed and whether we can rework those for Facebook. Hair clinical trials have had better RPCs and helped a bit.

[01:07:15] Andrew Cook: Without Facebook access, not much. I haven't been using the tool until we have a game plan. I've been launching some things on NewsBreak, mostly moving over categories I had on Facebook. For home-service categories, one angle that still works is cost-curiosity, like what is the average price of water damage or tree removal, rather than jobs framing.

[01:09:04] Ben: Channel is starting to creep back up. Also, there is a System1 data dump already in Lean's Vercel app under the `S1 INS` tab, and people may have missed it. You can look at categories, keywords, and states from a two-week snapshot of what System1 partners were running. High school diploma did better when the creative used minorities as the characters. Depression clinical trials, emergency loans, substance abuse, and belly fat removal may be worth a closer look. Uncategorized also hides useful keyword leads.

[01:16:18] Anastasia Uldanova: Not much on my side because of Facebook restrictions. I'm waiting to see what happens with Cook's account because that likely shapes the next step for me. I'm trying to scale NewsBreak a bit and build more of what is already working to keep a cushion.

[01:16:52] Brianne Hodenfield: Ben has done a thorough job onboarding Mike and me. I have to be out of town Thursday and Friday, but I'll still be reachable. Hopefully next week we'll really start getting spend under my name on Facebook.

[01:17:19] Ben: I removed Bri and Mike from the Nautilus manager to keep things clean.
[01:18:46] Meeting end.
```

## Key Facts Mentioned (quick capture)

- Fact: Anastasia's personal restriction remained unresolved; the team debated whether ad-account restoration could improve the chance of restoring the personal.
- Fact: Categorization-only rejections should be fixed immediately rather than left as open blemishes.
- Fact: Eric built three significant internal tools/lenses this week: non-producing-ad cleanup, easier from-scratch launch tooling, and a rejection/compliance Q&A system.
- Fact: Adnet BM daily revenue limit was increased from `$5,000/day` to `$10,000/day`.
- Fact: Simply World under-attribution was caused by a System1 segment setup issue, not poor traffic economics.
- Fact: Redirect rotation needs both scheduled cycling and early invalidation when a redirect shows deceptive-ad or spam signals.
- Fact: Several ad accounts may auto-close within roughly three weeks if not used.

## Attachments

- See related April 22 restriction review: [2026-04-22 outcomes](/Users/ericroach/code/liftoff/docs/operations/meetings/2026/2026-04-22-team-media-buying-facebook-restrictions/outcomes.md)
