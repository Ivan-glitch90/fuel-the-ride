# Fuel the Ride: Fueling Rules

**Status: APPROVED (2026-11-06)**, except §4.1 (ride types), §5.1 (indoor rides) and §9A (events), which are **PROPOSED** and still need your review. This file is the specification for `packages/fuel-core/src/fuelCalculator.js`. Every number here goes into `constants.js`, and every worked example in §8 becomes a Jest test. If a number changes, change it here first.

These values are general sports-nutrition defaults (see §9), **not medical advice**.

---

## 1. Conventions
- All values are metric inside the calculator: grams, ml, mg, kg, minutes, watts, kJ, kcal, °C.
- **IF** (intensity factor) is the ride's average intensity as a fraction of FTP (0.70 = 70% of FTP).
- Ranges are **half-open**: `[60, 90)` means 60 ≤ x < 90.
- Rounding happens **last**, after all adjustments and caps:
  | Value | Rounded to |
  |---|---|
  | Carb target | nearest 5 g/hr |
  | Fluid target | nearest 50 ml/hr |
  | Sodium target | nearest 10 mg/hr |
  | kcal burned | nearest 1 kcal |
- Missing temperature → assume **20 °C** outdoors, **22 °C** indoors (§5.1).
- Tests compare kcal with a ±1% tolerance and everything else exactly.

## 2. Input validation
| Input | Allowed range | If outside |
|---|---|---|
| Duration | 15–720 min | Error |
| Kilojoules | 50–15,000 kJ | Error |
| Average / normalized power | 30–600 W | Error |
| Average heart rate | 60–220 bpm | Error |
| Power zone | 1–5 (zones 6–7 are short intervals, not a ride average) | Error: "Use the zone of your whole-ride average" |
| Heart-rate zone | 1–5 | Error |
| Temperature | −20 to 50 °C | Error |
| Body weight | 30–200 kg | Error |
| Trained carb rate | 20–120 g/hr | Error |
| No intensity input at all | — | Error: "Intensity required" |
| Resolved IF > 1.05 on a ride > 60 min | — | **Warning** (not an error): "That's very hard for this long. Check your inputs" |

## 3. Resolving intensity → IF and kcal burned
The calculator uses the **highest-ranked input** the rider provides. The others are kept for display only.

| Rank | Input | How IF is found | How kcal is found | Confidence |
|---|---|---|---|---|
| 1 | **Kilojoules** | avg W = kJ × 1000 ÷ seconds; IF = avg W ÷ FTP | kcal = kJ | high |
| 2 | **Average power** | IF = avg W ÷ FTP (if normalized power is also given, IF = NP ÷ FTP) | kJ = avg W × seconds ÷ 1000; kcal = kJ | high |
| 2b | **Normalized power only** | IF = NP ÷ FTP | avg W ≈ NP ÷ 1.05, then as above | high |
| 3 | **Average heart rate** | %LTHR → IF via the table in §3.2 | If FTP is known: W = IF × FTP → kJ. If not: **Keytel equation** (§3.3) | medium |
| 4 | **Power zone** | IF = zone midpoint (§3.1) | W = IF × FTP → kJ | medium |
| 5 | **Heart-rate zone** | %LTHR = zone midpoint (§3.2) → IF | Same as rank 3, using HR = midpoint × LTHR | low |

**Why kcal = kJ:** cyclists are about 24% efficient, and 1 kcal = 4.184 kJ. The kJ of work done at the pedals therefore comes out at almost exactly the kcal burned (factor 0.996, treated as 1.0).

**Missing thresholds (each fallback lowers confidence by one level, minimum "low"):**
- FTP missing → estimate **2.5 W/kg × weight**.
- LTHR missing → **0.90 × max HR**. If max HR is missing too → max HR = **208 − 0.7 × age** (Tanaka).

### 3.1 Power zones (Coggan, % FTP)
| Zone | Range | Midpoint IF used |
|---|---|---|
| 1 Recovery | < 55% | 0.45 |
| 2 Endurance | 56–75% | 0.65 |
| 3 Tempo | 76–90% | 0.83 |
| 4 Threshold | 91–105% | 0.98 |
| 5 VO2max | 106–120% | 1.13 |

