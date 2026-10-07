# AUTO3D

Website for sharing 3D-printable car parts. Search by **make / model / year** and get everything that
fits your car, plus universal parts that fit any car.

## Features

- Cascading Make → Model → Year search (remembers your last car in the browser)
- Results split into **Fits your car** and **Universal** parts; keyword + category filters
- User accounts (username/password, scrypt-hashed, DB-backed session cookie)
- Upload your own STL (≤ 50 MB) with in-browser 3D preview, or list a part that just **links to another site**
- Owners can delete their own parts

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

## Data model

`vehicles` rows are **generations** with an inclusive year range (e.g. Honda Civic · 10th gen · 2016–2021), so
a part is tagged once per generation instead of once per year. `fitments` links parts to vehicles; parts can
also be flagged `universal`. The vehicle list is seeded from `src/lib/vehicleSeed.ts` — extend it (or import
from the NHTSA vPIC API) to cover more cars.

## Notes

- Uploaded files are stored on local disk, so deploy somewhere with a persistent volume (or swap
  `src/lib/db.ts` / `uploadPath` for Postgres + S3-style storage).
- Licensing/attribution for parts linked or re-uploaded from other sites is the uploader's responsibility;
  each part has "original creator" and "link to original" fields.
