# Fuel the Ride: Architecture

## 0. Product scope (confirmed)
1. **Profile:** weight, age, sex, optional FTP and heart-rate thresholds, a **trained carb rate** (the g/hr the gut currently tolerates), hydration data (sweat rate if known, and whether the rider is a "salty sweater") and units (metric or imperial).
2. **Food library:** the user's own foods (gel, bar, drink mix, banana, rice cake…), each with serving size, carbs, kcal, sodium and fluid per serving (fluid applies to drinks), plus optional caffeine.
3. **Plan a ride:** the user enters duration, intensity (any of: kilojoules, average power, average heart rate, power zone, heart-rate zone; see §6.1) and optionally temperature. The app returns target **carbs g/hr, fluid ml/hr and sodium mg/hr**, the totals, kcal burned, and an **hourly schedule** ("Hour 1: 1 bar + 1 gel + 1 bottle with electrolyte mix"). Every hour shows the reminder **"Spread across the hour"**: small bites every 15–20 min and sips every 10–15 min, not everything at once.
4. **Log a ride:** a ride stores a snapshot of the plan plus what was actually eaten and drunk. Optional weigh-ins before and after the ride measure the user's sweat rate (§6.2).
5. **Check-in:** after the ride, the user rates:
   - **Stomach (GI) comfort** 1–5
   - **Energy** 1–5
   - **Legs** 1–5, from "Heavy / dead legs" (1) to "Sharp, feeling the bite" (5)
   - **Bonked?** and **Cramped?** (yes/no)
   - Optional notes

   Check-ins suggest when to raise the trained carb rate (gut training) and flag hydration and sodium problems. For example, cramping or heavy legs on a hot ride → "consider more sodium or fluid next time."
6. **Charts:** (a) trained g/hr over time and (b) kcal burned vs kcal eaten for each ride.

## 1. Key decisions
| Decision | Choice | Why |
|---|---|---|
| Repo layout | npm-workspaces monorepo: `apps/web`, `apps/api`, `packages/fuel-core` | `fuel-core` gets shared by web, API and the future React Native app |
| Fueling math | `packages/fuel-core/src/fuelCalculator.js`: pure functions with no I/O, React or Mongoose | Unit-tested in isolation and reused everywhere |
| Who computes plans | The client computes them for an instant preview, and **the server recomputes them when a ride is saved** | Quick UI, while the server stays the source of truth for the stored plan |
| Web build / routing | Vite + React Router 7 | Simple and fast |
| Server state on the client | TanStack Query (React Query) | Caching, refetching and cache invalidation without hand-written global state |
| Auth | Short-lived JWT access token plus a refresh token in an **httpOnly, Secure, SameSite cookie**. The API also accepts `Authorization: Bearer` | The cookie suits the web app, and the Bearer header works for React Native later |
| Passwords | bcrypt (cost 12) | Industry standard |
| Validation | zod schemas on API inputs | One schema per route, giving clear 400s |
| Deploy unit | One app container (Express serves the built React app). Locally it runs next to a `mongo` container | Matches "app + MongoDB" in docker-compose |
| Hosting | **Render** (Docker web service, deploys automatically from GitHub) + **MongoDB Atlas** (managed database) | Fastest path to working CI/CD. The same Dockerfile can move to Fly.io or a VPS later |
| Units | Stored in metric (g, kg, min, kcal) and converted only in the UI | No conversion bugs in the math or the database |