### 3.2 Heart-rate zones (% LTHR) and the HR → IF table
| HR zone | Range (% LTHR) | Midpoint |
|---|---|---|
| 1 | < 81% | 75% |
| 2 | 81–89% | 85% |
| 3 | 90–93% | 91.5% |
| 4 | 94–99% | 96.5% |
| 5 | ≥ 100% | 102% |

To turn %LTHR into IF, **interpolate linearly** between these points and clamp at both ends:

| % LTHR | ≤ 70 | 75 | 85 | 91.5 | 96.5 | ≥ 102 |
|---|---|---|---|---|---|---|
| IF | 0.45 | 0.50 | 0.65 | 0.83 | 0.98 | 1.10 |

### 3.3 Keytel equation (HR → kcal, used only when FTP is unknown)
kcal per minute =
- **Male:** (−55.0969 + 0.6309 × HR + 0.1988 × kg + 0.2017 × age) ÷ 4.184
- **Female:** (−20.4022 + 0.4472 × HR − 0.1263 × kg + 0.074 × age) ÷ 4.184
- **Unspecified:** the average of the two

This equation tends to **overestimate** calories, which is why it ranks below any power-based method.

### 3.4 Intensity level (used by the carb and fluid tables)
| Level | IF |
|---|---|
| Easy | < 0.65 |
| Moderate | [0.65, 0.80) |
| Hard | ≥ 0.80 |

## 4. Carb target (g/hr)
| Duration | Easy | Moderate | Hard |
|---|---|---|---|
| [0, 60) min | 0 | 0 | 30 |
| [60, 90) | 30 | 40 | 60 |
| [90, 150) | 40 | 60 | 75 |
| [150, 240) | 60 | 75 | 90 |
| ≥ 240 | 60 | 80 | 90 |

Then:
1. **Cap at the trained carb rate:** target = min(table value, trainedCarbRateGph). If the cap applies, the plan shows: *"Limited by your trained rate (X g/hr). Gut training can raise it."*
2. Absolute maximum: 120 g/hr.
3. Temperature does **not** change the carb target in v1.
4. Rates above 60 g/hr work best with mixed glucose and fructose sources (most modern gels and drink mixes). The plan shows this tip whenever the target is above 60.

### 4.1 Ride types (PROPOSED)
| Ride type | Carb target | Note shown |
|---|---|---|
| **Workout** (default; stored as `training`) | Table as above | — |
| **Group ride** | Table as above (no change) | "Group rides have surges: eat on schedule and before hard sections, not after." |
| **Race** | Read the **next-higher intensity column** (easy → moderate, moderate → hard; hard stays hard), still capped by the trained rate | "Race day: fuel at the top of your range, start in the first 20 minutes, and eat nothing you haven't tried in training." |

Why: in a race the rider will go harder than planned and wants to fuel at the top of their range. Group rides average out similarly to training, but with surges, so only the timing advice changes.

## 5. Fluid target (ml/hr)
**If the rider has a measured sweat rate:** target = **0.70 × sweat rate**. Losing a little body weight is normal and fine, so the target is about 70% of what's sweated out. Intensity does not adjust this.

**Otherwise, use the defaults:**
| Temperature | Base |
|---|---|
| < 15 °C | 400 |
| [15, 25) °C | 600 |
| [25, 30) °C | 750 |
| ≥ 30 °C | 900 |

Intensity adjustment (defaults only): **Easy −100**, Moderate ±0, **Hard +100**.

Clamp the result to **300–1,000 ml/hr**. The cap protects against overdrinking, which can cause hyponatremia.

### 5.1 Indoor rides: trainer, Zwift and similar (PROPOSED)
- Indoors there's no wind cooling, so sweat rates go up. **Add 150 ml/hr** to the fluid target. This applies after the default or sweat-rate value is calculated, and before clamping and rounding. It also applies on top of a measured sweat rate, since those are usually measured outdoors.
- An empty temperature means a typical room: **22 °C**.
- Sodium follows fluid (§6) as usual, so it rises with the extra fluid.
- The plan shows: "Indoors there's no wind to cool you, so you sweat more: we added 150 ml/hr. A fan helps a lot."

