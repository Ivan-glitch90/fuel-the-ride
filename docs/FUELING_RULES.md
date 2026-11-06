# Fuel the Ride: Fueling Rules

**Status: APPROVED (2026-11-06)**, except §4.1 (ride types) and §5.1 (indoor rides), which are **PROPOSED** and still need your review. This file is the specification for `packages/fuel-core/src/fuelCalculator.js`. Every number here goes into `constants.js`, and every worked example in §8 becomes a Jest test. If a number changes, change it here first.

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
| **Training** (default) | Table as above | — |
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
1. **Fluid first.** Use the chosen drinks. If more than one is chosen, use the one with the most sodium when sodium is needed, otherwise the first one the rider picked. Servings = fluid target ÷ ml per serving, rounded to the **nearest 0.5**. If that leaves the block ≥ 100 ml short, add **plain water** to fill the gap. If no drinks were chosen, all of the fluid target is plain water. Carbs and sodium in the drinks count toward the block's totals.
2. **Carbs next.** Remaining carbs = carb target − carbs from drinks. Choose the combination of food servings (using the steps in §7.2) whose carbs are **closest to the remaining amount**. Break ties by (a) fewer servings, then (b) the order the rider picked the foods. This makes the search fully deterministic.
3. **Sodium last.** If the block is still ≥ 100 mg short on sodium, add whole servings of the first electrolyte tablet or capsule chosen, if any: gap ÷ sodium per tab, rounded, minimum 1. If it's still short, the plan shows: *"About X mg/hr short on sodium. Add an electrolyte drink or tabs."*
4. **Carb accuracy check.** If a block's carbs are more than 10 g away from its target, the plan shows: *"Can't hit X g with these foods. Add a gel or a drink with carbs."*

### 7.4 Totals
Plan totals = the sum of all blocks: carbs, fluid, sodium and kcal eaten. The targets are also kept as rates (per hour).

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
- [ ] Carb table (§4): do the numbers match your experience at each duration and intensity?
- [ ] Fluid defaults (§5): too much or too little for your climate?
- [ ] Sodium per litre (§6): are the low / average / salty values right?
- [ ] Gut-training steps (§9.1): +5 / +10 / −10, and a 7-day limit?
- [ ] Hourly schedule: is the "fluid first, then carbs, then sodium" order right?
- [ ] Anything missing (e.g. caffeine, pre-ride meal)?
