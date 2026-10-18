# Intermittent-Fasting App Market — Feature Intelligence Report

**Prepared for:** FastLoop (clean-room fasting tracker) build prioritisation
**Date:** 2026-10-18
**Scope:** 14 named target apps + ~25 additional apps encountered + 4 adjacent health apps

---

## 0. Method, access constraints, and honesty notes

### 0.1 Hard access constraint (important — read first)

**All direct page fetching failed in this environment.** Both `WebFetch` and `curl` were blocked for *every* host tried, not just app stores:

| Host | Result |
|---|---|
| `apps.apple.com` | `getaddrinfo ENOTFOUND` / proxy `403` on CONNECT |
| `play.google.com` | proxy `403` on CONNECT |
| `screensdesign.com` | `getaddrinfo ENOTFOUND` |
| `healthreporter.com` | `getaddrinfo ENOTFOUND` / proxy `403` |
| `en.wikipedia.org` (control) | `getaddrinfo ENOTFOUND` |

The egress proxy refused CONNECT for all of them (`connect_rejected`, "gateway answered 403"). **Therefore every fact in this report comes from web-search result snippets and the synthesised summaries the search tool returns, not from reading the source pages directly.** I could not view a single app screenshot, paywall screen, or store listing with my own eyes.

Practical consequences:
- **No screenshot-level UI verification.** Everything in the Visual/UI section is reconstructed from prose descriptions in reviews, teardown-site metadata, and developer copy. Where I describe a visual device, I say who described it.
- **Quotes are second-hand.** Review quotes below were surfaced by the search tool from App Store / Google Play / Trustpilot pages. They are reproduced as the tool returned them. I did not independently open the review page, so I cannot verify attribution, date, or that the quote is complete. Treat every quote as "reported by search, unverified at source."
- **Prices are especially unreliable.** Fasting apps use regional pricing, promo pricing, and in several documented cases *variable pricing driven by the onboarding quiz*. Where sources conflict I list all figures rather than averaging.

### 0.2 Confidence markers used throughout

| Marker | Meaning |
|---|---|
| **[V]** | Verified — a first-party source (developer help centre, official blog, official store listing text) was quoted in a search result |
| **[S]** | Secondary — a third-party review or comparison site asserted it; plausible but unconfirmed |
| **[C]** | Competitor-sourced — asserted by a company selling a rival app; treat as adversarial marketing |
| **[U]** | Unconfirmed — I could not establish this either way |
| **[I]** | **Inference** — my own reasoning, not a sourced claim |

### 0.3 A note on the source pool's quality

The fasting-app review ecosystem is heavily polluted. A large fraction of "Best Fasting Apps 2026" pages are published by companies selling competing fasting apps (`nutriscan.app`, `nutrola.app`, `easyfasting.net`, `swoodie.app`, `getfasted.app`, `intermittentfast.ing`, `habitbox.app`, `fitness-tracking.com`). These are marked **[C]**. Affiliate-driven review farms (`healthreporter.com`, `fastingapps.com`, `bestfastingapp.com`) are marked **[S]** with reduced weight. Developer help centres and official blogs are the only consistently trustworthy tier.

---

## 1. Apps surveyed

### 1.1 Primary targets

| App | Vendor | Positioning | Research depth achieved |
|---|---|---|---|
| Zero (Zero Longevity) | Zero Longevity Science / MyFitnessPal | Premium single-purpose fasting timer | **High** — official zones doc + help centre + teardown metadata |
| Fastic | Fastic GmbH (DE) | Gamified fasting + food scanning + community | **High** |
| BodyFast | BodyFast GmbH (DE) | Adaptive weekly coach | **High** — official help centre |
| Simple (Simple Life) | Simple.Life | AI coach ("Avo") first, fasting second | **High** |
| DoFasting | Kilo Health | Paid-first fasting + workouts + recipes | **Medium-high** |
| Yazio | YAZIO GmbH (DE) | Calorie tracker with fasting module bolted on | **Medium-high** — official help centre |
| LIFE Fasting Tracker | LifeOmic | Social "Circles" + biomarker logging | **Medium** — current status unclear |
| Window | — | Minimalist iOS timer | **Low-medium** — thin coverage |
| Clear (fasting) | **three different apps share this name** | Minimalist timer | **Medium** — see §1.3 |
| FastEasy | FastEasy / fasteasy.io | Timer + stages + recipes | **Medium** |
| Fasting Coach | — (`weightloss.fasting.tracker`) | Timer + body status + AI food scan | **Low** — no independent review exists |
| GoFasting | Gulooloo Tech | High-volume mass-market timer | **Medium** |
| Femometer Fasting (a.k.a. "Fastin") | Femometer / Lollitech | Women-oriented fasting + lifestyle logging | **Low-medium** |

### 1.2 Adjacent apps examined for borrowable ideas

MacroFactor, Cronometer, RISE Sleep, MyFitnessPal.

### 1.3 Name-collision warning: "Clear"

Three distinct apps are called Clear in this category. Do not conflate them:

1. **Clear – Intermittent Fasting (ZipoApps, iOS)** — 4.7 rating / 552 ratings [S]. Simple 16:8 timer. ~$27.99/yr [S].
2. **Clear Intermittent Fasting (Whisp, `de.whisp.clear`, Google Play)** — fasting timer widget, water tracker, weight tracker, meal planning with recipes, 20+ fasting programs [S].
3. **ClearFast (Magency Consultants, iOS)** — explicitly minimalist: "no ads, no accounts, no bloat"; local-only data; 16:8 / 18:6 presets; theme picker with premium themes; dark default [S].

---

## 2. Bucket A — Core timer and fasting mechanics (beyond start/stop)