## 6. Sodium target (mg/hr)
Sodium follows fluid: target = **fluid target (L/hr) × sweat sodium concentration**.

| Sweat sodium setting | mg per litre |
|---|---|
| Low | 300 |
| Average (default) | 500 |
| Salty sweater | 800 |

- Clamp the result to **200–1,000 mg/hr**.
- **Optional on short, cool rides:** if duration < 90 min **and** temperature < 25 °C, the sodium target is **0**, and the plan says "Sodium optional for this ride."
- Going over the sodium target is acceptable up to 1,000 mg/hr. Electrolyte drinks often overshoot, and that's fine.

## 7. Building the hourly schedule
### 7.0 Choosing the foods for the ride (decided 2026-11-08)
By default the app picks the foods from the rider's library. The rider can still change the picks ("Change foods"), and the plan then uses exactly what they chose.

1. **Effort profile:**
   | Profile | When |
   |---|---|
   | **Fast** | Race, or intensity level hard (IF ≥ 0.80) |
   | **Mixed** | Moderate |
   | **Steady** | Easy |
2. **Preferred food types**, best first:
   | Profile | Order |
   |---|---|
   | Fast | gel → drink → electrolyte → bar → real food (fast carbs, easy on the stomach at high effort) |
   | Mixed | bar → gel → drink → real food → electrolyte |
   | Steady | real food → bar → gel → drink → electrolyte (solid food is fine when the effort is easy) |
3. Within a type, **favorites first**, then name A–Z. **Archived foods are never picked.**
4. Take at most **4 solid carb foods**, **2 drinks** and **1 electrolyte without fluid** (tabs/capsules), keeping the order above. The picks become the "picked foods" for §7.3, so their order is the tie-break order, and the mixing rule applies.
5. **Preferred types come first in the carb step (§7.3 step 2).** With app-picked foods, the search first uses only the most preferred type (e.g. gels for a race). It adds the next type only if the best combination isn't within 10 g of the target. It uses the first set of types that gets within 10 g; if none does, the closest one, preferring fewer types on ties. Manual picks use the plain §7.3 search.
6. The plan records what was picked: `foodSelection` = { mode: auto | manual, profile, foodIds }.

Example: the S1 library (oat bar, energy gel, electrolyte drink) on ride T1 (moderate → Mixed) is ordered bar → gel → drink. That's exactly S1's picked order, so S1 is unchanged.

### 7.1 Blocks
- The ride is split into **1-hour blocks**, plus a final partial block if needed.
- Each block's targets = hourly targets × (block minutes ÷ 60).
- **If the final partial block is under 20 min, it gets no fueling.** Eating in the last few minutes doesn't help. That share is left out of the totals.
- Every block shows the note **"Spread across the hour: small bites every 15–20 min, sips every 10–15 min."**

### 7.2 Serving steps
| Food type | Smallest step |
|---|---|
| Gel | 1 (whole) |
| Bar, real food | 0.5 |
| Drink (has fluid) | 0.5 bottle |
| Electrolyte without fluid (tablets, capsules) | 1 (whole) |

At most **4 food servings per block** (½ bar counts as 0.5). Drinks and electrolyte tabs don't count toward this limit. Plain water is rounded to the nearest 50 ml.

