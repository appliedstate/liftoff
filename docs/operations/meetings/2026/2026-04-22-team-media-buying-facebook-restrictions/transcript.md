---
date: 2026-04-22
title: "Media Buying — Facebook Restrictions Review"
type: transcript
participants:
  - Eric Roach
  - Anastasia Uldanova
  - Andrew Cook
  - Ben
  - TJ Babbel
  - Brianne Hodenfield
  - Mike Angelov
context:
  team: Media Buying / Facebook
  company: Liftoff
source:
  medium: google_meet
  recording: https://docs.google.com/document/d/1sYKwGG0YTv78jeDC6lgoBAiYgJo0f2ZC41RQWR1263o/edit?tab=t.dkbog54r2lup
  transcript_source: ai_paste_from_operator
tags:
  - meeting
  - media-buying
  - facebook
  - compliance
  - account-integrity
---

# Raw Transcript

> Transcript pasted by operator from the Google Meet transcript. Lightly normalized for readability only.

```text
[00:00:00] Anastasia Uldanova: I
[00:00:01] Eric Roach: I'm going to give it one more minute and we'll get going. Can you hear me? Testing. Testing anybody?
[00:00:08] Anastasia Uldanova: Yeah.
[00:00:09] TJ Babbel: Yeah, we got this.
[00:00:10] Anastasia Uldanova: We can hear you.
[00:00:12] Eric Roach: Okay. Ben was saying he couldn't hear me. He says it's a personal issue. He's in the office with me. We'll let Ben figure his sound out for a second and we'll go. Narv is traveling today, so I'm not expecting him to jump on. Scott, did you go to LeadCon? Not to put you on the spot. Right on. All right, Ben, can you hear? No. Let's give Ben another second. Ben, how's the sound going? I cannot hear you. Nope. Can you hear me? I'll start talking in here if you could just listen.

[00:03:10] Eric Roach: Let me take my headphones off and I can do speaker phone. All right. Can you guys hear?
[00:03:17] Brianne Hodenfield: Yep.
[00:03:18] Eric Roach: Perfect. Ben and I are sitting together in the office. I think we have a top priority today and we'll laser focus on the last 24 hours. Cook officially restricted, Anastasia later restricted. The two ad accounts went down. We obviously had the original ad account go down. We have other ad accounts that will be closing based on non-use. I don't know if that's just a tightening restriction. Worked into the evening with Lean trying to organize some of this. I've managed to get a good amount of the emails sent to my Nautilus email indexed, looking for patterns, and I'm sharing that information with Lean to garner insight on the back end.

[00:04:28] Eric Roach: Looking through the API again for patterns, there are three areas. Did Facebook tell us explicitly what they didn't like? Is there a gray zone we can argue one way or another? Or are we well away from that rail? My last comment to Ben before this call was thinking of Facebook as a parent. Usually you warn your kids before you punish them. Then you get into punishment state.

[00:05:43] Ben: You're good.
[00:05:44] Eric Roach: Right now we have 100-plus signals. Lean's traveling, so he's in and out. There are different hypotheses. Lean had an original hypothesis that we have thousands of ads and 100 rejections, so maybe that's not the signal. I said I don't disagree, but the reality is we have a multitude of ad accounts banned and two buyers banned. Even if it's a small signal in a bunch of ads, it upset Facebook enough that action happened. The other thing this morning, I don't know if you guys saw in the news, Meta is being sued for spam ads and fraudulent ads. It would not surprise me if there's a greater crackdown and concern and enforcement around things that touch that rail.

[00:07:07] Eric Roach: Compliance is tightening. Our thresholds in our account are growing in the sense that our punishments are becoming greater. The question is whether we can figure out what behavior Facebook identified, or get a good enough guess about what they didn't like, what they were upset we continued to do after they told us not to do it, and then after we kept doing it in other places they took action. Clearly this affects Andrew and Anastasia the most. What is highlighted is that it did not like behavior, and when it said stop that behavior, that behavior moved to another place and the person kept doing it. Another hypothesis is that Facebook can see if the person moved from being the person in the UX to still doing the behavior via the API, and thus the behavior continued.

[00:08:37] Eric Roach: The pattern showed the person closest to that behavior and it took action on that person. My theory is whether there is a way to think about how we want to approach this going forward. In the Nautilus account we have the Adnet business manager and other business managers. We have multiple lanes for how we want to approach Facebook, how buyers are touching Facebook, and what those patterns are, and then what we can do with that consultant: do we pick a certain ad account, get another buyer ID in there? No matter what direction we take, there is a pattern of behavior Facebook is enforcing, maybe to the extreme. The question is do we feel like we can identify the obvious, discuss the gray area, and find other areas where we can find growth and success that don't touch these hot zones.

[00:09:47] Eric Roach: What I want to discover is who's using Lean's tool to launch ads and how much. Cook and Anastasia, think about what you may be doing or what ads or categories may have triggered this. I'll circle back after this call and share findings from mining all that data. Then we can talk about how we want to move forward. I think we're at a point where if we continue whatever behavior they don't like, we're going to have more and more problems. The question is what is TJ doing differently? What is Phil doing differently? Was it bad luck? Were complaint rates on ads high? What can we do about that? Lean is convinced it has to do with ads in flight. They aren't getting caught when we launch them. Something is triggering while the ad is in flight: spot-check review, volume review, or sentiment in comments or consumers complaining.

[00:11:05] Eric Roach: Lean and I debated an example: if you're offering a Nissan Rogue for $100, Lean says that's false advertising, not fraud or a scam. I said you're giving people too much credit. If we're getting judged by humans who complain, the average person may just say "$100 for a Nissan Rogue is a scam." These are all hypotheses. What I believe is that if we keep amplifying bad behavior, it's only going to get worse for everybody in the business manager. The pattern is can we figure out explicitly what it told us not to do, how much of it we kept doing, and whether the tool amplified it. I don't want to create problems with the API. The API can keep Andrew and Anastasia going, but if we continue the behavior and amplify it through the API, is that just the next problem waiting to happen?

[00:13:38] Eric Roach: That's the state of the union. We obviously have the Adnet business manager. The question is if we have a hypothesis on the bad behavior in Nautilus, do we work not to transfer it there? I'll start with Anastasia because I know you raised your hand.

[00:14:00] Anastasia Uldanova: I wanted to bring a couple moments to attention while we figure out the pattern. Based on what you shared, the LLM helps you focus on something that is rejected, so it's going to be two things. When you focus on something rejected, you're missing that it may have been a campaign with three or four similar ads and only one ad got rejected. All the other three are fine and working. So it's not that Facebook doesn't like all of them. It's just one ad. At the same time, one campaign with a similar ad may have that ad rejected and another campaign with very similar ads, very similar message and everything, is still working in another account. That situation takes away clarity. We can't pinpoint what it was. If you analyze just rejected ads, you'll think okay we are not running diabetes trials, we are not running dental trials anymore, but that would be a false assumption because we are seeing other campaigns working with very similar messages.

[00:16:13] Anastasia Uldanova: Facebook is checking with some systems. They even tell us our technology is checking your ad and it got rejected for something. Sometimes the errors are just errors. For some diabetes trials the ad was rejected because of job and employment policy restrictions, but it's not jobs or employment. It can't even relate to that policy. It accumulates flags and makes the account look bad. You're saying Facebook sees that we're getting worse and implementing the same practice, but that's not technically true because when the first account was restricted with actual job offers, on the other account it was nothing close to that. It was not any job offers whatsoever, but somehow our account is getting banned for that. Jobs takes Facebook attention, but there are still campaigns with HVAC, delivery and so on operating fine. There is uncertainty and it doesn't help us make assumptions about what is okay and what is not okay.

[00:17:36] Eric Roach: Let me turn this back to you. I'm not saying my hypothesis is perfect. What is your hypothesis about why Facebook banned you?
[00:17:46] Anastasia Uldanova: It's a combination of errors with wrong classification of ads, but I don't see anything big or very different from what we run on other accounts.
[00:17:57] Eric Roach: So you're saying because Facebook hasn't caught those instances, they shouldn't be upset because they allowed other ones to happen?
[00:18:53] Anastasia Uldanova: What I'm trying to say is sometimes you think your daughter stole a cookie but she's not taking the cookie, she's just walking by it. When they classify a paid clinical trial as a job offer, that's a system mistake. That's not bad behavior.

[00:19:08] Eric Roach: Assuming they're wrong, that's fair. But if I'm wrong as a parent and I still run the household, if somebody wants to operate in my household they still have to abide by my mistakes or prove to me I should change the rules. The question is do we feel we're going to change Facebook's rules or systems? If not, we have to change our behavior and live with the fact that they're imperfect. Then what is our behavioral change?

[00:20:01] Eric Roach: If you were to play in that arena and ask why Facebook banned me, do we just not change our behavior and say Facebook's wrong and we're right? Or do we make informed decisions?
[00:20:28] Anastasia Uldanova: I didn't say that. The only reason I bring this up is to take informed decisions, because when we look just at rejected ads we are building our assumptions on the wrong foundation. We need to consider all other information, like what similar ads are not banned and why they are not banned.
[00:20:56] Eric Roach: If you know what you did wrong and they specifically told you what they didn't like, you probably shouldn't launch more copy like that. There's obscurity there, but here's reality: either Facebook mistakenly banned you, or they felt you were doing something wrong and banned you. If we're going to use the API, we should not exhibit the same behavior it is signaling to us.

[00:22:03] Eric Roach: It's like driving fast down the road, ignoring one sign, then another, and then you go off a cliff. At what point do we make some changes? What are those changes? Can we learn from our behavior? Do you have a guess at what Facebook didn't like to the point where they banned your personal account?
[00:22:59] Anastasia Uldanova: I'm not sure. You launch five ads in a campaign and one gets rejected. Then you launch another ad, very different, and that gets rejected as well. Over time the more you launch, the more rejected ads you have. Could that be accumulation of red flags? Also maybe how often we launch ads, the amount of campaigns, a lot of similar ads.

[00:24:09] Eric Roach: Another question: how disconnected is the copy from policy? If jobs is the most scrutinized category by Facebook, are you confident in your understanding of their terms and rules that you're dancing around it or in full breach?
[00:25:34] Anastasia Uldanova: With jobs we decided we just don't run it. We basically didn't run it, but HVAC and delivery jobs are still there and operating. Also before my account got restricted I didn't have a lot of ad rejections, so it wasn't a wild amount in one day.
[00:25:58] Eric Roach: So what do you think changed? Were you launching more through the API?
[00:26:10] Anastasia Uldanova: I'm not sure. That might be the case, but ads launched via API aren't getting rejected. It was just a lot of activity and Facebook might take that as suspicious activity because they don't like API calls too much.

[00:26:49] Eric Roach: So you're saying you wouldn't know how to change your behavior going forward?
[00:26:57] Anastasia Uldanova: I didn't say anything wildly different from what we have in other campaigns. If it's dental implants, it's always about get paid to get dental implants or find out what trials are available.
[00:27:12] Eric Roach: Fair point. If Facebook has bad detection and is highly concerned about job offers, scams and so on, how much of your campaigns revolved around getting paid to do something?
[00:27:32] Anastasia Uldanova: For poor profit maybe 30%. More like 50% of what we're doing together.
[00:28:04] Eric Roach: I'm not saying this is personal. I'm asking Ben and Cook the same stuff. I'm trying to figure out what they are trying to stop or slow down. This job stuff, scams, targeting certain classes of people, if that's the super hot zone, maybe we need to move away from it. We already decided with jobs that we needed to move away from that because it puts Facebook and Google at risk. What we're continuing to do is earn-money-to-do-something framing.

[00:30:08] Eric Roach: Maybe that doesn't cause a problem with Google, but it's possible Facebook is misclassifying it. Even if it's misclassified, that's possibly one of the things they don't like. It doesn't mean we can't run clinical trials. It may mean we have to be careful with how we frame it so it doesn't get classified as a job offer. Ben and I also ran into how Facebook defines terms like deceptive link. That label can cover cloaking, redirects, or the mismatch between ad copy and landing page. We were arguing different meanings. I don't want the Nautilus business manager to grind to a halt because that's existential.

[00:32:37] Eric Roach: There's nothing else working right now that everyone can jump into and solve fast enough. That's why I'm hyperfocused on what behavior should we stop. I use this call to collect enough information collectively. We may not even make the decision on the call. I want to go into research. I was working with Lean until 11 last night to crawl my Gmail, assemble it, classify it, and understand sequence and signals around ad rejections.

[00:34:43] Eric Roach: If Facebook said stop Anastasia from doing something, what was Anastasia doing? Maybe 10% of stuff clean, 30% gray, 40% false positive but touching it. Then I go to Cook and find patterns in both buckets. Did you guys do those patterns through the API? In multiple ad accounts? Do we change how we manage ad accounts? Do we containerize concepts? What do we do moving forward? I don't want the answer to be nothing because we're doing something wrong.

[00:35:34] Anastasia Uldanova: I totally get it. The only reason I keep comparing to other campaigns is to make sure we are looking in the right place.
[00:35:46] Eric Roach: Maybe there are lines in the sand. If we're so confident, let's appeal it. Or maybe we don't want to ask them to look more closely because then they realize we're much worse than what they already found. We have to unwind the mess and salvage this.

[00:36:32] Eric Roach: This kind of started with one ad account that got banned and then proliferated. If we look at the facts: one account went down, associated with employment fraud and jobs scale. Who was in that account? Did that behavior go elsewhere? Was there corollary behavior? If we're going to run get paid to do this clinical trial, we're touching jobs and health. Where does that fit in Facebook policy and what they care about right now?
[00:37:39] Eric Roach: If we're sitting in the hot zone, maybe we have to be careful or choose, of all topics in the world, to stop doing more of it. Like jobs: not shut it all off, but stop doing more of it. I think there's an area with Facebook where we have to make a similar decision. Facebook is trying to stop something. Can we guess at what it is and try not to do more of it? Doesn't mean turn it off, just don't do more of it.

[00:38:15] Anastasia Uldanova: Most bad rejections we have are in dental and diabetes. Can we talk with the consultant and ask what those ads might be interpreted as by Facebook as a job position? Clinical trials as a category are okay to run on Facebook. It's okay to say get paid because it's paid clinical trials. It's important to understand why our ads were taken as related to jobs.
[00:39:13] Eric Roach: I can ask, and we can do our own research on that. The first ad account that went down a month or two ago, was that yours?
[00:40:07] Anastasia Uldanova: Yeah. That was purely jobs and there was not even a chance to appeal because that was jobs.
[00:40:16] Eric Roach: Then the account that just went down yesterday, were you already operating in that account before the first one got banned?
[00:40:31] Anastasia Uldanova: It was already going.
[00:41:09] Eric Roach: How many ad accounts do you work in?
[00:41:14] Anastasia Uldanova: Before the last one went out, probably four. Two of them with one or two campaigns and another with more campaigns. That was the account with most campaigns.
[00:41:58] Eric Roach: So the first ad account was jobs. The second ad account was what?
[00:42:01] Anastasia Uldanova: Diabetes, dental, fat removal, some kind of medical things. It was not any jobs. One ad was rejected in gold IRA but just one ad.
[00:42:37] Eric Roach: So the second was overwhelmingly health and possibly health plus compensation. The other two accounts?
[00:43:00] Anastasia Uldanova: Cars and some kind of senior program, medical scooters. Very small. One account has diabetes campaign but it's not my account.
[00:43:44] Eric Roach: That's a decent stopping point. Cook, you ready?

[00:44:32] Andrew Cook: Yep.
[00:44:34] Eric Roach: You've only lost one ad account?
[00:44:37] Andrew Cook: Just this one the other day.
[00:44:40] Eric Roach: How many ad accounts do you operate in?
[00:44:43] Andrew Cook: Three in total where I have ads running. Two are just mine and one is an initial one with stuff copied from Ben and others when I first started.
[00:45:37] Eric Roach: The ones you operate in are containerized to your activity. What's in those containers?
[00:45:46] Andrew Cook: Some are just a mix of everything. When my account got suspended it was because of that one job ad. That ad was in the account now banned. When that happened, everything running got deleted, including job stuff. The only thing I kept on was HVAC jobs in a different ad account that is still continuing to run. I couldn't delete the offending campaign out of the disabled account.

[00:46:36] Andrew Cook: There were clinical trial stuff, car stuff, tree removal, apartments, everything. It wasn't siloed.
[00:47:29] Eric Roach: If you broadstroke the disabled account, what percentage was jobs, health, health plus get paid?
[00:48:38] Andrew Cook: In the last 30 days, top campaign was free tree removal, second was diabetes, then cruise and cell phone. There wasn't much. In the one other account still running, top is Nissan Rogue, then HVAC delivery, then diabetes. There are three diabetes campaigns in the running account that all spent about five grand.

[00:49:36] Eric Roach: When you got your first suspension, what was it for?
[00:49:41] Andrew Cook: Home repair jobs. Fraud scam.
[00:49:48] Eric Roach: What do you think triggered the further restriction?
[00:49:54] Andrew Cook: I changed the Facebook page so Anastasia could have more. I launched stuff on there. I think TJ launched stuff on there too. When I click my restriction now, the old one says I can't run ads until April 29. The new one says I can't create or manage pages, groups or events, ending May 20.

[00:51:14] Eric Roach: That's actually a positive. Anastasia, do you have time restrictions or were you fully banned?
[00:51:26] Anastasia Uldanova: I don't have any time restrictions. It's just banned.
[00:51:44] Andrew Cook: If you go to facebook.com/account_status it lists your stuff.
[00:52:02] Andrew Cook: Everything I've launched for the tool hasn't even gotten an ad rejected. The only thing I think might have triggered it was I launched substance abuse trials in two different ad accounts. Same headlines, different videos. Usually I don't do that. I wanted to run something potentially. The ad copy is super basic: participate in a free trial and you could receive compensation. The headline was find trials in your area.

[00:52:55] Anastasia Uldanova: It's probably the same.
[00:53:44] Eric Roach: We should consider video transcripts too. These models can catch anything said in the soundtrack and judge it.
[00:53:44] Andrew Cook: Also, the videos are not mine. I pulled them from the wild, including probably the ad copy too.
[00:54:04] Eric Roach: That's very interesting. What is the risk of ripping and running from the wild? If Facebook already linked a bad actor and those ads start showing up in another account, it may cluster those accounts.
[00:54:52] Ben: Everybody uses other people's ads to some degree on Facebook. This seems way down the list.
[00:55:12] Eric Roach: I'm not arguing that concept, only that Facebook may graph bad actors and imported ads.
[00:55:58] Anastasia Uldanova: It's an interesting theory because the first systematic ad rejections we started to get were with jobs and that was an ad from Foreplay.
[00:56:45] Eric Roach: If we're going to make rules, one might be: be careful with rip-and-run ads in highly sensitive areas.
[00:57:40] Ben: We can get crippled by speculation. If I'm trying to adhere to new rules, I want one to three, not twenty.
[00:58:30] Eric Roach: Fair. I'm trying to collect enough information so our ideas come together. I want to reach out to this consultant. Do we know if we fix an ad account and do certain things, does it clear history? The biggest positive I've heard from this call is Cook has an end date on his penalties.

[00:59:32] Eric Roach: Cook, if you don't know what got you in trouble and you want to come out of the trouble zone, what would you stop doing?
[01:00:22] Ben: New URLs would go a long way. We can pause low-value campaigns to get a new URL and reset complaint ratio. Also, some ad accounts seem hot. Maybe new URL, new page, new account as a safety net.
[01:01:26] Eric Roach: That's doable. That goes to the reset-to-complaint-ratio hypothesis. But if we start using them, what are we putting in them? Maybe we should get ahead of account expiration with safe things.

[01:02:17] Eric Roach: Cook, your theory was maybe the Foreplay ads from another business manager used in two different ad accounts?
[01:03:24] Andrew Cook: Yes. For substance abuse there were two ads from the wild from probably the same advertiser: a construction worker style and a woman style. Normally I would launch those in the same ad account. I used another account to get access to a different page because of the tool limit.
[01:04:04] Eric Roach: You don't know whether the transcript has get paid or make money in it?
[01:04:11] Andrew Cook: It probably does. I could find it and track it down.
[01:04:53] Andrew Cook: On my account status the number one thing it shows is the previous employment fraud scam offense on March 30. Then on April 20 a page was removed for multiple issues, the healthy living page that a bunch of us run on. Then another strike from November that I can't click.

[01:05:59] Eric Roach: So we have clone-other-ads, same messaging across two ad accounts, same health area, and likely get-paid framing.
[01:06:51] Ben: Did you get an account-integrity one?
[01:07:33] Eric Roach: On April 20 at 6:58 a.m. there was an email from Knowledge Warehouse AU saying Meta says the account was trying to find a way around our rules, which violates advertising standards on account integrity. Another email at the same time said the same on Spotted By Us. So same category, same ad as another business manager, two ad accounts, both health, both likely get-paid health.

[01:08:53] Andrew Cook: Around the same time we had that Facebook page go down.
[01:09:00] Eric Roach: Are they both linked to the same page?
[01:09:03] Andrew Cook: Yeah, Anastasia is definitely running on that healthy living page and I probably am too.
[01:09:33] Eric Roach: So ad accounts are not dedicated to pages?
[01:09:38] Anastasia Uldanova: All accounts are not dedicated to a single page. Each account has different pages running.
[01:09:53] Andrew Cook: We used to do that but stopped when all the buyers came on and we ran out of accounts.

[01:10:45] Eric Roach: Anastasia, were you doing anything around the same time that might relate to Cook's pattern?
[01:10:55] Anastasia Uldanova: I didn't launch any Foreplay ads at the time, but similar copy. Last rejected one was diabetes and rejected with job things, which is weird. I didn't forget the soon-to-be-disabled accounts. Maybe we need small save campaigns like Nissan sales to keep them alive.
[01:12:07] Eric Roach: Fresh URLs is one action item. Another is to review expiring ad accounts and see how we can salvage them. Cook has a timeline. Anastasia, it would be good to know if you have a timeline or if it's fixed.

[01:13:21] Andrew Cook: In the disabled account maybe 30% to 40% was trials. The rest was tree stuff, auto, senior cell phone and cruise.
[01:13:47] Eric Roach: And the unaffected account?
[01:13:53] Andrew Cook: The one still running is probably 60% jobs and free trials. The one currently running has a higher density than the one that went down.
[01:14:33] Eric Roach: Are those campaigns newer or older?
[01:14:37] Andrew Cook: The spend is older for sure. I think I might have been launching more of the new stuff in the other one because of page restrictions.

[01:15:23] Andrew Cook: When I look at account status, a page called Money Matters says it is at risk. It's a Facebook page a lot of stuff runs on.
[01:16:06] Eric Roach: If anyone is heavily relying on that, note that.

[01:17:16] Ben: I thought Andrew's account was restricted for good this last time. My initial theory was that behavior via the API is what did it because it got both Andrew and Anastasia at the same time. But maybe that's not right.
[01:18:03] Andrew Cook: I think the issue might be I changed the page name on Friday so Anastasia could use it, then launched ads there. That might be the circumvent thing.
[01:18:51] Eric Roach: So what ad account of yours was running to that page?
[01:18:57] Andrew Cook: The one that got shut down.
[01:19:48] Andrew Cook: TJ may also be running there. The new page is called Daily Tips.
[01:20:10] TJ Babbel: I have quite a bit running on that because that's the one we lost the healthy living page in. I've rebuilt quite a bit using that page now.
[01:20:32] Eric Roach: What are you mostly running?
[01:20:35] TJ Babbel: A lot of dental. Even apartments. Quite a few different things.
[01:20:43] Eric Roach: Are you running health stuff like get paid to do dental?
[01:20:48] TJ Babbel: Yeah. Videos have dollar amounts in them still. Same angle we've been using: get free teeth, you might also get paid up to X dollars, mostly 1500.
[01:21:03] Eric Roach: What percentage of your portfolio is health slash get paid?
[01:21:10] TJ Babbel: 60% to 70%. Dental has been the highest-spending category for a while. Every dental implant clinical trial ad implies you're getting paid.
[01:21:32] Eric Roach: Do you categorize them as jobs?
[01:21:39] Andrew Cook: I categorize them as financial opportunities, or financial products and services.
[01:21:49] TJ Babbel: I don't. I try to make the trial and science thing the focus and have payment seem like an added bonus.

[01:22:24] TJ Babbel: I used to categorize them as jobs and wasn't getting many rejections on dental overall. That's not one I was seeing a bunch of rejections on.
[01:23:31] Andrew Cook: My recent ones are more like an individual talking saying I got paid to participate in this program. TJ's may be more this program is happening and you can earn money by applying.
[01:24:27] Eric Roach: If you have AI, these tools can detect whether ads were created by AI. If you have an AI person saying I did this, Facebook may see you impersonating a person with a digital avatar claiming they actually did something.
[01:25:08] Anastasia Uldanova: For some, it's more you can earn up to something.
[01:25:22] Eric Roach: So you lead with the money. That's a pattern: one style leads with the thing and says also you could get money, and another leads with the money and then the thing.

[01:25:38] Ben: I run ads from Foreplay. I run clinical trial stuff. I usually say something softer like get compensated for time and travel and clinical trials. I don't put a dollar amount in there specifically if I make the ad. I don't categorize anything as clinical trials and I haven't had issues with that.
[01:26:53] Eric Roach: Is there a signaling issue if Cook used financial services or financial products?
[01:27:43] Ben: It's not a financial service, and that's why I don't categorize it like that.
[01:27:43] Andrew Cook: Maybe I mislabeled it, but none of mine were rejected recently.
[01:28:41] Eric Roach: So the tool launch itself wasn't the thing that got rejected for you, it was the page restriction?
[01:28:47] Andrew Cook: My current restriction, yes.

[01:29:53] Ben: I'm going to pump the brakes on using the Nautilus business manager for a little bit. I've been having calls with Mike and Bri and trying to get them up to speed. Rather than bounce back and forth, I may move over there for a bit and get everything set up. I'm not going to turn anything off necessarily, but I don't know that I'm going to add new stuff there.
[01:30:58] Andrew Cook: I appealed the ad account restriction. I hit the button, thought it would ask questions, but it just submitted and got rejected 30 minutes later.
[01:31:56] Anastasia Uldanova: The safe account to appeal would be Knowledge Warehouse AU because that doesn't have any job. There we can build the case it is not jobs. Also maybe appeal the account first before the user, because if the account appeal works in our favor, maybe there is no ground to punish the user.

[01:31:56] Eric Roach: When we're using the API, are you rapidly launching or pacing it like a human?
[01:32:19] Andrew Cook: I was hitting rate limits with uploading creatives. Lean was going to devise a plan to figure out restrictions. I wasn't launching many campaigns, just ads within the campaign.
[01:33:22] Anastasia Uldanova: We just launched our API tool, so maybe that was flagged as unusual activity. A reviewer may just see systems messages. That might help us build a case. For me, it wasn't launching too many ads active with the tool, but a lot of campaigns copied, maybe 100 times, in 10 minutes five campaigns to see if it goes through. That could put the account on alert. It's not necessarily bad, but unusual.

[01:34:12] Eric Roach: Facebook likely knows the behavior of the individual and if the behavior continues it associates who is closest to it. If you're the only person working in that ad account and launching more campaigns through the tool, it's still going to assume it's you.
[01:35:19] Andrew Cook: I'm uploading with the tool and also have Facebook open in the browser refreshing to see if the ads land. I couldn't touch some things but I could pause and adjust budgets sometimes. If I log in, change a budget once, it works, then another one says I'm restricted. It's glitchy. That could be how they connect the dots.

[01:37:10] Anastasia Uldanova: The copied campaigns and unusual launch volume could be the issue, even if not the primary one.
[01:38:26] Eric Roach: I think that covers it. Is there anything anyone wants to add?
[01:38:40] Andrew Cook: One other thing. In the tool, when you upload, there was a field showing how it got uploaded to Facebook. I saw Lean's email in there, and then at one point it switched to something app-something. I don't know if that throws a flag. I need to revisit that with Lean.
[01:40:37] Eric Roach: I'm going to share this article about Facebook and dig on how getting paid could correlate with jobs. The thematic thing I see is compensation for health or jobs. That seems to be the one theme. Tread lightly there. If there is ground to be gained in auto, tree service or other areas, be conscious of them. Rapid-fire launching things in areas that touch the third rail, be careful for the next day or so.

[01:42:10] Eric Roach: Keep an eye on things. Anastasia, let us know if you have timelines in your restrictions.
[01:42:16] Anastasia Uldanova: I didn't have any time restrictions. It's just banned.
[01:42:27] Ben: I came across an ad rejection for intellectual property violation. It looks like it's for the solar thing.
[01:44:21] Mike Angelov: Can you speed me up on the categories I should stay away from? This is my second account. I verified the first one with my passport and ID. I don't think I'll go through the cracks a third time if that account gets flagged.
[01:44:46] Ben: Definitely stay away from anything jobs.
[01:45:00] Eric Roach: Here's a funny one. The article came out on 4/21. It wouldn't shock me if, on the day the lawsuit was filed, policy tightened.

[01:46:21] Eric Roach: We had a good enough session. Anything else?
[01:46:28] Anastasia Uldanova: A couple questions. Ben, do you see any status change for that ad you tried to appeal?
[01:46:36] Ben: It's still under review. A human might be reviewing it and not just a bot.
[01:46:53] Anastasia Uldanova: Are you going to appeal the ad account?
[01:47:00] Ben: I don't know. Everything in there has a legitimate reason. I worry about people looking too closely at this stuff.
[01:47:16] Anastasia Uldanova: At some point we need to decide whether we appeal or not. Without that we can't go any further.
[01:47:27] Ben: That's the Adnet business manager. I don't know. I also have the same restriction where I can't add Facebook pages anymore.
[01:47:41] Eric Roach: Let's put a to-do checklist in the channel because there are enough floating pieces that some stuff will get forgotten. If you want to explore something, toss it in there and we'll execute off that.
[01:48:58] Anastasia Uldanova: Bye guys.
```

## Key Facts Mentioned (quick capture)

- Fact: Multiple buyer restrictions and ad-account restrictions hit within roughly the same 24-hour window.
- Fact: `Knowledge Warehouse AU` and `Spotted By Us` both received account-integrity / circumvention language on 2026-04-20.
- Fact: `Healthy Living` page was removed; `Money Matters` page was reported as at risk; `Daily Tips` was being used as a replacement page.
- Fact: Clinical-trial creative was often framed around compensation, sometimes with dollar amounts, and sometimes reused from the wild / Foreplay.
- Fact: API/tool usage included high-volume copying and rapid launch behavior that may have appeared non-human.
- Fact: Existing page/account isolation had eroded; multiple buyers and pages were mixed across accounts.

## Attachments

- Google Doc transcript source: [Apr 22, 2026 transcript](https://docs.google.com/document/d/1sYKwGG0YTv78jeDC6lgoBAiYgJo0f2ZC41RQWR1263o/edit?tab=t.dkbog54r2lup)
