# Fuel the Ride: Product

## 1. What it is
**Fuel the Ride** tells a cyclist exactly how much to eat and drink for a given ride, **using the foods they already eat**. The answer isn't "eat 60 g of carbs per hour". It's "Hour 1: 1 Clif bar + 1 gel + 1 bottle of electrolyte mix."

After each ride, a quick check-in (stomach, legs, energy) teaches the app what works for that rider, so their plans improve over time and they can gradually train their gut to handle more carbs.

## 2. The problem
- Riders hear guidance like "60–90 g carbs/hr" but can't translate it into real food at the moment it matters.
- Under-fueling causes bonking, heavy legs and poor recovery. Over-fueling, or eating too much at once, causes stomach problems.
- Hydration and sodium get ignored until there's cramping or a headache.
- Riders rarely track what they actually ate, so they repeat the same mistakes.

## 3. Who it's for
**Primary:** amateur road, gravel and endurance cyclists who ride 1–6+ hours, often with a power meter or heart-rate monitor, and want to fuel properly without becoming nutrition experts.

**Secondary:** riders preparing for events (gran fondos, gravel races, long sportives) who want to train their gut to tolerate higher carb rates.

**Usage context:** mostly on a **phone**, often in the kitchen before a ride or on a café stop. Text must be large and readable, with big tap targets and minimal typing.

## 4. Goals and non-goals
**Goals (v1)**
- Turn a planned ride into a concrete hourly eating and drinking plan built from the user's own food library.
- Cover **carbs, fluid and sodium**.
- Use the most accurate intensity data the rider has (kilojoules, power, heart rate or zones).
- Learn from post-ride check-ins and suggest when to raise or lower the trained carb rate.
- Show progress: trained carb rate over time, and calories burned vs eaten per ride.

**Non-goals (v1)**
- Full daily diet or macro tracking (this app covers on-bike fueling only).
- Medical or clinical advice. Targets are general sports-nutrition ranges, and the app shows a disclaimer.
- Automatic import from Strava, Garmin or other devices (later).
- Social features or sharing.
- A barcode scanner or global food database (users enter their own foods).

## 5. Key concepts
| Term | Meaning |
|---|---|
| **Food library** | The rider's own foods and drinks, each with carbs, kcal, sodium and fluid per serving. |
| **Trained carb rate** | The g/hr of carbs the rider's gut currently tolerates. Plans never go above it. |
| **Fueling plan** | Targets (carbs g/hr, fluid ml/hr, sodium mg/hr), totals, kcal burned, and an hour-by-hour schedule. |
| **Hourly schedule** | One card per hour listing what to eat and drink, with the reminder **"Spread across the hour"**: small bites every 15–20 min and sips every 10–15 min. |
| **Check-in** | A post-ride rating of stomach, energy and legs, plus "bonked?" and "cramped?" |
| **Gut training** | Raising the trained carb rate gradually (+5–10 g/hr) when check-ins show the stomach is handling it. |
| **Sweat rate** | ml of fluid lost per hour, measured with optional weigh-ins before and after a ride. |

## 6. Features

### 6.1 Account and profile
- Sign up and log in with email and password.
- Profile: weight, age, sex, units (metric or imperial), and optionally FTP, max HR, LTHR and resting HR.
- Fueling settings: trained carb rate (default 60 g/hr), sweat rate if known, and sweat sodium (low / average / salty sweater).

### 6.2 Food library
- Add, edit, delete and favorite foods and drinks.
- Each item has a name, a type (gel, bar, drink, electrolyte, real food), a serving label ("1 gel", "500 ml bottle"), carbs (g), kcal, sodium (mg), fluid (ml, drinks only) and optional caffeine (mg).
- Deleting a food that past rides used archives it instead, so old rides still display correctly.