### 7.3 Filling each block (in this order)
1. **Fluid first.** Use the chosen drinks. If more than one is chosen, use the one with the most sodium when sodium is needed, otherwise the first one the rider picked. Servings = fluid target ÷ ml per serving, rounded to the **nearest 0.5**. **Mixing (decided 2026-11-07):** if the rider also picked solid foods with carbs, a drink with carbs covers **at most half the block's carb target**: servings = min(the fluid-based servings, ½ × carb target ÷ drink carbs, rounded down to 0.5), never less than 0.5. Food covers the rest. If the block is then ≥ 100 ml short, add **plain water** to fill the gap. If no drinks were chosen, all of the fluid target is plain water. Carbs and sodium in the drinks count toward the block's totals.
2. **Carbs next.** Remaining carbs = carb target − carbs from drinks. Choose the combination of food servings (using the steps in §7.2) whose carbs are **closest to the remaining amount**. Break ties by (a) fewer servings, then (b) the order the rider picked the foods. This makes the search fully deterministic.
3. **Sodium last.** If the block is still ≥ 100 mg short on sodium, add whole servings of the first electrolyte tablet or capsule chosen, if any: gap ÷ sodium per tab, rounded, minimum 1. If it's still short, the plan shows: *"About X mg/hr short on sodium. Add an electrolyte drink or tabs."*
4. **Carb accuracy check.** If a block's carbs are more than 10 g away from its target, the plan shows: *"Can't hit X g with these foods. Add a gel or a drink with carbs."*

### 7.4 Totals
Plan totals = the sum of all blocks: carbs, fluid, sodium and kcal eaten. The targets are also kept as rates (per hour).

### 7.5 What to carry
The packing list for the whole ride: each food's servings summed across all blocks, plus total plain water, in the order foods first appear. E.g. S1 over 2 h → "2 × Electrolyte drink, 2 × Oat bar, 200 ml water".

### Schedule case S3: mixing a carb drink with food
Rider A, 120 min, avg 175 W, **10 °C** → 60 g carbs, 400 ml fluid per hour. Foods: *First endurance* (drink: 60 g carbs, 400 ml) and *Energy gel* (22 g).
- Without the mixing rule: 1 bottle covers all 60 g, so only one food appears.
- With it: drink ≤ ½ × 60 = 30 g → **½ bottle** (200 ml). Gap 200 ml → **200 ml water**. Remaining 30 g → **1 gel** (22 g, 8 off, within 10).
- Each hour: ½ × First endurance, 1 × Energy gel, 200 ml water (52 g carbs). **Carry (2 h): 1 × First endurance, 2 × Energy gel, 400 ml water.**
- If only the drink is picked, it still covers everything (nothing to mix with).

## 8. Worked examples (these become the Jest tests)
### Rider A
Male, 75 kg, 40 years old, FTP 250 W, LTHR 165, trained rate 70 g/hr, sweat sodium average, no measured sweat rate.

### Example food library
| Food | Serving | Carbs | kcal | Sodium | Fluid |
|---|---|---|---|---|---|
| Oat bar | 1 bar | 44 g | 250 | 150 mg | — |
| Energy gel | 1 gel | 22 g | 100 | 50 mg | — |
| Electrolyte drink | 1 bottle | 15 g | 60 | 400 mg | 500 ml |

### Target cases
| # | Ride | Source → IF | kcal burned | Carbs g/hr | Fluid ml/hr | Sodium mg/hr | Notes |
|---|---|---|---|---|---|---|---|
| T1 | A, 120 min, avg 175 W, 22 °C | power → 0.70 (moderate) | **1,260** | **60** | **600** | **300** | Basic case |
| T2 | A, 210 min, 2,275 kJ, 30 °C | kJ → 180.6 W → 0.72 (moderate) | **2,275** | **70** (table 75, capped by trained 70) | **900** | **450** | Cap note shown; final block is 30 min at ½ the hourly targets |
| T3 | A, 90 min, avg HR 145, 18 °C | HR → 87.9% LTHR → 0.730 (moderate) | **985** (W = 0.730 × 250 = 182.4) | **60** | **600** | **300** | Medium confidence |
| T4 | A, 45 min, power zone 2, 10 °C | zone → 0.65 (moderate) | **439** (162.5 W × 2,700 s) | **0** | **400** | **0** | Short, cool ride: sodium optional |
| T5 | Rider B*, 180 min, HR zone 2, 20 °C | HR zone → LTHR est. 168.3 → HR 143.1 → 0.65 | **1,644** (Keytel, female) | **50** (table 75, capped by trained 50) | **700** (0.7 × 1,000) | **560** (0.7 L × 800) | Low confidence (estimated LTHR, Keytel) |