## 2. Folder structure
```
fuel_ride/
├── package.json                 # workspaces: apps/*, packages/*
├── Dockerfile                   # multi-stage: build web → run api (serves web/dist)
├── docker-compose.yml           # local dev: app + mongo (+ volume)
├── render.yaml                  # Render service definition (production)
├── .env.example
├── .github/workflows/ci.yml     # lint → test → build image → (deploy)
├── docs/
│   ├── PRODUCT.md
│   └── ARCHITECTURE.md
├── packages/
│   └── fuel-core/               # PURE fueling math – no deps on UI/DB
│       ├── src/
│       │   ├── fuelCalculator.js   # public API (see §6)
│       │   ├── constants.js        # carb bands, zone tables, fluid/sodium defaults
│       │   ├── units.js            # metric/imperial helpers
│       │   └── index.js
│       └── test/fuelCalculator.test.js   # Jest
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── server.js           # starts http + db connection
│   │   │   ├── app.js              # express app (exported for tests)
│   │   │   ├── config/             # env loading, db.js
│   │   │   ├── models/             # User, Food, Ride, CheckIn (Mongoose)
│   │   │   ├── routes/             # auth, users, foods, rides, checkins, progress
│   │   │   ├── controllers/        # thin: parse → service → respond
│   │   │   ├── services/           # business logic, calls fuel-core + models
│   │   │   ├── middleware/         # requireAuth, validate(zod), errorHandler, rateLimit
│   │   │   ├── utils/              # HttpError
│   │   │   └── validators/         # zod schemas per route
│   │   ├── test/                   # Jest + supertest + mongodb-memory-server
│   │   └── postman/                # FuelTheRide.postman_collection.json + env
│   └── web/
│       ├── index.html
│       ├── vite.config.js          # dev proxy /api → :4000; Vitest config
│       └── src/
│           ├── main.jsx            # providers: QueryClient, Auth, Router
│           ├── App.jsx             # route table (AppRoutes)
│           ├── api/                # fetch client (cookies, 401 → refresh once → retry, ApiError) + per-resource fns
│           ├── auth/               # AuthContext (useAuth), RouteGuards (RequireAuth, PublicOnly)
│           ├── hooks/              # useFoods, useProfile (+ useRides, useCheckIns, useProgress next) — React Query
│           ├── lib/                # forms (string ↔ number), units (metric/imperial display), food labels
│           ├── pages/              # one file per route (see §4), with *.test.jsx next to them
│           ├── components/
│           │   ├── layout/         # AppShell (header + bottom nav), PageHeader
│           │   ├── ui/             # Button, Field/NumberField, SegmentedControl, ConfirmButton, Notice, icons
│           │   ├── foods/          # FoodCard, FoodForm
│           │   ├── profile/        # ProfileForm
│           │   ├── plan/           # RideInputForm, FuelSummary, FuelSchedule (next)
│           │   ├── rides/          # RideList, IntakeLogger, CheckInForm (next)
│           │   └── charts/         # CarbRateChart, EnergyBalanceChart (D3, next)
│           ├── styles/             # tokens.css (large type scale, light/dark), global.css
│           └── test/               # Vitest setup + renderApp/mockApi helpers
```

