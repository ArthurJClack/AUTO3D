# AUTO3D

Website for sharing 3D-printable car parts. Search by **make / model / year** and get everything that
fits your car, plus universal parts that fit any car.

## Features

- Cascading Make → Model → Year search (remembers your last car in the browser)
- Results split into **Fits your car** and **Universal** parts; keyword + category filters
- User accounts (username/password, scrypt-hashed, DB-backed session cookie)
- Upload your own STL (≤ 50 MB) with in-browser 3D preview, or list a part that just **links to another site**
- Photo thumbnails (JPG/PNG/WebP ≤ 5 MB, checked by content, not filename)
- **My parts** page; owners can edit (fitment, files, photo) or delete their parts
- **Admin** area: review user reports, edit/delete any part, delete users, grant/revoke admin
- **Community fit confirmations:** logged-in users (not the author) mark each listed car "Fits my car" / "Doesn't fit";
  results are ranked by confirmations *for the searched car*, and cards show a ✓ badge
- Results are tiered: **Fits your car**, **Might fit** (same model, other generation — shown when you pick a year), **Universal**
- Material filter, sort (best match / newest / A–Z) and pagination
- Report button on parts you don't own; per-user upload (10/hour) and report limits
- Abuse throttling: 5 sign-ups/hour per IP, login lockout after 8 failed tries per username (20 per IP) for 15 min
- ~1,500 vehicle rows after importing from the NHTSA vPIC API (see below)

## Stack

Next.js (App Router, server actions) · TypeScript · SQLite via Node's built-in `node:sqlite` (Node ≥ 22.13) ·
three.js for the STL viewer. No external services needed.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Data lives in `./data` (`auto3d.db` + `uploads/`), created on first run and git-ignored.
Override with `DATA_DIR` / `DATABASE_PATH`.

## Tests

`npm test` runs the Node test runner over `test/` (NHTSA helpers, rate limiter, and the search/ranking/tier/pagination
queries against an in-memory database). No extra dependencies.

## Admins

The **first account created** on a fresh database is the admin. Promote others from the Admin page, or for a
database that already has users: `npm run make-admin -- <username>`.

## Vehicle data

`npm install && npm run dev` starts with ~60 hand-curated generations (named like "10th gen"). To add
every car/truck/SUV from ~37 makes (1990 → next model year) from the free NHTSA vPIC API:

```bash
npm run import:vehicles                  # all makes (~5 min)
npm run import:vehicles -- Honda Toyota  # just some makes
FROM_YEAR=2000 npm run import:vehicles
```

NHTSA has no generation data, so consecutive model years become one row labelled by its range
(e.g. "Civic 1990–2005"). Curated rows are never changed — for a curated model only the years it doesn't
cover are imported. Motorcycles, ATVs and commercial chassis are skipped. Safe to re-run. (Needs Node ≥ 22.18
to run the `.ts` scripts directly; behind a proxy set `NODE_USE_ENV_PROXY=1`.)

## Data model

`vehicles` rows are **generations** with an inclusive year range (e.g. Honda Civic · 10th gen · 2016–2021), so
a part is tagged once per generation instead of once per year. `fitments` links parts to vehicles; parts can
also be flagged `universal`. The curated vehicle list lives in `src/lib/vehicleSeed.ts`.

## Notes

- Uploaded files are stored on local disk, so deploy somewhere with a persistent volume (or swap
  `src/lib/db.ts` / `uploadPath` for Postgres + S3-style storage).
- Rate limits key on `x-real-ip` / `x-forwarded-for`, so they are only meaningful behind a proxy that sets those headers
  itself (Vercel, nginx, Cloudflare…); locally everyone shares one "local" bucket.
- Not built: password reset/email, comments, 3MF/STEP files.
- Licensing/attribution for parts linked or re-uploaded from other sites is the uploader's responsibility;
  each part has "original creator" and "link to original" fields.