\* **Rider B:** female, 60 kg, 30 years old, no FTP, no LTHR, no max HR, trained rate 50 g/hr, **salty sweater**, measured sweat rate 1,000 ml/hr.

T2 totals: 245 g carbs, 3,150 ml fluid, 1,575 mg sodium (3 full blocks + one 30-min block).

### Indoor and ride-type cases (PROPOSED, §4.1 / §5.1)
| # | Ride | Carbs g/hr | Fluid ml/hr | Sodium mg/hr | Notes |
|---|---|---|---|---|---|
| T6 | T1 **indoors**, no temperature entered | 60 | **750** (600 at 22 °C + 150) | **380** (0.75 L × 500 = 375 → 380) | INDOOR |
| T7 | T1 as a **race** | **70** (moderate → hard column = 75, capped by trained 70) | 600 | 300 | RACE_DAY, capped |
| T8 | T1 as a **group ride** | 60 | 600 | 300 | GROUP_RIDE |

### Schedule case S1 (ride T1, foods = all three above)
Per block: 60 g carbs, 600 ml fluid, 300 mg sodium.
1. **Fluid:** 600 ÷ 500 = 1.2 → rounds to **1 bottle** (500 ml). That's 100 ml short, so add **100 ml plain water**. The drink adds 15 g carbs and 400 mg sodium.
2. **Carbs:** 45 g remaining. The candidates 1 bar (44 g), 2 gels (44 g) and ½ bar + 1 gel (44 g) are all 1 g off. The tie goes to the fewest servings → **1 oat bar**.
3. **Sodium:** 550 mg, over the 300 target. That's fine.
4. **Result for each hour:** *"1 electrolyte drink + 100 ml water + 1 oat bar"*, giving 59 g carbs, 600 ml, 550 mg sodium and 310 kcal.
5. **Totals (2 h):** 118 g carbs, 1,200 ml fluid, 1,100 mg sodium, 620 kcal eaten.

### Schedule case S2 (ride T1, gels only, no drinks)
Fluid: 600 ml plain water. Carbs: 60 g → 3 gels = 66 g (6 off) beats 2 gels = 44 g (16 off) → **3 gels**. Sodium: 150 mg, which is 150 short and there are no electrolytes → warning *"About 150 mg/hr short on sodium."*

### Edge cases
| # | Input | Expected |
|---|---|---|
| E1 | 130 min ride | 2 full blocks; the final 10-min block gets no fueling |
| E2 | Power zone 6 | Validation error |
| E3 | No intensity input | Validation error |
| E4 | Avg 300 W with FTP 250 on a 120-min ride (IF 1.2) | Plan returned with the "very hard" warning |
| E5 | Empty food library | Targets returned, schedule empty, plus the message "Add foods to get a schedule" |
| E6 | Measured sweat rate 2,000 ml/hr | Fluid clamped to 1,000 ml/hr |

## 9. Check-in suggestions (`suggestAdjustments`)
### 9.1 Gut training (trained carb rate)
- A **qualifying ride** is ≥ 90 min long, and the rider ate at least (trained rate − 5) g/hr, so the rate was actually tested.
- Rate changes are only suggested right after a **qualifying** ride. A short ride, or one where the rider ate well below the rate, didn't test it, so the rate stays the same.
- **Increase:** the last 3 qualifying check-ins all have a stomach score ≥ 4 → suggest **+10 g/hr** if the trained rate is below 60, otherwise **+5 g/hr**. At most one increase per 7 days. Maximum 120.
- **Decrease:** the latest qualifying check-in has a stomach score ≤ 2 → suggest **−10 g/hr**. Minimum 30.
- Otherwise: no change.
- Suggestions are **never applied automatically**. The rider accepts or ignores them.

### 9.2 Hydration, sodium and eating flags
| Flag | Triggered when | Message |
|---|---|---|
| `more-fluid` | Weight loss > 2% of starting weight, **or** (cramped or legs ≤ 2) and fluid drunk < 80% of target | "Drink more next time." |
| `less-fluid` | Weight gained > 0.5 kg during the ride | "You gained weight. You may be overdrinking, which can be dangerous. Drink to thirst." |
| `more-sodium` | (cramped or legs ≤ 2) and sodium < 80% of target | "Add sodium next time." |
| `eat-more` | (bonked or energy ≤ 2) and stomach ≥ 4 and carbs eaten < 80% of target | "Your stomach was fine. Eat closer to your plan." |