## 3. Data model (MongoDB / Mongoose)
- **users**: `email` (unique, lowercased), `passwordHash` (required unless the rider signs in with Google), `googleId?` (Google's stable user id, unique; never sent to clients), `name`, `weightKg`, `birthYear`, `sex` (for heart-rate calorie formulas), `ftpW?`, `maxHr?`, `lthr?`, `restingHr?`, `trainedCarbRateGph` (default 60), `lastCarbRateIncreaseAt?` (for the 7-day gut-training limit), `sweatRateMlPerHr?` (measured or entered), `sweatSodium` (low|average|salty, default average), `units`, `createdAt`
- **foodLibrary**: `userId` (indexed), `name`, `type` (gel|bar|drink|electrolyte|real), `servingLabel` ("1 gel", "500 ml bottle"), `carbsG`, `kcal`, `sodiumMg` (default 0), `fluidMl` (default 0; required > 0 for drinks, must be 0 for gels/bars/real food, either for electrolytes: a drink mix has fluid, a salt tab doesn't), `caffeineMg?`, `favorite`, `archived`
- **rides**: `userId`, `name?`, `date`, `durationMin`, `rideType` (training|group|race, default training), `indoor` (default false), `intensity` {workKj?, avgPowerW?, normalizedPowerW?, avgHr?, powerZone?, hrZone?}, `tempC?`, `foodIds[]` (foods the rider will carry, in the order picked), `plan` (a **snapshot** of fuel-core's `buildFuelPlan` output: intensity, targets, targetTotals, totals, kcalBurned, schedule[], notes[], warnings[]), `intensitySource` (which input the math used), `intake[]` {foodId, servings}, `plainWaterMl` (water not in the food library), `actual` (fuel-core `summarizeIntake` output; null until something is logged), `weightPreKg?`, `weightPostKg?`, `status` (planned|completed). Index: `{userId, date:-1}`
- **checkIns**: `userId`, `rideId` (unique), `rideDate` (copied from the ride, for history order and charts), `giScore 1–5`, `energyScore 1–5`, `legsScore 1–5` (1 = heavy/dead legs, 5 = sharp, feeling the bite), `bonked`, `cramped`, `notes?`, `trainedGphAtCheckIn` (the rider's trained rate at check-in time; feeds the carb-rate chart), `suggestions` (fuel-core `suggestAdjustments` output: `carbRate {suggestedGph, change, reason}`, `flags[]` e.g. "more-sodium", "more-fluid", `measuredSweatRateMlPerHr`). Actual intake isn't copied here: it's read from the ride, so intake logged later still counts. Index: `{userId, rideDate:-1}`
- **events** (upcoming race or group ride): `userId`, `name`, `type` (race|group), `date`, `durationMin?` (empty = last time's), `indoor`, `tempC?`, `carbGoalGph?` (rider override), `foodIds[]`, `past` {`rideId?`, `durationMin`, `intensity` {avgPowerW?, normalizedPowerW?, workKj?, avgHr?}, `ftpAtTimeW?`, `carbsGphEaten?`, `giScore?`, `energyScore?`, `bonked?`}. **Only inputs are stored.** The forecast (fuel-core `buildEventPlan`) is computed on every read, so it always reflects today's FTP and trained rate. Index: `{userId, date:1}`. Rides also store `ftpAtRideW` (FTP when planned), so a logged ride can fill "last time" later.
- **sessions** (one per refresh token): `userId`, `jti` (unique), `expiresAt` (TTL index, so MongoDB deletes expired sessions), `revokedAt`, `userAgent`. Refreshing revokes the old session and creates a new one. Reusing a revoked token revokes **all** of that user's sessions (stolen-token defence).

The plan is stored as a snapshot, so editing a food later does not rewrite old rides.

## 4. Front-end routes and component tree
| Path | Page | Auth |
|---|---|---|
| `/login`, `/signup` | LoginPage, SignupPage | public |
| `/` | DashboardPage | ✔ |
| `/plan` | PlanRidePage (calculator) | ✔ |
| `/rides` | RidesPage | ✔ |
| `/rides/:id` | RideDetailPage (plan + log intake) | ✔ |
| `/rides/:id/check-in` | CheckInPage | ✔ |
| `/foods` | FoodLibraryPage | ✔ |
| `/foods/new`, `/foods/:id` | FoodEditPage | ✔ |
| `/progress` | ProgressPage (charts) | ✔ |
| `/events` | EventsPage (upcoming, past) | ✔ |
| `/events/new`, `/events/:id/edit` | EventFormPage (inputs + live forecast) | ✔ |
| `/events/:id` | EventDetailPage (countdown, build-up, race-day plan) | ✔ |
| `/settings` | SettingsPage (profile, units, logout) | ✔ |

```
<App>
 ├─ QueryClientProvider
 └─ AuthProvider                      (shared: current user/session)
     └─ Router
         ├─ LoginPage / SignupPage
         └─ <RequireAuth><AppShell>   (header + BottomNav for thumbs)
             ├─ DashboardPage
             │   ├─ "Plan a ride" button → /plan
             │   ├─ NextCheckInPrompt
             │   ├─ Recent rides (name, RideBadges, date, HourlySummary "eat this per hour")
             │   └─ CarbRateChart (mini)
             ├─ PlanRidePage
             │   ├─ Ride card (name, date, ride type, outdoor/indoor,
             │   │             DurationInput h + min with −/+, TemperatureInput with °C/°F switch)
             │   ├─ IntensityInput (tabs: power | kJ | HR | power zone | HR zone)
             │   ├─ FoodPicker (tap foods in order of preference; favorites pre-picked)
             │   ├─ FuelSummary (carbs g/hr, fluid ml/hr, sodium mg/hr, kcal)
             │   ├─ FuelSchedule
             │   │   └─ HourCard ×N ("Hour 1 → 1 bar + 1 gel + 1 bottle",
             │   │                   footer: "Spread across the hour")
             │   └─ SaveRideButton
             ├─ RidesPage → RideList → RideRow
             ├─ RideDetailPage
             │   ├─ HourlySummary + FuelSummary + FuelSchedule (snapshot)
             │   ├─ IntakeLogger ("Fill in as planned", −/+ half servings per food,
             │   │                "ate something else?", plain water, before/after weight)
             │   └─ CheckInCard (scores + Edit) + Suggestions, or a "Check in" button
             ├─ CheckInPage (/rides/:id/check-in)
             │   ├─ CheckInForm (3 × SegmentedControl 1–5: stomach, energy, legs;
             │   │               bonked, cramped, notes)
             │   └─ Suggestions after saving: "Set my trained rate to X g/hr",
             │                  hydration/sodium flags, "Use this sweat rate"
             ├─ FoodLibraryPage → FoodList → FoodCard
             ├─ FoodEditPage → FoodForm
             ├─ ProgressPage
             │   ├─ CarbRateChart       (D3 line: trained g/hr over time)
             │   └─ EnergyBalanceChart  (D3 grouped bars: burned vs eaten per ride)
             ├─ EventsPage → event cards (badges, countdown, HourlySummary)
             ├─ EventFormPage
             │   ├─ Event card (name, race/group, date, where, temperature, duration)
             │   ├─ LastTimeInput ("fill from a logged ride" or typed: duration, power/kJ/HR,
             │   │                 FTP back then, carbs eaten, stomach, bonked)
             │   ├─ carb goal (suggested shown as hint), FoodPicker
             │   └─ live forecast: ProjectionSummary, ForecastNotes, GutTrainingPlan,
             │                     FuelSummary, FuelSchedule
             ├─ EventDetailPage (same forecast from the API, Edit, two-tap Delete)
             └─ SettingsPage → ProfileForm
```
Chart components get data through props and render D3 into a `ref` inside `useEffect`. They are presentational only and never fetch data themselves.

Mobile-first UI: base font size 18px or larger, tap targets at least 48px, steppers instead of free-text number fields, a bottom nav, and a single-column layout that widens to two columns at ≥768px.

## 5. API routes (`/api`, JSON)
The four core resources match [PRODUCT.md](PRODUCT.md) §7: `foods`, `rides`, `checkins`, `progress`.
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Create the account, set cookies |
| POST | `/auth/login` | Verify the password, set cookies |
| POST | `/auth/refresh` | Rotate the access token |
| POST | `/auth/logout` | Clear cookies and revoke the refresh token |
| GET | `/auth/me` | Current user |
| GET | `/auth/providers` | Sign-in options for the app: `{ google: { clientId } \| null }` |
| POST | `/auth/google` | `{ credential }` (Google ID token) → session cookies. 201 `{ user, created: true }` for a new rider, 200 for a returning one (matched by Google id). 409 `EMAIL_REGISTERED_WITH_PASSWORD` if the email already has a password account |
| GET / PATCH | `/users/me` | Profile (weight, FTP, HR thresholds, trained rate, sweat rate/sodium, units) |
| GET / POST | `/foods` | List (`?archived=false\|true\|all`, `?favorite=true\|false`; favorites first, then A–Z) / create |
| GET / PATCH / DELETE | `/foods/:id` | Single food. PATCH `{ archived: false }` restores an archived food. DELETE → **204** if no ride uses it; **200** `{ archived: true, food }` if a ride does (it's archived instead, so past rides still display) |
| GET / POST | `/rides` | List (`?from&to&status&limit`, newest first, limit 1–100, default 20) / create. **POST returns the ride with its fueling plan** (computed on the server by fuel-core). Missing profile data → 400 `PROFILE_INCOMPLETE` with the field to fill in (e.g. `profile.weightKg`) |
| GET / PATCH / DELETE | `/rides/:id` | Detail; PATCH logs intake/water/weigh-ins and marks complete. Changing `durationMin`, `intensity` (replaced whole), `tempC` or `foodIds` recalculates the plan; changing intake, water or duration recalculates `actual`. DELETE also deletes the ride's check-in |
| GET / POST | `/checkins` | List (`?rideId=&limit=`, newest ride first) / create (body includes `rideId`; one per ride, 409 `CHECKIN_EXISTS` if one already exists). Creating marks the ride `completed`. Response includes `suggestions`, computed from this ride plus up to 10 earlier check-ins (by ride date) |
| GET / PATCH / DELETE | `/checkins/:id` | Single check-in. PATCH changes answers/notes (not the ride) and recomputes `suggestions` against `trainedGphAtCheckIn`. Suggestions are never applied automatically: the app accepts one by PATCHing `/users/me` (`trainedCarbRateGph`, `sweatRateMlPerHr`) |
| GET / POST | `/events` | List (`?when=upcoming\|past\|all`, upcoming soonest first) / create. Every event comes back with `forecast` {projection, suggestedGoalGph, goalGph, gutTraining {daysUntil, weeks[], raceDayGph, reachable}, plan, notes}. On read, a forecast that can't be computed returns `forecast: null` + `forecastError` instead of failing |
| GET / PATCH / DELETE | `/events/:id` | Single event. Create/PATCH validate by computing the forecast, so invalid inputs are never saved. Errors about last time's effort point at `past.intensity.*` |
| GET | `/progress` | `{ current: {trainedGph}, carbRate: [{rideId, date, trainedGph, targetGph, actualGph, giScore}], energyBalance: [{rideId, date, name, kcalBurned, kcalEaten}] }`, oldest point first. `carbRate` has one point per check-in (`actualGph` null if nothing was logged); `energyBalance` one per ride with logged intake. Filters: `?from&to`, `?limit=` (most recent points per series, 1–365, default 100) |
| GET | `/health` | Liveness check for Docker and CI |

**Auth for web vs. mobile:** web clients get the tokens as httpOnly cookies (`ftr_access` on `/api`, SameSite=Lax; `ftr_refresh` on `/api/auth` only, SameSite=Strict). Clients that send `X-Client-Type: mobile` get the tokens in the JSON body instead, send `Authorization: Bearer <access>`, and pass `refreshToken` in the body to `/auth/refresh` and `/auth/logout`.

**Continue with Google:** the web app shows Google's official button (Google Identity Services, popup mode). It returns a signed ID token, which the API verifies with `google-auth-library`: Google's signature, issuer, expiry, and that our client ID is the audience. Then the API issues the same session as a password login. Google sign-in is on only when `GOOGLE_CLIENT_ID` is set; for the mobile apps, add their client IDs comma-separated. **Accounts are never merged automatically by email:** signup emails aren't verified, so auto-linking would let someone pre-register a victim's address with a password and keep access after the victim signs in with Google. A future "Connect Google" option in the profile (done while logged in) can link them safely.

Every resource query is scoped by `req.user.id`, so users can never read each other's data. Errors use one shape: `{ error: { code, message, details? } }`.

## 6. fuelCalculator.js (pure module)
```js
resolveIntensity({ durationMin, intensity, user })        // → { source, intensityFactor, level, confidence, kcalBurned, warnings }
estimateKcalBurned({ durationMin, intensity, user })      // → kcal
targetCarbRate({ durationMin, level, trainedGph })        // → { carbsGph, tableGph, cappedByTrained }
targetHydration({ durationMin, tempC, level, user })      // → { fluidMlPerHr, sodiumMgPerHr, sodiumOptional }
buildFuelPlan({ ride, user, foods, blockMin = 60 })       // → { intensity, targets, targetTotals, totals, kcalBurned,
                                                          //     schedule[], notes[], warnings[] }
                                                          //   schedule[i] = { hour, minutes, targets, items[], plainWaterMl,
                                                          //                   carbsG, fluidMl, sodiumMg, kcal, note, warnings }
summarizeIntake({ intake, plainWaterMl, foods, durationMin }) // → totals + per-hour rates
estimateSweatRate({ weightPreKg, weightPostKg, fluidMl, durationMin }) // → ml/hr | null
suggestAdjustments({ trainedGph, checkIn, history, lastIncreaseDate }) // → { carbRate, flags[], measuredSweatRateMlPerHr }
```
`suggestAdjustments` covers gut training: +5–10 g/hr after a few rides with good stomach scores, and −5–10 g/hr after bad ones. It also raises hydration flags: cramping or heavy legs while fluid/sodium was below target → "more sodium/fluid"; body weight lost > 2% → "more fluid". Low energy or a bonk with a good stomach score → "eat closer to target."
### 6.1 Intensity inputs (most accurate first)
The calculator uses the best input the user provides and reports which one it used (`source`) and how reliable the result is (`confidence`):
1. **Kilojoules (total work)** from a power meter or a past ride file. Calories burned ≈ kJ (people are about 20–25% efficient, which cancels out the kJ→kcal conversion). The most direct input. Average intensity = kJ ÷ duration ÷ FTP.
2. **Average power** (or normalized power) + FTP. kJ = watts × seconds ÷ 1000, then the same as option 1. Intensity is power ÷ FTP.
3. **Average heart rate:** HR as a % of LTHR is converted to IF. If FTP is known, calories come from IF × FTP. If not, they come from the Keytel equation (age, sex, weight). Good, but drifts with heat, fatigue and caffeine.
4. **Power zone** (Coggan 1–7) + FTP: uses the midpoint of the zone's watt range, then the same as option 2.
5. **Heart-rate zone** (1–5) + LTHR or max HR: uses the midpoint of the zone. Least accurate.

If several are given, the highest-ranked one sets the calories and the rest are kept for display. Intensity (% of FTP) also sets the carb target: harder efforts burn a larger share of carbs.

### 6.2 Fluid and sodium
**[FUELING_RULES.md](FUELING_RULES.md) is the source of truth for every number and rule.** In summary:
- **Fluid target:** 70% of the measured sweat rate, or a temperature-based default (400–900 ml/hr) adjusted for intensity. Clamped to 300–1,000 ml/hr.
- **Sodium target:** fluid (L/hr) × sweat sodium concentration (300 / 500 / 800 mg per litre). Clamped to 200–1,000 mg/hr, and optional on short, cool rides.
- **Sweat rate:** ((weight before − weight after) × 1,000 + fluid drunk) ÷ hours. 1 kg lost ≈ 1 litre of sweat.
- **Schedule:** each hour is filled with fluid first (drinks, then plain water), then carbs from food, then sodium from electrolytes. A warning is shown if a target can't be met.

These are general sports-nutrition ranges, not medical advice. The app says so in the UI.

Rules: no `Date.now()`, no randomness, no I/O. All inputs are explicit, and every output is plain JSON. Jest covers duration bands, the trained-rate cap, rounding to servings real people can eat (½ bar, not 0.37), fluid/sodium targets in heat, sweat-rate math, suggestion rules, an empty food library, and invalid input.

## 7. Where state lives
| State | Lives in | Local or shared |
|---|---|---|
| Session / current user | `AuthContext` (from `/auth/me`) | **Shared** app-wide |
| Foods, rides, check-ins, progress, profile | TanStack Query cache, keyed `['foods']`, `['rides', id]`, `['checkins', rideId]`, `['progress']` | **Shared** server cache; mutations invalidate keys (e.g. a new check-in invalidates `rides`, `checkins` + `progress`) |
| Plan inputs on PlanRidePage (duration, zone, chosen foods) | `useState` in PlanRidePage, passed down as props | **Local** |
| Computed plan preview | `buildFuelPlan(...)` recomputed on every render in PlanRidePage (pure, under 1 ms), with the profile mapped by fuel-core's `toCalculatorUser`, the same mapping the API uses when saving | **Local**, derived and never stored |
| Form drafts (FoodForm, CheckInForm) | `useState` in the form | **Local** |
| Intake, fluid and weigh-in logging on RideDetailPage | local state with an optimistic React Query mutation | Local, then synced to the server |
| UI prefs (units) | user profile (server), read through `useProfile` | Shared |
| Chart hover/tooltip | inside the chart component | Local |

No Redux. If unrelated components need to share client-only state later, add a small context.

## 8. Security
bcrypt hashing, helmet (CSP allows only our own origin plus Google Identity Services; COOP `same-origin-allow-popups` for Google's popup), CORS limited to the web origin, rate limiting on `/auth/*`, JWT secrets from env, a 15-minute access token and a 7-day rotating refresh token, zod-validated inputs, and Mongo queries built only from validated values (no operator injection).

## 9. Testing, DevOps and the mobile path
- **Jest:** `fuel-core` (exhaustive), `api` services and routes via supertest + mongodb-memory-server.
- **Vitest + React Testing Library (web):** same `describe/test/expect` API as Jest, but reuses Vite's config, so JSX needs no Babel setup. Tests render the whole app against a mocked API (`src/test/utils.jsx`) and act like a rider: type, tap, read what's on screen.
- **Local dev:** `npm run dev:api` + `npm run dev:web` (two terminals), then open http://localhost:5173. Vite proxies `/api` to the API, so cookies work as in production.
- **Postman:** collection plus environment in `apps/api/postman/`, run in CI with Newman against the docker-compose stack.
- **Docker:** a multi-stage `Dockerfile` (node:24-alpine, the current LTS) builds the web app, then runs the API serving `web/dist`. `docker-compose.yml` (local development) has `app` (port 4000) and `mongo` (named volume) with a healthcheck.
- **CI (GitHub Actions):** jobs **test** (fuel-core, API and web tests) and **e2e** (Docker image + MongoDB 8.2 + Postman/Newman + web app served). On pushes to `main`, a **deploy** job calls Render's **deploy hook** (secret `RENDER_DEPLOY_HOOK_URL`) only after both pass. It then polls `APP_URL/api/health` until it reports the new commit (`version`) with `db: up`. Render's own auto-deploy is off.
- **Production:** Render Docker web service from `render.yaml`, region **oregon**, health check `/api/health`. Environment: `NODE_ENV=production`, `MONGODB_URI` (Atlas M0, AWS us-west-2), `JWT_SECRET`/`JWT_REFRESH_SECRET` (generated by Render), `GOOGLE_CLIENT_ID` (optional). No CORS setting needed, since the app and API share one origin. Setup steps and operations: [DEPLOY.md](DEPLOY.md). Free-tier note: the service sleeps when idle, so the first request after a while is slow; Starter fixes this. Atlas free tier has no automated backups.
- **React Native later:** a new `apps/mobile` that imports `fuel-core` and `api/` client functions, uses Bearer tokens kept in secure storage, and calls the same `/api`. Before the mobile app ships, move to `/api/v1`, because installed mobile apps can't be force-updated when the API changes.

## 10. Decisions log
1. Product scope (§0) confirmed, with fluid and sodium tracking, a legs score and a cramping question added to the check-in, and the "Spread across the hour" reminder.
2. Intensity: kilojoules, power, heart rate, and power/HR zones (§6.1).
3. Hosting: Render + MongoDB Atlas (§9).
4. Client server-state: TanStack Query (§7).
5. API resources follow PRODUCT.md §7: `/api/foods`, `/api/rides` (create returns the plan), `/api/checkins`, `/api/progress`. There's no separate plan-preview endpoint: the web app (and later the mobile app) computes previews locally with fuel-core.

