# TrueLabel — F11 / F13 (Sprint 2)

This branch contains two separate community features, scoped to the TrueLabel SRS.

## F11 — Consumer reviews

- One review per signed-in consumer per product.
- Ratings for taste/quality, label accuracy, packaging condition and purchase experience (1–5 each).
- Overall rating is the rounded mean of the four categories.
- Readers see a credibility-weighted aggregate, computed from **visible** reviews on each request.
- Review authors can edit or delete their reviews. The DB unique constraint enforces one per food/user.
- Product manufacturers can reply to reviews of their own food products.
- `CredibilityCalculator` uses **1.0 + up to 0.2 for account age + 0.15 for verified batch + 0.15 for verified purchase** (maximum 1.5). **The verified evidence infrastructure does not exist yet**; the service always gives zero verified-evidence bonus, rather than trusting self-reported purchases or batches.
- F12 (review moderation, hiding/restoring with audit actions) belongs to a different Sprint 3 task. F11 already excludes `visibility = hidden` from public aggregates.

## F13 — Food complaints

- Consumers can report suspected counterfeit, spoiled, contaminated, damaged or mislabelled products.
- Reports include optional batch code, required purchase location and description.
- Each report gets a unique public-facing reference number.
- Staff queue shows counts of reports matching the same product and nonempty batch code.
- Optional JPEG/PNG/WebP photo evidence (maximum 3 MB) checks MIME and magic bytes.
- Evidence uses a **private** Supabase Storage bucket `report-evidence`; only the reporter and inspector/admin can get a short-lived signed link.
- The current inspector queue/status actions are preliminary; full investigation history is separately specified as F14 for Sprint 3.

## Local setup

1. Use Node.js 20, and check out `F11-F13-community-nusaiba` from your fork.
2. Run `npm ci`.
3. With no live DB credentials, use an isolated local test DB for basic tests: `npm test -- --runInBand`, `npm run build`, `npm run test:e2e`.
4. Copy `.env.example` to a local, ignored `.env` only when you are ready to run the application with a separate development database.
5. PostgreSQL schema sync defaults to **off**. Apply and review `database/migrations/2026-11-14-f11-f13.sql` and `database/migrations/2026-11-17-f11-f13-srs.sql` **in that order** on a throwaway database before attempting a shared DB migration.
6. For uploads only: configure a private Supabase Storage bucket named `report-evidence` and provide a **server-side** `SUPABASE_SERVICE_ROLE_KEY` in your untracked local `.env`. Never commit this secret or make the bucket public.
7. Use real registered consumer accounts for create requests; the demo-role switcher may create a synthetic session user ID that is not a database FK.

## Endpoints

- `GET /community/products/:productId/reviews` — public
- `POST /community/products/:productId/reviews` — consumer
- `POST /community/reviews/:reviewId/edit` — review author
- `POST /community/reviews/:reviewId/delete` — review author
- `POST /community/reviews/:reviewId/reply` — owner manufacturer/admin
- `GET /community/products/:productId/report` — consumer
- `POST /community/products/:productId/report` — consumer, multipart optional photo
- `GET /community/reports/mine` — consumer's own reports
- `GET /community/reports/queue` — inspector/admin
- `GET /community/reports/:reportId/evidence` — reporter or inspector/admin
- `POST /community/reports/:reportId/status` — inspector/admin (interim F14 functionality)

## Known blockers before merging

- **Tests and build not run through this GitHub connector.** Only source files/tests have been committed.
- **No PostgreSQL migrations or live Supabase writes have run.**
- **No private Storage bucket or service credentials have been configured.**
- The existing app lacks CSRF protection on session-based mutating forms. This must be addressed before a public deployment.
- The project's SRS has a required AI tool usage disclosure section. Document any assistance accurately and ensure you can personally explain and debug the code in the viva.
- IDs in existing TrueLabel models are integer keys, whereas the draft SRS diagrams use UUIDs. This feature follows the actual working application to avoid breaking other areas.