### 9.3 Sweat rate
- sweat rate (ml/hr) = ((weight before − weight after) kg × 1,000 + fluid drunk ml) ÷ hours
- Only calculated for rides ≥ 60 min with both weigh-ins. Clamped to 200–2,500 ml/hr.
- After a measurement, the app offers: *"Update your sweat rate to X ml/hr?"*

### Suggestion examples
| # | Situation | Expected |
|---|---|---|
| G1 | Trained 60; last 3 qualifying check-ins: stomach 4, 5, 4, ate 58, 62, 60 g/hr; last increase 10 days ago | +5 → **65** |
| G2 | Trained 50; stomach 5, 5, 4 on qualifying rides | +10 → **60** |
| G3 | Trained 70; latest qualifying ride ate 68 g/hr, stomach 2 | −10 → **60** |
| G4 | Trained 70; stomach 5 but ate 40 g/hr (not qualifying), energy 2 | No rate change; `eat-more` |
| G5 | Same as G1, but the last increase was 3 days ago | No change (7-day limit) |
| H1 | Rider A, 120 min, 75.0 → 73.2 kg, drank 1,200 ml | Loss 2.4% → `more-fluid`; sweat rate **1,500 ml/hr** offered |
| H2 | Cramped; sodium 200 mg/hr vs target 450 | `more-sodium` |
| H3 | 75.0 → 75.6 kg | `less-fluid` |

## 9B. Rides like this (`findSimilarRides`) (PROPOSED)
When planning a ride, show past rides that look like it, so the rider can reuse what worked.
- **Same kind of ride:** duration within **±25%**, and intensity (kcal burned per hour) within **±20%**.
- **Something to learn:** only rides with food logged (`actual.carbsGph > 0`).
- **What worked comes first:** rides with a check-in where stomach **and** energy were **≥ 4/5** and no bonk. Then the closest match (relative differences, each divided by its tolerance). Then the newest.
- **Show up to 3**, each with what was eaten **per hour**: servings ÷ hours, rounded to the nearest ½, so "1½ × Oat bar per hour".
- **A suggestion, never automatic:** the rider can choose to plan with the same foods.

| # | Planned | Past rides | Expected |
|---|---|---|---|
| R1 | 120 min, 630 kcal/h | A: 110 min, 650 kcal/h, ate, stomach 5 / energy 4. B: 125 min, 620 kcal/h, ate, stomach 2 | A first (worked), then B |
| R2 | 120 min, 630 kcal/h | C: 200 min (too long). D: 120 min, 900 kcal/h (too hard). E: 120 min, nothing logged | none |
| R3 | 120 min | F: 120 min, 2 × bar + 3 × gel logged | per hour: 1 × bar, 1½ × gel |

## 9A. Events: planning a race or group ride from last time (PROPOSED)
An **event** is an upcoming race or group ride, planned from the rider's data for the **same or a similar event last time**.

### 9A.1 Same effort, today's FTP
- Last time's average power comes from, in this order: avg power → kJ ÷ seconds → NP ÷ 1.05 (§3).
- **Projected power = last time's power × (today's FTP ÷ FTP at the time).** If last time's NP was given, it's scaled the same way, and the plan uses it for intensity (§3).
- If either FTP is unknown, the ratio is 1 (same watts as last time), and the plan says so.
- If last time only has an **average heart rate**, the plan reuses it as-is. Heart rate relative to LTHR stays comparable as fitness changes.
- Duration = the event's expected duration if entered, otherwise last time's duration. The projected watts are the same either way, and kJ follow from watts × time.

### 9A.2 Race-day carb goal
- **Suggested goal** = the carb table (§4) for the projected intensity and duration, using the race column bump for races (§4.1), **without** the trained-rate cap. That's what the event needs.
- The rider can override the goal (20–120 g/hr).