### 6.3 Plan a ride
The rider enters:
- **Ride type**: training, group ride or race (race day fuels at the top of the range)
- **Where**: outdoor or indoor (trainer, Zwift and similar: more fluid, because there's no wind to cool you)
- **Duration**: typed as hours and minutes, or adjusted with − / + in 15-minute steps
- **Intensity**, using whatever they have, from most to least accurate: **kilojoules**, **average or normalized power**, **average heart rate**, **power zone**, **heart-rate zone**
- **Temperature** (optional; used for fluid and sodium), in °C or °F with a switch on the field. Indoors it's the room temperature
- **Foods and drinks** they'll carry, picked from their library

The app returns:
- Targets: **carbs g/hr, fluid ml/hr, sodium mg/hr**
- Totals for the ride, and estimated **kcal burned**
- An **hourly schedule** built from the chosen foods, with servings rounded to amounts real people can eat (½ bar, not 0.37 bars)
- Which intensity input it used, and how confident the estimate is
- A note if a target can't be met with the chosen foods (e.g. "You're 300 mg/hr short on sodium; add an electrolyte drink")

The plan updates instantly as inputs change, before the ride is saved.

Every saved ride shows a one-line **"eat this per hour"** summary next to its title and date, on the ride page and on Home. For example: *"Each hour: 1 × Electrolyte drink, 1 × Oat bar, 100 ml water · 60 g carbs · 600 ml · 300 mg sodium per hour"*.

### 6.4 Log a ride
- Saving a plan creates a **ride** with a copy of the plan as it was then. Editing a food later doesn't change past rides.
- After the ride, log what was actually eaten and drunk (+/− per item, plus plain water).
- Optional: body weight before and after the ride, to calculate sweat rate.

### 6.5 Post-ride check-in
Quick, big buttons, done in under 30 seconds:
| Question | Scale |
|---|---|
| Stomach (GI) comfort | 1 (bad) – 5 (perfect) |
| Energy | 1 (empty) – 5 (strong all ride) |
| Legs | 1 (heavy / dead legs) – 5 (sharp, feeling the bite) |
| Bonked? | yes / no |
| Cramped? | yes / no |
| Notes | optional free text |

After saving, the app shows suggestions:
- **Carb rate:** "Your stomach handled 60 g/hr well on your last 3 rides. Try 70 g/hr." It also suggests lowering the rate after bad stomach scores.
- **Hydration and sodium:** cramping or heavy legs while under target → "Add sodium or fluid next time." Losing more than 2% of body weight → "Drink more."
- **Under-eating:** low energy or a bonk with a good stomach score → "Eat closer to your plan."

The rider chooses whether to accept a suggested carb-rate change.

### 6.6 Progress
- **Carb-rate chart:** trained g/hr over time, with the actual g/hr eaten on each ride.
- **Energy balance chart:** kcal burned vs kcal eaten per ride.

## 7. API endpoints (CRUD)
All endpoints require login, and every user sees only their own data.

| Resource | Endpoint | Operations |
|---|---|---|
| Foods | `/api/foods` | Create, read (list + single), update, delete food library items |
| Rides | `/api/rides` | Create a ride (the response **includes the fueling plan**), read, update (log intake, fluids, weigh-ins), delete |
| Check-ins | `/api/checkins` | Save post-ride stomach, legs and energy scores (plus bonked, cramped and notes) for a ride; read, update, delete. The response includes suggestions |
| Progress | `/api/progress` | Return carb-rate history (and calories burned vs eaten) for the charts |

Also needed: auth (`/api/auth`: register, login, logout, refresh, me) and profile (`/api/users/me`). Full details are in [ARCHITECTURE.md](ARCHITECTURE.md) §5.

## 8. Scope
**v1 (MVP)**
1. Accounts and profile
2. Food library
3. Plan a ride (carbs, fluid, sodium, hourly schedule)
4. Log a ride, with optional weigh-ins
5. Check-in, with suggestions
6. Progress charts
7. Responsive web app, deployed (Render + MongoDB Atlas)

**Later**
- React Native mobile app (same API)
- Import rides from Strava, Garmin or `.fit` files (pull kJ, power and heart rate automatically)
- Configurable schedule interval (e.g. every 20 or 30 min instead of hourly)
- Caffeine timing guidance
- Event or race mode (carb-loading the days before)
- Reminders during the ride (phone or watch notifications)

## 9. Success measures
- A new user can add 3 foods and get their first plan in **under 3 minutes**.
- Riders complete a check-in on **≥ 60% of logged rides**.
- After 6 weeks, active users' trained carb rate has gone up, with no drop in stomach scores.
- Fewer rides with "bonked" or "cramped" checked over time.

## 10. Safety and disclaimers
- Fueling, fluid and sodium targets are general sports-nutrition guidance, **not medical advice**. The app shows this during signup and on the plan screen.
- Plans never exceed the rider's trained carb rate, and suggested increases are small and step by step.
- Fluid targets are capped so the app never suggests drinking excessive amounts (overdrinking can cause hyponatremia).

## 11. Open items
- **Fueling rules:** drafted in [FUELING_RULES.md](FUELING_RULES.md) (carb g/hr by duration and intensity, zone tables, fluid and sodium ranges, gut-training steps). Review its checklist (§11) before `fuelCalculator.js` is built. Its worked examples become the unit tests.