| # | Feature | Concretely what it is | Apps | Free/Paid | User sentiment / evidence | Source |
|---|---|---|---|---|---|---|
| A1 | **Metabolic phase / stage timeline** | The fast is divided into named physiological zones (anabolic → catabolic → fat burning → ketosis → deep ketosis) and the timer shows which one you are in now. | Zero, Fastic ("Body Status"), BodyFast, FastEasy, Fasting Coach, Femometer ("Body Status"), Unfed, FastingCat, Keto Kit, Intermittent, Fastora | Zero: free stages, but **Zero Plus** adds tracked time-in-Fat-Burning **[V]**. BodyFast: "fasting-stage explanations" listed as free **[V]**. Fastic: Body Status listed free **[C/S]** | FastEasy reviewer: *"the immediate feedback as to where I am in time is a highlight"* **[S]** | [Zero zones](https://zerolongevity.com/blog/lose-weight-and-burn-fat-with-personalized-fasting-zones/), [Zero help](https://zerofasting.zendesk.com/hc/en-us/articles/21216678252187-Fat-Burning-Mode), [BodyFast Play](https://play.google.com/store/apps/details?id=com.bodyfast) |
| A2 | **Personalised stage boundaries** | Stage entry times are computed per-user from onboarding answers rather than fixed. Zero: *"The exact entry time will vary depending on information you provide during onboarding."* | Zero (Plus) | Paid **[V]** | — | [Zero help centre](https://zerofasting.zendesk.com/hc/en-us/articles/21216678252187-Fat-Burning-Mode) |
| A3 | **Weekly adaptive plan regeneration** | A coach algorithm issues a *new* fasting plan every week based on goals and progress, rather than the user picking one window forever. | BodyFast ("the Coach calculates the optimal fasting plan for you every week") | Coach = paid **[V]** | Positive: a reviewer liked *"the different plan making it easy to change plan every week"* keeping it interesting **[S]**. Negative: *"the paid plans aren't too diverse and many of them can be quite repetitive in nature"* **[S]** | [BodyFast coach blog](https://www.bodyfast.app/en/blog/intermittent-fasting-coach) |
| A4 | **Joker Day** | One day per week where no fasting is required; the plan week is then *extended by a day* so all planned fasts still complete. | BodyFast | Coach-only (paid) **[V]** | Complaint: *"so the only solution they offer is to cancel the whole day and use the joker day?! So, I have to make my own schedule outside of BodyFast"* **[S]** | [BodyFast help](https://help.bodyfast.app/hc/en-001/articles/34652209248914-How-do-I-adjust-my-fasting-plan) |
| A5 | **Large preset library** | Far more than the usual 6–8 windows. BodyFast lists "more than 10 customizable fasting plans" as free **[V]**; Whisp Clear claims "20+ fasting programs" **[S]**; Yazio PRO claims "over 10 guided fasting programs" **[S]** | BodyFast, Clear (Whisp), Yazio, Fastic | Mixed; Yazio gates all but 16:8 **[V]** | Clear (ZipoApps) complaint: *"there are not too many fasting customization options available for fasting times"* **[S]** | [Yazio help](https://help.yazio.com/hc/en-us/articles/11804776635281-Tutorial-of-the-Yazio-app) |
| A6 | **Arbitrary / alternate-day / circadian schedules** | Not just N:M daily windows — supports alternate-day fasting and circadian-rhythm fasting. LifeOmic: *"supports any type of fasting or fasting schedule, including time-restricted feeding, circadian rhythm fasting, alternate day fasting and others."* | LIFE Fasting Tracker | Free tier **[V]** | — | [LifeOmic announcement](https://medium.com/lifeomic/seize-life-fast-lifeomic-releases-life-fasting-tracker-app-73b38daa7e53) |
| A7 | **Retroactive fast editing** | Ability to fix a forgotten start/stop after the fact. **This is a recurring failure point, not a strength.** | Most apps nominally; executed badly in several | — | Clear: *"some users mention forgetting to mark that they've ended their fast and are unable to go back and change it"* **[S]**. LIFE: a recent update *"made editing fast start and stop times harder"* **[S]** | [fastingapps.com Clear review](https://fastingapps.com/clear-review/) |
| A8 | **Protein Fasting** | A distinct protocol mode (restricting protein rather than all calories), advertised alongside time-based fasting. | Fastic | Unconfirmed tier **[U]** | — | [Fastic Play listing](https://play.google.com/store/apps/details?id=de.fastic.app) |
| A9 | **Siri / voice control of the timer** | Start or end a fast by voice without opening the app. | Window | **[U]** | — | [iphoneness roundup](https://www.iphoneness.com/iphone-apps/ios-apps-for-fasting/) |
| A10 | **Pre-end notification** | A heads-up *before* the fasting window closes, not just at zero. | ClearFast | Premium themes exist; notification tier **[U]** | — | [ClearFast listing](https://apps.apple.com/us/app/clearfast/id6756589039) |
| A11 | **Offline-first operation** | Timer and logs work with no network and no account. Notable because Zero explicitly *lacks* this on Watch: *"At this time, there is no offline mode for Zero on Apple Watch."* **[V]** | EasyFasting **[C]**, ClearFast, Fast-E, ZenFast, FasTCoach | Free in those apps **[S]** | — | [Zero Watch help](https://zerofasting.zendesk.com/hc/en-us/articles/360008775614-Using-Zero-with-Apple-Watch) |
| A12 | **Pause / suspend a plan** | Temporarily halt a schedule for travel or illness. **Notable as a documented gap.** | — (absence) | — | Simple complaint: users are *"unable to pause or adjust their schedules, which may be needed for traveling or if they're under the weather"* **[C]** | [lasta.app](https://lasta.app/blog/lasta-vs-simple-life-review/) |

**FastLoop gap note [I]:** FastLoop already has A1 (phase timeline) and preset windows. The unowned mechanics worth considering are **A3/A4 (adaptive weekly plan + a sanctioned skip day)**, **A7 (genuinely good retroactive editing — a category-wide weak spot)**, and **A12 (pause)**. A4 and A12 are cheap to build and directly answer documented complaints.

---

## 3. Bucket B — Tracking and data

| # | Feature | Concretely | Apps | Free/Paid | Evidence | Source |
|---|---|---|---|---|---|---|
| B1 | **Weight + BMI** | Universal. Chart over time. | Essentially all | Usually free | — | — |
| B2 | **Body measurements** | Waist, hips, chest, upper arms, thighs as separate tracked series. BodyFast's own guidance: *"chest, waist and hips are considered to be more or less standard"* with upper arms and thighs *"a useful supplement."* | BodyFast **[V]**, Zero (arms, waist, hips) **[S]** | BodyFast free tier includes "Track your weight and body measurements" **[V]** | A BodyFast reviewer *"wished it charted more measurements"* **[S]** | [BodyFast measurement guide](https://www.bodyfast.app/en/measure-fasting-success/) |
| B3 | **Progress photos** | Front / side / back / freestyle photo series. | **Not confirmed in any of the 13 primary targets.** Found only in a third-party IF tracker and in general body-comp apps **[S]** | — | — | [nutriscan comparison](https://nutriscan.app/blog/posts/best-app-progress-photos-body-measurements-2026-a165923349) |
| B4 | **Ketone + blood glucose logging** | Manual entry of blood ketone (mmol/L) and glucose readings, charted against fast duration. | LIFE Fasting Tracker **[S]**, Metabolica **[S]**, KetoLogger **[S]** | LIFE: **free tier** **[S]** | — | [bestfastingapp LIFE review](https://www.bestfastingapp.com/reviews/life-fasting-tracker-review/) |
| B5 | **Mood journal** | Log how you felt; correlate with fasting state. | LIFE (free) **[S]**; Zero (**tier disputed** — one source says free, a newer one says Plus-only) **[S]**; Metabolica *"log how you feel each day and connect changes in mood with your metabolic state, sleep, fasting and daily habits"* **[S]** | Disputed for Zero **[U]** | — | [metabolica.health](https://www.metabolica.health/) |
| B6 | **Sleep logging** | Sleep schedule as a tracked input feeding insights. | Femometer **[S]**, Fastic (via Fastic Score) **[V]** | Fastic Score listed free **[C/S]** | — | [Fastic Play](https://play.google.com/store/apps/details?id=de.fastic.app) |
| B7 | **Hydration** | Near-universal. Zero Plus adds "advanced hydration" **[S]**. Yazio ties hydration goals to the eating window **[S]**. | All | Usually free | — | — |
| B8 | **Step counting** | In-app pedometer or Health import. | Fastic (free) **[C/S]**, GoFasting **[S]**, DoFasting **[S]**, Zero (via HealthKit) **[V]** | Mostly free | DoFasting complaint: *"My step tracker is electronic, but it's neither one of those options so I couldn't even manually input my step count."* **[S]** | [DoFasting reviews](https://apps.apple.com/us/app/dofasting-intermittent-fasting/id1456288628?see-all=reviews) |
| B9 | **AI photo food logging** | Photograph a meal; the app identifies food and estimates calories/macros. **This is the single fastest-spreading feature in the category.** | Simple ("Avo Vision" / Nutriscanner) **[V]**, Fastic ("Food Scanner") **[V]**, GoFasting ("AI calorie scanner") **[S]**, Fasting Coach **[S]**, Zero Plus (photo meal logging w/ macro analysis + protein score) **[S]**, Cronometer (Photo Log) **[S]** | Simple: 1 scan/day free, unlimited paid **[C]**. Fastic: basic free, "advanced" in Plus **[V]** | GoFasting complaint: *"AI scanner is not properly working and not showing correct calories the food contains"* **[S]**. Simple: *"can misidentify complex dishes"* **[S]** | [Simple Avo Vision help](https://help.simple.life/en/articles/11113965-avo-vision) |
| B10 | **Restaurant menu scanner** | Point at a restaurant menu; app recommends dishes matching a diet preference (low-carb, vegan, high-protein). **Genuinely unusual.** | Fastic | Basic free / advanced in Plus **[V]** | — | [Fastic Play](https://play.google.com/store/apps/details?id=de.fastic.app) |
| B11 | **Body scan for composition** | Camera-based body-composition tracking over time (separate from meal scanning). | Simple (Avo Vision body scan) | **[U]** | — | [Simple help](https://help.simple.life/en/articles/11113965-avo-vision) |
| B12 | **Smoothed weight trend line** | Daily weigh-ins are noisy; the app computes and displays a smoothed trend instead of the raw sawtooth. MacroFactor applies *"smoothing to body-weight data"* because *"a single weigh-in can deviate from true body-composition weight by 1–3 kg."* | MacroFactor **[S]**, and a generic fasting tracker claiming a trend line *"to smooth out daily fluctuations"* **[S]** | MacroFactor has no free tier **[S]** | — | [calorie-trackers MacroFactor](https://calorie-trackers.com/reviews/macrofactor/) |
| B13 | **CSV / data export** | Export history. | FastLoop has it; NutriScan lists CSV export in its free tier **[C]**; Cronometer Gold has printable reports **[S]** | — | — | — |
| B14 | **Journaling-first model** | The fast record *is* a journal entry — free-text notes on how the fast felt, reviewed as charts over time. | Fastient (*"You log your fasts, add notes about how you felt, and review charts over time"*) **[S]** | Open-source / free **[S]** | — | [easyfasting roundup](https://easyfasting.net/blog/best-free-fasting-app) |

---

## 4. Bucket C — Insight and coaching

| # | Feature | Concretely | Apps | Free/Paid | Evidence | Source |
|---|---|---|---|---|---|---|
| C1 | **Conversational AI coach** | A chat agent answering fasting/nutrition questions and reacting to logged data. | Simple ("Avo"), Fastic ("Fasty"), FasTCoach | Simple: ~2 replies/day free, unlimited paid **[C]**. Fastic: Fasty listed free **[C/S]** | *"Avo… reacts to what you log and nudges you when your patterns slip"* **[C]**. Criticism across category: AI coaching *"feels generic"* **[S]** | [Simple review roundup](https://nutrola.app/en/blog/simple-vs-zero-vs-fastic-fasting-apps-2026) |
| C2 | **Voice-call coaching** | Literal phone calls with the AI nutritionist; **meals mentioned in conversation are auto-logged**. Announced 2026-01-05. | Simple ("Avo Voice") | Paid tier **[U]** | — | [PRWeb announcement](https://www.prweb.com/releases/simple-launches-expands-on-its-anti-discipline-ai-coach-with-voice-calls-302652009.html) |
| C3 | **Composite daily health score** | One 0–100-ish number rolling up several behaviours. Fastic Score spans *"nutrition, activity, hydration, sleep, and more, with personalized insights."* Keto Kit has a daily 0–100 Keto Score. | Fastic **[V]**, Keto Kit **[S]** | Fastic Score listed free **[C/S]** | — | [Fastic Play](https://play.google.com/store/apps/details?id=de.fastic.app) |
| C4 | **Adaptive TDEE / closed-loop targets** | Instead of a fixed formula, infer real energy expenditure from the relationship between logged intake and the weight trend, and recalculate targets weekly. Self-corrects for systematic under-logging. | MacroFactor | No free tier **[S]** | The strongest "borrowable" idea found in the adjacent set **[I]** | [caleye analysis](https://caleye.fit/blog/macrofactor-tdee-tracking-accuracy/) |
| C5 | **Rolling debt metric with recency weighting** | RISE's sleep debt: *need minus actual, rolled over 14 nights, with recent nights weighted more*, surfaced as one number in hours, plus a 0–100 "Energy Potential" score. Built on the SAFTE model. | RISE | $69.99/yr after 7-day trial **[S]** | Directly transplantable to fasting adherence **[I]** | [RISE review](https://www.risescience.com/blog/rise-app-review) |
| C6 | **Predicted daily energy schedule** | Forecasts when energy will peak and dip through the day so the user can schedule around it; plus a "Melatonin Window". | RISE | Paid **[S]** | A fasting analogue (predicted hunger peaks within a window) is unbuilt in this category **[I]** | [RISE](https://www.risescience.com/blog/rise-app-review) |
| C7 | **Structured course / academy** | Multi-lesson curriculum rather than loose articles. | Fastic ("Fastic Academy"), Zero (audio lessons, videos) **[S]**, DoFasting, Femometer (nutrition course) | Fastic: Plus **[V]**. Zero: Plus **[S]** | — | [Fastic Play](https://play.google.com/store/apps/details?id=de.fastic.app) |
| C8 | **Human expert escalation** | A route to a real person. BodyFast lists "SOS expert help". | BodyFast | Coach/paid **[V]** | — | [BodyFast App Store](https://apps.apple.com/us/app/bodyfast-intermittent-fasting/id1189568780) |
| C9 | **Weekly / monthly fasting analysis report** | Periodic aggregate report rather than a live dashboard. | Yazio (Pro) **[S]**, Zero (trend analytics, Plus) **[S]**, LIFE (enhanced stats, premium) **[S]** | Paid in all three | — | [Yazio help](https://help.yazio.com/hc/en-us/articles/11804776635281-Tutorial-of-the-Yazio-app) |
| C10 | **Correlation surfacing** | Explicitly connecting one logged series to another (mood ↔ fasting state ↔ sleep). | Metabolica **[S]** | **[U]** | Rare. Most apps chart series side by side without asserting relationships **[I]** | [metabolica.health](https://www.metabolica.health/) |

---

## 5. Bucket D — Motivation and retention

| # | Feature | Concretely | Apps | Free/Paid | Evidence | Source |
|---|---|---|---|---|---|---|
| D1 | **Streaks** | Consecutive completed fasts. | Zero **[S]**, Fastic **[S]**, Fasted **[C]**, Simple (via "Blinky" streak rewards) **[S]**, NutriScan **[C]** | Generally free | **Criticism:** one source says the Duolingo-style streak pressure led some users to *"break a fast early or extend a fast unhealthily"* — single anecdotal source **[C]** | [swoodie comparison](https://swoodie.app/blog/zero-vs-fastic-vs-swoodie-2026) |
| D2 | **Trophies / badges / achievements** | Collectible awards. BodyFast listing: *"collect trophies for your achievements."* | BodyFast **[V]**, Window **[S]**, Fastic **[S]** | BodyFast: tier unclear **[U]** | Fastic described as *"a visual, badge-driven tracker"* **[C]** | [BodyFast App Store](https://apps.apple.com/us/app/bodyfast-intermittent-fasting/id1189568780) |
| D3 | **Time-boxed challenges** | Named multi-day/week challenges with a goal. BodyFast: "Weekly Health & Fitness Challenges"; Fastic: "daily and weekly challenges". | BodyFast **[V]**, Fastic **[V]**, Zero **[S]** | BodyFast: Coach-only **[V]**. Fastic: Plus **[C/S]** | *"Fun challenges to keep you fasting long after the initial interest wears off"* **[S]** | [BodyFast App Store](https://apps.apple.com/us/app/bodyfast-intermittent-fasting/id1189568780) |
| D4 | **Social circles / group fasting** | Named groups whose members see each other's live fasting state. LifeOmic: *"custom circles of LIFE users they care about, from friends to coworkers to healthcare providers"*; 2.0 added public circles grouped *"by things like location, gender, or fasting style"* with *"real-time live updates."* | LIFE Fasting Tracker | Base circles free; "exclusive social circle access" premium **[S]** | Complaint: in a large circle *"it's borderline impossible to find your post"* **[S]** | [LifeOmic 2.0 PR](https://www.prnewswire.com/news-releases/lifeomic-announces-life-fasting-tracker-2-0-as-app-reaches-more-than-100-000-downloads-300781857.html) |
| D5 | **1:1 partner pairing** | Pair with *one* person and follow their fast live — much lighter than a social network. | Swoodie **[C]**, Fastic ("Fasting Buddies") **[V]** | Swoodie: free tier = first five fasts **[C]**. Fastic Buddies: Plus **[C/S]** | Zero notably *"has no partner feature at all"* **[C]** | [swoodie](https://swoodie.app/blog/zero-vs-fastic-vs-swoodie-2026) |
| D6 | **Social feed** | Shared progress posts. | Fastic **[S]** | Plus **[C/S]** | **Strong negative signal:** reviewers who wanted a simple timer describe Fastic's social features as *"cluttering the experience and being difficult to disable"* **[S]** | [unstar ranking](https://unstar.app/blog/zero-simple-fastic-life-fasting-bodyfast-intermittent-fasting-apps-ranked-2026) |
| D7 | **Leaderboards** | Competitive ranking. | **Not found in any surveyed app.** Explicitly searched; zero results. **[U]** | — | **[I]** This looks like a deliberate category-wide abstention — ranking people by fasting duration has obvious disordered-eating risk | — |
| D8 | **Mascot / character** | A persistent character embodying accountability. Simple uses "Avo" (avocado) as the coach and "Blinky" as *"the accountability character, with streak rewards."* | Simple | — | A distinct retention device vs. abstract badges **[I]** | [sciencetimes on Avo](https://www.sciencetimes.com/articles/60584/20250910/avo-ai-coach-behind-55m-chats-driving-weight-loss.htm) |
| D9 | **Start/end reminders** | Push at window boundaries. | All | Free | Fastic reviewer on *upgrade* prompts (not reminders): *"the upgrade ads are extreme, constant, and very in-your-face"* **[S]** | [Fastic Play reviews](https://play.google.com/store/apps/details?id=de.fastic.app) |

---

## 6. Bucket E — Visual and UI patterns ⭐

This is the section with the weakest direct evidence, because I could not view a single screenshot (§0.1). Everything below is reconstructed from prose. I have been explicit about what is described versus what I am inferring.

### 6.1 The fasting timer — what visual device is actually used

**The circular ring/arc is the category default, and essentially nothing else was found in use.** I specifically searched for alternative metaphors (bottle filling, plant growing, sun/moon arc) and **found no fasting app using them.** That is a negative result worth recording.

| Variant | Description as sourced | Apps |
|---|---|---|
| **Plain progress ring + large numerals** | *"Large, easy-to-read numbers display hours, minutes, and seconds, while the colored ring gradually completes as your fasting period progresses. Start, pause, or reset your timer with intuitive controls."* | Fastero Ring Timer **[S]** |
| **Ring that recolours by metabolic phase** | *"A stunning ring timer that fills with color as you progress through each metabolic phase."* | Pure Fast Circle Timer **[S]** |
| **Two-state colour coding** | *"color-coded progress rings — red for fasting periods and green for eating windows."* | Fastora **[S]** |
| **Donut segmented into phases** | *"Unfed shows your progression through 5 phases, with color-coded segments"*, pitched explicitly against *"competitors with basic timers"* | Unfed **[S]** |
| **Arc (not closed ring)** | LIFE's free tier includes a *"fasting progress arc"* | LIFE Fasting Tracker **[S]** |
| **"Progress wheel"** | *"your main dashboard will display a progress wheel showing your current fast"* | Fastic **[S]** |
| **Filling circle on Watch** | *"The smaller complication in the upper left of your Watch face will give you a graphical indication of time remaining in your fast."* | Zero **[V]** |
| **Linear bar (widget context)** | One writer argues the progress bar works best as a home-screen widget because it *"turns fasting from a memory task into a visible countdown"* | widget pattern generally **[S]** |

**Synthesis [I]:** The design axis that actually differentiates apps is not ring-vs-something-else, it is **how much semantic information the ring carries**:

1. **Level 0** — ring shows elapsed/total only (most minimalist apps).
2. **Level 1** — ring changes colour at one threshold (fasting vs eating; Fastora).
3. **Level 2** — ring is *segmented* into named phase arcs with distinct colours, so the whole timeline is legible at a glance and the current position is a marker travelling through it (Unfed; what Zero's zones imply).
4. **Level 3** — segment boundaries are personalised per user (Zero Plus **[V]**).

FastLoop already has a phase timeline. The question is whether the timeline is a *separate* strip below the ring or **fused into the ring as segmented arcs**. The teardown evidence suggests fusing is the premium-feeling pattern, and it is the explicit marketing wedge for at least one app (Unfed). **[I]**

### 6.2 Weight entry controls

**Direct finding: I found no source describing the weight-entry control inside any of the 13 target fasting apps.** This is a genuine evidence gap. What I did find is the surrounding pattern language in fitness/health onboarding:

| Control | Description as sourced | Where documented |
|---|---|---|
| **Vertical scroll picker (wheel)** | Planfit's onboarding uses *"a vertical scroll picker for height"* and *"a weight selection scroll picker"* for current weight, then *"a weight picker wheel"* for target weight | Planfit teardown **[S]** |
| **Horizontal ruler / scale picker** | Fitbit's body-fat goal screen uses *"a scrollable ruler-style control with a large central readout and a sticky save button"* | Eleken slider roundup **[S]** |
| **Ruler for height AND weight at signup** | A Dribbble shot titled "Height and weight selector as ruler — Mobile signup screen" | Dribbble **[S]** |
| **Implementation reference** | `SwiftHorizontalRuler` — UIKit horizontal ruler wrapped for SwiftUI, with configurable min/max, minor and major tick increments, **and haptics** | GitHub **[S]** |
| **Rendering caution** | For dense ruler ticks, use `Canvas` rather than many separate views, since *"many separate views can get expensive quickly"* | SwiftUI slider writeup **[S]** |

**The documented downside, which matters:** a weight-tracker design case study abandoned a slider because *"reaching a specific division was difficult"* — users could not reliably land on an exact value. A separate critique found circular sliders problematic because *"these parameters aren't constrained, which can lead to confusion when selecting values."* **[S]**

**Recommended synthesis [I]:** the pattern that resolves this is a **ruler picker with haptic detents at the step size, a large central numeric readout that doubles as a tap target opening a numeric keypad**, and explicit unit display. Ruler for scanning/approximate adjustment; keypad for precision. I found no A/B data comparing these — the sources are design showcases and student case studies, not usability research, so **this is an inference, not a finding.**

### 6.3 Charts

Thin evidence. What exists:
- Generic pattern: *"log your weight daily or weekly and watch your progress unfold in clear, easy-to-read charts"*, with a **trend line to smooth out daily fluctuations** **[S]**.
- **Fastic has a documented chart bug** a reviewer complained about: *"the graph often incorrectly shows I've been fasting for 24 hrs"* **[S]** — a reminder that the history chart's correctness is user-visible and reviewed.
- Cronometer Gold sells **custom charts** and **printable reports** as paid features **[S]**.
- Fasting Coach advertises *"a history of fasts shown in graphs"* **[S]**.

**[I]** No app in this survey appears to have made charting itself a differentiator. MacroFactor's smoothed-trend presentation is the strongest charting idea in the adjacent set.

### 6.4 Home screen layout

Sparse. Sourced observations:
- Fastic: *"your main dashboard will display a progress wheel showing your current fast"*, with the **Body Status view integrated into the timer** **[S]**.
- Fastic criticism: *"the interface can feel cluttered with features"* **[S]**; Trustpilot counter-view: *"everything is clearly laid out"* **[S]**.
- Zero: *"the cleanest timer UI in the category"* **[C]**; *"clean, with an intuitive timer"* **[S]**.
- Zero pollution: the app *"surfaces MyFitnessPal upgrade prompts and cross-promotional banners"* in-app **[S]**.

**[I]** The pattern implied: a hero timer occupying the top ~50–60% of the screen, with secondary trackers (water, weight, steps) as a scrollable card stack beneath. The consistent critical signal is that **adding cards degrades the product** — "cluttered" is the recurring word for Fastic, "clean" for Zero, and Zero wins the praise.

### 6.5 Onboarding quizzes

This is the best-documented UI area.

| App / benchmark | Screens before paywall | Source |
|---|---|---|
| **Zero** | **17 onboarding steps**, ending in a **"Free Trial — Hard Paywall"**; 33 total captured screens across onboarding + paywall + core tabs | ScreensDesign / AppLlama teardown metadata **[S]** |
| Cal AI | 29 | ScreensDesign **[S]** |
| QUITTR | 35+ | ScreensDesign **[S]** |
| FitCoach | 38 | ScreensDesign **[S]** |
| Planfit | 251 | ScreensDesign **[S]** |
| Noom | 100+ | benchmark writeup **[S]** |
| Glowly | 3 (result withheld until payment) | ScreensDesign **[S]** |
| Health & fitness category norm | 25–30 | onboarding benchmark **[S]** |

**The structural payoff:** Zero's onboarding *"visualizes your projected weight loss on a graph near the end,"* which the teardown treats as **the key emotional moment** of the flow **[S]**. Planfit similarly shows *"a weight projection screen after the target is set"* **[S]**.

**The design principle actually worth taking [S]:** *"if the answer does not change the next screen, it is not a question, it is a form."* Quizzes earn their friction only when answers visibly branch the flow.

**Criticism of fasting-app onboarding specifically [C — competitor-sourced, treat sceptically]:** *"The competitors all gate the timer behind a multi-screen pre-timer questionnaire… Of the four, Fastic asks the most, with onboarding running over many screens, several of which are off-topic for a fasting tracker and read more like a paywall warm-up."* A separate guide: *"if an app requires a lengthy quiz, email verification, and health profile before you can start your first fast, it is optimizing for data collection, not your experience."*

### 6.6 Paywalls

| Observation | Detail | Confidence |
|---|---|---|
| **Zero uses a hard paywall** | Users must subscribe before reaching main features; **7-day free trial on the annual plan, with a monthly option shown alongside**, presented during onboarding; a **welcome screen for the paid tier** follows a successful subscription | ScreensDesign teardown **[S]** |
| Zero IAP range | Adapty's paywall library lists Zero's in-app purchases at **$9.99 to $69.99** | Adapty **[S]** |
| Social proof on paywalls | A teardown describes *"social proof from publication logos"* and, separately, *"outcome stories and reviews on a paywall"* — but **the second was about a different app called "Fasting App," not Zero.** Zero-specific social proof is **unconfirmed** | **[U]** |
| Paywall placement economics | *"A paywall at the end of a questionnaire, before any real use, usually converts at 1 to 4%. The same paywall shown after a first result is usually 2 to 3 times higher and refunds go down."* | benchmark **[S]** |
| **Variable pricing by quiz** | Simple reportedly *"uses variable pricing through its onboarding quiz, which means the number you see can change"* **[S]**. FastEasy reportedly shows *"$29.99 or $239.88 for a year depending on which plan the paywall shows you"* **[S]** | **[S]** — if true, this is the most aggressive pattern in the category |
| Escape hatch | A Simple user guide describes: *"you finish the quiz, reach the paywall, and tap the X or 'Skip' button to close the paywall"* — i.e. the paywall is dismissible, just not obviously | **[S]** |

---

## 7. Bucket F — Integrations

| Integration | Apps confirmed | Detail | Source |
|---|---|---|---|
| **Apple HealthKit** | Zero **[V]**, Simple **[S]**, Window **[S]**, Femometer **[S]**, KetoLogger **[S]** | Zero: *"Sync weight, steps, calories, and hydration with HealthKit"* | [Zero listing text](https://apps.apple.com/us/app/zero-fasting-food-tracker/id1168348542) |
| **Google Fit** | Simple **[S]** | **Important caveat:** *"Google Fit APIs have been deprecated and will be supported until June 30, 2025."* | [Google Fit help](https://support.google.com/fit/faq/6108483) |
| **Health Connect** | **No fasting app confirmed.** Searched explicitly; no results. | Health Connect is *"a central hub where the data of several fitness and health platforms coalesce."* Whether fasting sessions are even a supported Health Connect data type is **unconfirmed** | [Android Authority](https://www.androidauthority.com/google-health-connect-app-3234491/) |
| **Apple Watch app** | Zero **[V]**, Window **[S]**, EasyFasting **[C]**, Hone **[S]**, FastMinder **[S]** | Zero's Watch app has **no offline mode** **[V]** | [Zero Watch help](https://zerofasting.zendesk.com/hc/en-us/articles/360008775614-Using-Zero-with-Apple-Watch) |
| **Watch complications** | Zero (circular, fills with fast progress) **[V]**; EasyFasting (circular + corner + Smart Stack card) **[C]** | A competitor's comparison table lists complications as *"Not listed"* for both Fastic and BodyFast — **absence from a rival's table is not evidence of absence** | [easyfasting comparison](https://easyfasting.net/blog/best-fasting-tracker-app-iphone) |
| **Live Activity / Dynamic Island** | **Zero — added in v1.5.1, dated 11/09/2025** **[V]**; Hone **[S]** | The most recently-adopted integration in the category | [Zero App Store listing](https://apps.apple.com/us/app/zero-fasting-food-tracker/id1168348542) |
| **Home-screen widgets** | Window (incl. a **weight-monitoring widget**) **[S]**, Clear/Whisp (fasting timer widget) **[S]**, HydroFast (water quick-add widget) **[S]**, EasyFasting **[C]** | — | — |
| **Wear OS tile / watch face complication** | EasyFasting only **[C]** | *"On Android you get home screen widgets plus a Wear OS progress tile and watch face complication"* | [easyfasting](https://easyfasting.net/blog/best-fasting-tracker-app-iphone) |
| **Siri** | Window **[S]** | Start/end fast by voice | [iphoneness](https://www.iphoneness.com/iphone-apps/ios-apps-for-fasting/) |
| **iCloud sync (instead of Health)** | ByteFast **[S]** | — | — |
| **Face ID app lock** | Femometer **[S]** | — | [femometer.com](https://www.femometer.com/appIntroduce) |

**[I] Clear gaps:** Health Connect support appears to be **unoccupied territory** on Android, and Google Fit's API deprecation makes it urgent rather than optional. Wear OS tiles are claimed by exactly one (self-reported) app.

---

## 8. Bucket G — Monetization patterns

### 8.1 Price points (all figures conflict across sources — every row lists the spread, not a consensus)

| App | Reported prices | Trial | Notes |
|---|---|---|---|
| **Zero Plus** | $9.99/mo; $69.99/yr (one source: options "$9.99 to $89.99"); Adapty library lists IAP range $9.99–$69.99 | 7-day on annual **[S]** | One review states Zero *"transitioned from free to paid subscription model in 2024"* **[S]** |
| **Simple** | $14.99/mo and $99.99/yr (one); $29.99/mo (Fortune, which says **no free trial**); $49.99–$59.99/yr (another); older: $14.99/mo, $29.99/3mo, $49.99/yr | 7-day converting to annual charge **[S]** | **Variable pricing via onboarding quiz reported [S]** |
| **Fastic Plus** | $39.99/yr; $79.99/yr; $27.99/3mo; $11.99/mo; "$30–75/yr typical" | **[U]** | Widest spread of any app surveyed |
| **BodyFast Coach** | $69.99/12mo (most cited); $49.99/yr; $39.99/yr | **[U]** | A user was *"hesitant about paying for 3, 6, or 12 months all at once"* **[S]** |
| **DoFasting** | **$32.99/quarter, $45.99/half-year, $66.99/year** (App Store listing, US) **[V-ish]**; older: $37/1mo, $48/3mo, $69/6mo, "$67/yr" | **No free trial** (Fortune) **[S]**; 14-day money-back guarantee **[S]** | Reviewers repeatedly call it expensive |
| **Yazio PRO** | $9.99/mo, $39.99/yr; also $6.99/mo, $47.90/yr; promo $23.90/yr | 7-day **[S]** | Free tier has **intrusive ads** **[S]** |
| **FastEasy** | $19.99/1mo, $39.99/3mo, $59.99/12mo; **also "$29.99 or $239.88 for a year depending on which plan the paywall shows you"** | **[U]** | $239.88/yr, if real, is a category outlier |
| **Clear (ZipoApps)** | $27.99/yr — described as "steep" by the reviewer | **[U]** | — |
| **Femometer** | $6.99 weekly, $19.99 quarterly (store listing); also cited $9.99/mo–$49.99/yr | **[U]** | **Weekly billing** is itself a flagged pattern |
| **GoFasting** | "$4–16/month" per a third-party listing | **[U]** | — |
| **RISE** (adjacent) | $69.99/yr | 7-day **[S]** | — |
| **Cronometer Gold** (adjacent) | $10.99/mo or $59.99/yr; also $8.49–$8.99/mo | **[U]** | — |
| **MacroFactor** (adjacent) | ~$12/mo, **no free tier** | **[S]** | — |

### 8.2 The renewal-price escalation pattern

The single most important monetization finding, and it is cross-app:

> *"Most apps offer a first-year promotion (29.99 or 39.99) that auto-renews at the full annual price (69.99 to 99.99) in year 2."* **[S]**

Corroborated by a Zero-specific report of *"complaints about being charged the full annual price after a discounted first year"* **[S]**.

### 8.3 What is typically free vs locked

**[I] synthesis across apps, with the caveat that sources actively contradict each other on this:**

| Usually free | Usually paid |
|---|---|
| The timer itself and a handful of preset windows | Full preset library (Yazio: only 16:8 free **[V]**; BodyFast: >10 free, rest paid **[V]**) |
| Start/end reminders | The adaptive/weekly coach (BodyFast **[V]**) |
| Weight logging + basic chart | Long-term history and deep analytics (EasyFasting's stated model **[C]**; Yazio's weekly/monthly analysis **[S]**) |
| Water tracking | Recipes and courses (Fastic Academy **[V]**, BodyFast 100+ recipes **[V]**, DoFasting) |
| Basic stage/phase display | *Personalised* stage boundaries (Zero Plus **[V]**) |
| Health sync | Challenges and social/buddy features (BodyFast **[V]**, Fastic **[C/S]**) |
| Basic AI food scan (1/day in Simple **[C]**) | Unlimited AI coaching and scanning |

**Unresolved contradiction worth flagging:** sources disagree sharply on whether the *timer* is gated. One review aggregator claims users find *"anything beyond the most basic 16:8 timer requires premium"* **[S]**, while a competitor-authored piece insists *"the tracking loop stays free and the paywall sits around recipes, courses, challenges and coaching"* for Fastic and BodyFast **[C]**. **I cannot resolve this without opening the apps.**

### 8.4 Dark patterns reviewers call out

1. **Cancellation difficulty** — the dominant complaint. BodyFast Trustpilot summary: *"unexpected subscription charges, automatic renewals, and encountering severe difficulties when trying to cancel their memberships."* **[S]**
2. **Cancellation that doesn't stick** — DoFasting: *"I canceled the subscription and every year they continue to charge me and I have to go through my credit card company to get it removed."* **[S]**
3. **Subscription management that bounces you out of the app** — DoFasting: *"I go back to the app, I go to App Settings and then hit that blue button 'Manage Subscription' and I press it and again, takes me to login on the website."* **[S]**
4. **No renewal warning** — FitFast: *"No alert that your subscription is ending either."* **[S]**
5. **Trial that silently bills annually** — Trustpilot: *"The subscription showed that it would expire 1 year from now - so, not taking the trial period in consideration."* **[S]**
6. **"Free" store listing that isn't** — *"you are not able to use app unless you sign up for the subscription"* **[S]**
7. **Variable paywall pricing** — Simple and FastEasy reportedly show different prices to different users **[S]**.
8. **Resetting countdown discounts** — generic pattern: *"the timer is an artificial JavaScript animation that resets every time you relaunch the app"*; *"if it resets on every visit or refresh, customers often notice, and that can damage credibility."* **[S]** Not confirmed in a specific fasting app.
9. **Rating inflation** — *"users rate the timer when it works and review the subscription only when the renewal hits."* **[S]**
10. **Upgrade-prompt saturation** — Fastic: *"the upgrade ads are extreme, constant, and very in-your-face"* **[S]**; BodyFast: *"Pop ups were somewhat annoying"* **[S]**.
11. **Cross-promotion of a sibling product** — Zero surfaces *"MyFitnessPal upgrade prompts and cross-promotional banners"* **[S]**.
12. **Lockout on lapse** — FitFast: *"I have no access to my profile just a screen that says you don't have a subscription."* **[S]**

---

## 9. The 10 most consistent features — table stakes

Ranked by how many surveyed apps have them.

| # | Feature | Present in | Notes |
|---|---|---|---|
| 1 | **Fasting timer with preset windows (16:8, 18:6, 20:4, OMAD) + custom** | Every single app | FastLoop ✅ |
| 2 | **Start/end push reminders** | Effectively all | FastLoop ✅ (assumed) |
| 3 | **Fast history with a chart** | Effectively all | FastLoop ✅ |
| 4 | **Weight logging + chart (+ BMI)** | Zero, Fastic, BodyFast, Simple, DoFasting, Yazio, LIFE, Window, Clear, GoFasting, Femometer | FastLoop ✅ |
| 5 | **Water / hydration tracking** | Fastic, BodyFast, DoFasting, Yazio, Clear, GoFasting, Femometer, Zero | FastLoop ✅ |
| 6 | **Metabolic stage / phase display during the fast** | Zero, Fastic, BodyFast, FastEasy, Fasting Coach, Femometer, Unfed, FastingCat, Keto Kit, Fastora | FastLoop ✅ |
| 7 | **Educational content library (articles)** | Zero, Fastic, BodyFast, DoFasting, GoFasting, Femometer, Clear | FastLoop ✅ (6 articles) |
| 8 | **Streaks and/or achievement badges** | Zero, Fastic, BodyFast, Simple, Window, Fasted | FastLoop ✅ (streaks) |
| 9 | **Step tracking (native or via Health)** | Fastic, DoFasting, GoFasting, Zero | FastLoop ✅ (hardware counter) |
| 10 | **Onboarding quiz → personalised plan → paywall** | Zero (17 steps), Simple, Fastic, DoFasting, BodyFast | FastLoop ✅ |

**[I] Conclusion: FastLoop already has all ten table-stakes features.** It is at parity on the commodity layer. Everything below is where the differentiation lives.

---

## 10. The 10 most distinctive features found (NOT widespread)

Ordered roughly by how interesting they are relative to implementation cost.

| # | Feature | App | Why it is interesting |
|---|---|---|---|
| 1 | **Joker Day** — a sanctioned weekly skip that *extends the plan week by one day* so no planned fast is lost **[V]** | BodyFast | Solves relapse psychologically without breaking the plan's integrity. The extension mechanic is the clever part — it reframes a skip as a deferral, not a failure. Cheap to build. |
| 2 | **Weekly plan regeneration by a coach algorithm** **[V]** | BodyFast | The whole app's retention thesis: the plan is never static, so there's always a reason to come back Monday. |
| 3 | **Personalised metabolic-zone boundaries** derived from onboarding answers **[V]** | Zero Plus | Converts a static educational graphic into a personalised, defensibly-paid feature. |
| 4 | **Restaurant menu scanner** — photograph a menu, get dish recommendations filtered by diet preference (low-carb/vegan/high-protein) **[V]** | Fastic | Solves the actual hard moment (eating out), not the easy one (logging at home). I found no other app doing this. |
| 5 | **Voice-call AI coaching with auto-logging** — phone the coach; meals mentioned in conversation are logged automatically **[V]** | Simple ("Avo Voice", Jan 2026) | Removes the logging step entirely by folding it into conversation. |
| 6 | **Ketone + blood glucose logging in the free tier** **[S]** | LIFE Fasting Tracker | Serves the serious/biohacker segment that every other app ignores. Trivial to build (two numeric series). |
| 7 | **1:1 partner pairing — follow one person's live fast** **[C]** | Swoodie; Fastic "Fasting Buddies" | Captures the accountability benefit of social features without the feed, the moderation burden, or the "cluttered / can't disable it" complaints that dog Fastic. |
| 8 | **Rolling, recency-weighted debt metric + predicted energy schedule** **[S]** | RISE (adjacent) | 14-night rolling sleep debt with recent nights weighted more, plus a forecast of daily energy peaks/dips. A fasting analogue — rolling adherence debt, predicted hunger peaks inside a window — does not exist in this category. |
| 9 | **Closed-loop adaptive targets** — infer true expenditure from intake vs. weight trend and recalculate weekly, self-correcting for under-logging **[S]** | MacroFactor (adjacent) | The most intellectually honest personalisation model found anywhere in the survey. |
| 10 | **Journaling-first fasting record** — the fast *is* a note about how it felt, charted over time **[S]** | Fastient | The complete inverse of the category's metrics-first assumption, and the only app positioned this way. |

**Honourable mentions:** Fastic's composite **Fastic Score** across nutrition/activity/hydration/sleep **[V]**; Simple's **Blinky** accountability mascot distinct from the coach character **[S]**; Metabolica's explicit **mood↔metabolic-state correlation** **[S]**; Cronometer selling a **fasting timer as a paid add-on to a nutrition app** (the inverse of this category's model) **[S]**; Femometer's **Face ID app lock** **[S]**; BodyFast's **"SOS expert help"** human escalation **[V]**.

---

## 11. Common complaints across the category

Ordered by how often the theme recurred across sources.

### 11.1 Billing and cancellation — overwhelmingly #1
Every multi-app review source put this first. Representative quotes (all **[S]**, surfaced by search from App Store/Trustpilot, unverified at source):
- *"I canceled the subscription and every year they continue to charge me and I have to go through my credit card company to get it removed."* (DoFasting)
- *"No alert that your subscription is ending either."* (FitFast)
- *"The subscription showed that it would expire 1 year from now - so, not taking the trial period in consideration."* (FastEasy, Trustpilot)
- BodyFast Trustpilot: *"severe difficulties when trying to cancel their memberships."*

### 11.2 Paywalled basics / bait-and-switch
- *"you are not able to use app unless you sign up for the subscription"* despite a free store listing.
- Zero specifically: features that *"were free at launch moving behind a paid tier after its MyFitnessPal acquisition"* — *"the advanced journal, custom timers, and biometric integration."* **[S]**
- *"could easily set up this system without paying."* (FastEasy)

### 11.3 Cannot edit or recover fast records
- Clear: *"forgetting to mark that they've ended their fast and are unable to go back and change it."*
- LIFE: an update *"made editing fast start and stop times harder."*
- MyFast: manual timer mode *"doesn't store your history whatsoever."*

### 11.4 Data loss and account fragility
- Prime: reinstalling *"didn't recognize who I was or the account I had with them"* — lost a paid subscription.
- DoFasting: *"logs me out all of the time."*
- FastEasy: *"whatever device you start on is the only one it will work on."*

### 11.5 Upgrade-prompt saturation
- Fastic: *"the upgrade ads are extreme, constant, and very in-your-face."*
- BodyFast: *"Pop ups were somewhat annoying."*

### 11.6 Weak or wrong food/nutrition data
- FastEasy: *"the nutritional components that really add to the success of fasting are overlooked by not helping you track them: calories, fat, protein and carbs."*
- GoFasting: *"AI scanner is not properly working and not showing correct calories the food contains"*; no preloaded food database; no exercise logging.
- Zero: *"you end up bouncing between Zero and MyFitnessPal."*

### 11.7 Rigid tracking inputs
- DoFasting: *"My step tracker is electronic, but it's neither one of those options so I couldn't even manually input my step count."*
- FastEasy: manual step/exercise entry reportedly impossible without an Apple Watch.

### 11.8 Clutter and unwanted social features
- Fastic's social features *"cluttering the experience and being difficult to disable."*
- LIFE: in a large circle *"it's borderline impossible to find your post."*

### 11.9 Generic AI coaching
- A recurring complaint pattern identified as *"generic AI coaching"* across the top five apps **[S]**.

### 11.10 Performance regressions
- Zero, Google Play, April 2026: *"it has become slow and glitchy recently"* — the developer replied apologising **[S]**.

### 11.11 Correctness bugs that users see
- Fastic: *"the graph often incorrectly shows I've been fasting for 24 hrs."*

### 11.12 Contested science
- One multi-app analysis lists *"self-contradicting weight-loss content"* and *"contested fasting science"* among the top complaint patterns **[S]**.

---

## 12. Fasting-stage / phase timelines — where the sources disagree

**The task asked me to note disagreements rather than average them. There are many, and they include a vendor disagreeing with itself.**

### 12.1 Zero's own published zones — internally inconsistent

| Source (all Zero's own) | Model |
|---|---|
| [Zero Longevity — "Personalized Fasting Zones"](https://zerolongevity.com/blog/lose-weight-and-burn-fat-with-personalized-fasting-zones/) **[V]** | **Anabolic 0–4h · Catabolic 4–16h · Fat Burning 16–24h · Ketosis 24–72h · Deep Ketosis 72h+** |
| [Zero help centre — "Fat Burning Mode"](https://zerofasting.zendesk.com/hc/en-us/articles/21216678252187-Fat-Burning-Mode) **[V]** | **Anabolic ~0–4h · Catabolic ~4–16h · Fat Burning ~16h+** (three stages only) |
| [Zero Longevity — "The Physiology of Fasting"](https://zerolongevity.com/blog/the-physiology-of-fasting/) **[V]** | **Anabolic 0–3h · Catabolic 4–24h** |

Three Zero-published documents give three different boundary sets. The anabolic stage ends at either 3 or 4 hours; the catabolic stage ends at either 16 or 24 hours. **Notably, Zero names no autophagy zone at all** — the 72h+ zone is described in terms of "cleanup, repair, and recycling processes" without using the word.

Also **[V]**: Zero Plus boundaries are not fixed — *"The exact entry time will vary depending on information you provide during onboarding."*

### 12.2 Stage models used by other apps

| App | Model | Source quality |
|---|---|---|
| **LIFE Fasting Tracker** | Five stages: ketosis & heavy ketosis · autophagy · growth hormone · insulin reduction · immune cell rejuvenation. **No hour thresholds found.** | **[S]** secondary (Extivita), not LifeOmic |
| **Unfed** | Five phases, donut-segmented; *"Deep Ketosis (24h+): Autophagy activated"* | **[S]** store listing |
| **FastingCat** | Anabolic → Catabolic → Fat Burning → Ketosis → Deep Ketosis → **Autophagy** (autophagy as its own named stage) | **[S]** store listing |
| **Intermittent** | Six phases: **Fed · Early fasting · Lipolysis · Ketosis · Autophagy · Deep fast** — and the vendor says the phases carry cited sources | **[C]** |
| **Keto Kit** | "5 metabolic stages" | **[S]** |
| **Fastora** | Not stage-named; two-state colour coding (red fasting / green eating) | **[S]** |
| **Fastic / Femometer / Fasting Coach / FastEasy** | All advertise a "Body Status" or stage view. **I could not obtain hour boundaries for any of them.** | **[U]** |

### 12.3 Where the general literature disagrees

| Event | Range across sources | Notable positions |
|---|---|---|
| **Glycogen depletion** | 4–18h | "4–12h" (several); "12–18h" (one) |
| **Fat burning begins** | 8–16h | *"Fat burning begins around 8–12 hours into a fast when liver glycogen stores are depleted"*; Zero places it at **16h** |
| **Ketosis onset** | **8–24h — the widest disagreement** | BeKeto: 8–12h · "approximately 12–14 hours" · *"For most people, ketosis begins around 16 hours"* · 16–18h "full ketosis" · fastingphases.com: detectable ketones (≥0.5 mmol/L) **18–24h** · **Zero: 24h** |
| **Autophagy onset** | **12–48h — the most contested of all** | *"begins mildly at around 12 hours and reaches significant levels at 16–18 hours"* · "16–24h" (most common) · *"ramps up after hour 24 — peaking only in the 48–72-hour deep fast"* · some say 36h for meaningful effect · **Zero names no autophagy stage** |
| **Growth hormone rise** | 12h / 24h / 48h — no agreement | fastingphases.com cites a 5-fold rise in a 24-hour fast (Vinales 2022); doctorkiltz claims a 20-fold rise in men after 24h (**unverified**); another calls 48h a "400% surge" |
| **Deep ketosis** | 24–72h (Zero) vs. 18–24h (others) | — |

### 12.4 The honesty caveat the sources themselves raise

Multiple sources flag that autophagy timing in humans is not established:
- *"The autophagy claims in these sources are not well established in human studies."*
- *"precise human timing uncertain — most data is animal."*
- *"the precise timing in humans is not firmly established."*
- *"These claims are often presented with more precision than the evidence supports."*

**[I] Design implication for FastLoop:** the category's dominant behaviour is to assert crisp hour boundaries with false confidence. There is a real differentiation opportunity in doing the opposite — presenting stage boundaries as **ranges with visible uncertainty**, citing the source for each, and flagging the animal-data caveat on autophagy. One app (Intermittent) already claims cited sources per phase, so the idea is not unoccupied, but it is rare. It also de-risks the product: *"contested fasting science"* is a named complaint pattern in the review analysis **[S]**.

---

## 13. What this implies for FastLoop — gap analysis

**Everything in this section is inference [I], offered as a reading of the evidence rather than a sourced finding.**

### 13.1 FastLoop is at full table-stakes parity
All ten most-common features are already present (§9). There is nothing to catch up on at the commodity layer.

### 13.2 Highest value-per-unit-effort additions

| Priority | Feature | Rationale | Evidence anchor |
|---|---|---|---|
| **1** | **Robust retroactive fast editing** | A named complaint in *at least three* apps, and a correctness issue rather than a feature. Cheap. Nobody has made it a strength. | §11.3 |
| **2** | **Skip/pause day with plan extension (Joker Day mechanic)** | Answers two documented complaints at once (Simple's "cannot pause", BodyFast's clumsy joker). Very cheap. | A4, A12 |
| **3** | **Honest stage timeline with ranges + citations** | Differentiates on the one thing the whole category fakes confidence about, and defuses the "contested science" complaint. | §12.4 |
| **4** | **Ketone + glucose numeric logging** | Two numeric series. Serves the serious segment. Only LIFE does it, and LIFE's status is uncertain. | B4 |
| **5** | **Health Connect (Android) + Live Activity/Dynamic Island (iOS)** | Health Connect appears entirely unoccupied and Google Fit's API is deprecated; Live Activity is the newest adoption in the category (Zero, Nov 2025). | §7 |
| **6** | **Segmented phase ring** (fuse the phase timeline into the timer ring rather than showing it separately) | The premium visual pattern, and an explicit marketing wedge for Unfed. | §6.1 |
| **7** | **Ruler weight picker with haptic detents + tappable numeric readout** | The documented ruler failure mode (can't hit an exact value) is fixed by the keypad fallback. | §6.2 |
| **8** | **1:1 partner pairing** (not a feed) | Captures accountability value; avoids the "cluttered, can't disable" complaints that social feeds attract. | D5, D6, §11.8 |
| **9** | **Smoothed weight trend line** | Low effort, visibly more competent than a raw sawtooth. | B12 |
| **10** | **Rolling adherence-debt metric** (RISE-style, recency-weighted) | No fasting app has anything like it. | C5 |

### 13.3 Things the evidence suggests NOT building
- **A social feed.** The clearest negative signal in the survey (§11.8).
- **Leaderboards.** Absent from every app surveyed; plausibly a deliberate abstention on disordered-eating grounds (D7).
- **A serious food/macro database.** Every fasting app that tried is criticised for it (§11.6); Zero's users *"bounce to MyFitnessPal"* anyway.
- **Variable quiz-driven pricing, countdown discounts, weekly billing.** All named as dark patterns (§8.4).
- **Hard paywall before first use.** The benchmark data says a paywall after a first real result converts 2–3× better *and* reduces refunds (§6.6).

---

## 14. Residual unknowns

Things I could not establish, listed so they are not mistaken for absence:

1. **No screenshot was viewed.** All UI claims are prose-derived (§0.1).
2. **Weight-entry controls in the 13 target apps** — not documented anywhere I could reach.
3. **Fastic / Femometer / Fasting Coach / FastEasy stage hour boundaries** — advertised but never published in reachable sources.
4. **Whether the timer itself is paywalled** in Fastic and BodyFast — sources flatly contradict each other (§8.3).
5. **LIFE Fasting Tracker's current status** — one 2026 source says the original shut down and relaunched as "Life"; unconfirmed against a primary source.
6. **Zero's free/paid line for the mood journal** — two sources disagree, the newer one says paid.
7. **Whether Zero's paywall uses testimonial social proof** — the teardown quote describing that was about a different app.
8. **Health Connect fasting data types** — whether a fasting session is even a supported type.
9. **Fasting Coach** — no independent review of this app exists that I could find.
10. **All prices** — regional, promotional, and in at least two cases reportedly user-variable.

---

## 15. Source index

### First-party (highest confidence)
- https://zerolongevity.com/blog/lose-weight-and-burn-fat-with-personalized-fasting-zones/
- https://zerolongevity.com/blog/the-physiology-of-fasting/
- https://zerofasting.zendesk.com/hc/en-us/articles/21216678252187-Fat-Burning-Mode
- https://zerofasting.zendesk.com/hc/en-us/articles/360008775614-Using-Zero-with-Apple-Watch
- https://help.bodyfast.app/hc/en-001/articles/34652209248914-How-do-I-adjust-my-fasting-plan
- https://www.bodyfast.app/en/blog/intermittent-fasting-coach
- https://www.bodyfast.app/en/measure-fasting-success/
- https://help.yazio.com/hc/en-us/articles/11804776635281-Tutorial-of-the-Yazio-app
- https://help.simple.life/en/articles/11113965-avo-vision
- https://simple.life/blog/avo-vision-healthy-choices-in-a-snap/
- https://www.prweb.com/releases/simple-launches-expands-on-its-anti-discipline-ai-coach-with-voice-calls-302652009.html
- https://medium.com/lifeomic/seize-life-fast-lifeomic-releases-life-fasting-tracker-app-73b38daa7e53
- https://www.prnewswire.com/news-releases/lifeomic-announces-life-fasting-tracker-2-0-as-app-reaches-more-than-100-000-downloads-300781857.html
- https://www.femometer.com/appIntroduce
- https://www.guloolootech.com/en/app/gofasting
- https://support.google.com/fit/faq/6108483

### Store listings (developer copy; could not be opened directly)
- https://apps.apple.com/us/app/zero-fasting-food-tracker/id1168348542
- https://apps.apple.com/us/app/bodyfast-intermittent-fasting/id1189568780
- https://play.google.com/store/apps/details?id=com.bodyfast
- https://play.google.com/store/apps/details?id=de.fastic.app
- https://play.google.com/store/apps/details?id=life.simple
- https://apps.apple.com/us/app/fasteasy-intermittent-fasting/id1553036888
- https://apps.apple.com/us/app/fasting-coach-fasting-tracker/id1669141301
- https://play.google.com/store/apps/details?id=gofasting.fastingtracker.fasting.intermittentfasting
- https://apps.apple.com/us/app/window-intermittent-fasting/id1112765909
- https://apps.apple.com/us/app/clearfast/id6756589039
- https://play.google.com/store/apps/details?id=de.whisp.clear
- https://apps.apple.com/bz/app/femometer-intermittent-fasting/id1526416889
- https://apps.apple.com/app/id1456288628 (DoFasting)

### Teardown / paywall-intelligence
- https://screensdesign.com/showcase/zero-fasting-health-tracker
- https://screensdesign.com/articles/mobile-app-paywall-design-examples-2026/
- https://screensdesign.com/apps/planfit-gym-fitness-planner/
- https://screensdesign.com/apps/home-fitness-coach-fitcoach/
- https://appllama.io/apps/1168348542/zero-fasting-food-tracker
- https://adapty.io/paywall-library/zero-fasting-health-tracker/
- https://pageflows.com/post/ios/onboarding/zero/
- https://www.paywallscreens.com/apps/zero-fasting-health-tracker-mobile-paywall-d65e

### Review aggregation / complaint analysis
- https://unstar.app/blog/zero-simple-fastic-life-fasting-bodyfast-intermittent-fasting-apps-ranked-2026
- https://unstar.app/blog/is-myfitnesspal-premium-worth-it-paywall-app-reviews-2026
- https://www.trustpilot.com/review/www.bodyfast.app
- https://www.trustpilot.com/review/fastic.com
- https://ie.trustpilot.com/review/fasteasy.io
- https://au.trustpilot.com/review/dofasting.com
- https://justuseapp.com/en/app/1189568780/bodyfast-intermittent-fasting/reviews
- https://justuseapp.com/en/app/1459260306/fastic-fasting-app/reviews
- https://justuseapp.com/en/app/1319306064/life-fasting-tracker/reviews
- https://fortune.com/article/best-intermittent-fasting-apps/

### Third-party reviews (affiliate-influenced)
- https://healthreporter.com/zero-fasting-app-review/ · https://healthreporter.com/bodyfast-app-review/ · https://healthreporter.com/simple-app-review/
- https://fastingapps.com/clear-review/ · https://fastingapps.com/dofasting-review/ · https://fastingapps.com/fastic-review/
- https://www.bestfastingapp.com/reviews/life-fasting-tracker-review/ · https://www.bestfastingapp.com/reviews/dofasting-review/
- https://www.innerbody.com/dofasting-reviews
- https://www.risescience.com/blog/rise-app-review · https://www.bustle.com/wellness/rise-sleep-tracking-app-review
- https://calorie-trackers.com/reviews/macrofactor/ · https://caleye.fit/blog/macrofactor-tdee-tracking-accuracy/
- https://calorie-trackers.com/reviews/cronometer/
- https://thenutritionmagazine.com/articles/myfitnesspal-paywall-changes-explained/
- https://www.rankred.com/best-intermittent-fasting-apps/
- https://www.metabolica.health/

### Competitor-authored comparisons (marked [C]; adversarial)
- https://nutriscan.app/blog/posts/ (multiple) · https://nutrola.app/en/blog/ (multiple)
- https://easyfasting.net/blog/best-free-fasting-app · https://easyfasting.net/blog/best-fasting-tracker-app-iphone · https://easyfasting.net/blog/easyfasting-vs-zero
- https://swoodie.app/blog/zero-vs-fastic-vs-swoodie-2026
- https://intermittentfast.ing/blog/best-intermittent-fasting-apps · https://intermittentfast.ing/article/fasting-timeline
- https://getfasted.app/articles/comparisons/compare-fasted-fastic
- https://habitbox.app/blog/intermittent-fasting-tracker-app
- https://lasta.app/blog/lasta-vs-simple-life-review/ · https://lasta.app/blog/fasting-timeline/

### Fasting-stage literature (conflicting; see §12)
- https://fastingphases.com/ · https://myfastingcalc.com/blog/fasting-stages-explained
- https://beketo.uk/stages-of-fasting/ · https://eatproteins.com/stages-of-fasting/
- https://www.extivita.org/the-5-stages-of-intermittent-fasting/
- https://healthybodydaily.com/biohacking/when-does-autophagy-start-fasting/
- https://www.doctorkiltz.com/fasting-benefits-by-hour/ · https://realfoods.app/fasting-stages
- https://perfectketo.com/the-5-stages-of-fasting/

### UI / design pattern references
- https://www.eleken.co/blog-posts/slider-ui
- https://github.com/unibrix/SwiftHorizontalRuler
- https://dribbble.com/shots/3950553-Height-and-weight-selector-as-ruler-Mobile-signup-screen
- https://medium.com/design-bootcamp/case-study-design-a-concept-of-weight-tracking-app-in-a-day-620f65778268
- https://m3.material.io/components/sliders
- https://mobbin.com/explore/mobile/ui-elements/time-picker
- https://www.airbridge.io/en/blog/5-steps-app-onboarding-before-the-paywall
- https://semnexus.com/app-onboarding-flow-benchmarks-where-users-drop-off-2026
- https://insightsxdesign.substack.com/p/the-ultimate-list-of-dark-patterns
- https://www.androidauthority.com/google-health-connect-app-3234491/