### 9A.3 Gut-training build-up
- Days until the event are **calendar days**. Event dates are stored at local midday, so the count is the time difference rounded to the nearest whole day, the same whatever time of day the rider looks.
- Weeks until the event = floor(days until event ÷ 7). The **last week is race week: hold, don't increase.** Build weeks = weeks until − 1.
- Each build week raises the practice rate by **+10 g/hr while below 60, +5 g/hr from 60 up** (same steps as §9.1), stopping at the goal and at 120.
- **Race-day carbs** = min(goal, the rate reached by race week). The plan for the event uses that as the trained rate.
- If the goal isn't reachable in time, show: *"Race day is in N weeks: at a safe +5–10 g/hr per week you can reach about X g/hr. The plan uses X."*
- Events 0–6 days away get no build-up; race day uses today's trained rate.
- The ramp is guidance only. The trained rate still changes only through check-in suggestions the rider accepts (§9.1).

### 9A.4 Notes from last time
- Bonked or low energy (≤ 2), and ate below the goal → *"Last time you ate X g/hr and ran low. This plan: Y g/hr."*
- Stomach ≤ 2 → *"Your stomach struggled last time at X g/hr. The build-up trains it toward Y."*

### Event examples (become the Jest tests)
Rider A* = Rider A from §8, but **FTP 270**, trained rate **60**, "today" = 2026-11-06.

| # | Event | Last time | Expected |
|---|---|---|---|
| EV1 | Race on 2026-12-18 (42 days → 6 weeks → 5 build weeks), outdoor | 180 min, avg 210 W, NP 230 W, FTP then 250 | Ratio 1.08 → **226.8 W avg, 248.4 W NP**, IF 0.92 (hard). Suggested goal **90**. Ramp 65 → 70 → 75 → 80 → 85, **not reachable**. Race-day carbs **85** |
| EV2 | Same, trained rate 50 | — | Ramp 60 → 65 → 70 → 75 → 80, race-day **80** |
| EV3 | Race in 5 days | — | No build-up; race-day carbs = trained 60 |
| EV4 | Last time has no FTP | avg 210 W | Ratio 1 → 210 W; note FTP_RATIO_UNKNOWN |
| EV5 | Last time HR only | avg HR 160 | Intensity {avgHr: 160}; basis hr |
| EV6 | Expected duration 240 min | as EV1 | Same 226.8 W, 240 min; goal from the ≥ 240 hard row (90) |
| EV7 | Goal overridden to 70 | as EV1 | Ramp 65 → 70 (reachable), race-day 70 |

## 10. Sources
- Thomas, Erdman & Burke (2016). *ACSM/AND/DC Joint Position Statement: Nutrition and Athletic Performance.*
- Jeukendrup (2014). *A step towards personalized sports nutrition: carbohydrate intake during exercise.* Sports Medicine.
- Jeukendrup (2017). *Training the gut for athletes.* Sports Medicine.
- Sawka et al. (2007). *ACSM Position Stand: Exercise and Fluid Replacement.*
- Keytel et al. (2005). *Prediction of energy expenditure from heart rate monitoring during submaximal exercise.*
- Tanaka, Monahan & Seals (2001). *Age-predicted maximal heart rate revisited.*
- Coggan power zones; Friel heart-rate zones (% LTHR).

## 11. Review checklist (for you)
- [ ] **New:** indoor +150 ml/hr and 22 °C room default (§5.1): right for your trainer setup?
- [ ] **New:** race = next-higher carb column; group ride = note only (§4.1)?
- [ ] **New:** events (§9A): same effort scaled by today's FTP; race-week hold; +10/+5 g/hr weekly build-up?
- [ ] Carb table (§4): do the numbers match your experience at each duration and intensity?
- [ ] Fluid defaults (§5): too much or too little for your climate?
- [ ] Sodium per litre (§6): are the low / average / salty values right?
- [ ] Gut-training steps (§9.1): +5 / +10 / −10, and a 7-day limit?
- [ ] Hourly schedule: is the "fluid first, then carbs, then sodium" order right?
- [ ] Anything missing (e.g. caffeine, pre-ride meal)?
