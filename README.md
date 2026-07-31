# TanStack Start × Strapi LaunchPad

A [TanStack Start](https://tanstack.com/start) port of the frontend from [Strapi's LaunchPad demo](https://github.com/strapi/LaunchPad).

This repo contains **only the frontend**. `yarn setup` fetches the LaunchPad Strapi backend for you, so there is no second CMS to maintain here and no backend source in this repository.

## Requirements

- **Node.js** 20.19 or newer
- **Yarn** — `corepack enable`, or `npm i -g yarn`
- **git** — used to fetch the backend

No database to install: the backend runs on SQLite by default.

## Setup

Four commands from a clean clone to a running site. Expect about two minutes, most of it dependency installation.

### 1. Clone and install the orchestration scripts

```sh
git clone https://github.com/PaulBratslavsky/tanstack-launchpad-strapi-port.git
cd tanstack-launchpad-strapi-port
yarn install
```

This installs only the handful of packages the root scripts need. The client and backend get their own dependencies in the next step.

### 2. Provision everything

```sh
yarn setup
```

In order, this:

1. **Fetches the backend** into `./strapi` — a sparse checkout of only LaunchPad's `strapi/` directory at the commit pinned in `launchpad.json`, with the clone's `.git` removed. Roughly 30MB, most of it the seed archive. Skipped if `./strapi` already exists.
2. **Installs dependencies** in `client/` and `strapi/`.
3. **Creates `client/.env` and `strapi/.env`** from their `.env.example` files, generating a fresh secret for every `tobemodified` placeholder, and writing one shared `PREVIEW_SECRET` into both.
4. **Verifies the result** — if anything is missing or inconsistent, it says which file and which key rather than letting it fail later at runtime.

Existing `.env` files are never overwritten, so `yarn setup` is safe to re-run.

### 3. Load the demo content

```sh
yarn seed
```

See [Seeding data](#seeding-data) below for what this imports and when to re-run it.

### 4. Start it

```sh
yarn dev
```

Strapi starts on `:1337`, then the client on `:3000` once Strapi answers. Stopping one stops the other.

### 5. Create your admin user

The seed contains content but no admin account. Open **http://localhost:1337/admin** and fill in the registration form shown on first run — it's yours alone, stored locally in SQLite.

Then open **http://localhost:3000**.

## Seeding data

`yarn seed` imports LaunchPad's demo content into the backend's SQLite database using Strapi's native import, from the archive that ships inside the fetched backend (`strapi/data/export_*.tar.gz`).

What lands in your database:

|                                         | English | French |
| --------------------------------------- | ------- | ------ |
| Pages (homepage, pricing, contact, faq) | 4       | 4      |
| Articles                                | 2       | 3      |
| Products                                | 5       | 5      |

Plus the `global` single type (navbar, footer, default SEO), all the dynamic-zone content those pages reference, and 72 media assets (50 PNG, 15 WebP, 7 SVG). The import reports 1166 rows and 23.4MB in total, counting entities, assets, relations and configuration.

**`yarn seed` is destructive.** Strapi's import wipes existing data before writing. That's what makes it useful as a reset, and what makes it dangerous once you've authored something you care about.

| You want to                  | Do this                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Reset to the pristine demo   | `yarn seed` again                                                                |
| Start from an empty database | `rm strapi/.tmp/data.db` and restart                                             |
| Keep your own content        | don't re-run `yarn seed`; export your own with `cd strapi && yarn strapi export` |

Your admin account lives in the same database, so re-seeding signs you out and you'll register again at `/admin`.

Seed with `yarn dev` stopped. The import rewrites the SQLite file directly, and a running Strapi holding it open is asking for trouble.

## How the backend gets here

`yarn setup` sparse-checks-out **only** the `strapi/` directory of the LaunchPad repo, at the commit pinned in [`launchpad.json`](./launchpad.json), then deletes the clone's `.git`.

```
git clone --filter=blob:none --sparse  https://github.com/strapi/LaunchPad.git
git sparse-checkout set strapi
git checkout <pinned commit>
mv strapi ./strapi   &&   rm -rf <clone>        # no .git survives
```

The result is `./strapi` as **plain files** — gitignored, with the same status as `node_modules`. It is not a submodule, not a nested repository, and never appears in `git status`. Delete it and re-run setup any time.

Sparse checkout means LaunchPad's own Next.js frontend is never downloaded.

| Task                        | Command                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| Update to a newer backend   | edit `commit` in `launchpad.json`, then `yarn setup:backend --force` |
| Re-provision from scratch   | `rm -rf strapi && yarn setup && yarn seed`                           |
| Check which commit you have | `cat strapi/.launchpad-commit`                                       |

`--force` deletes `./strapi` entirely, database included, so re-seed afterwards.

## Layout

```
launchpad.json     which LaunchPad backend to provision (pinned commit)
scripts/           setup, fetch, seed, dev, env checks
client/            the TanStack Start app  ← the actual source of this repo
strapi/            fetched by `yarn setup` — gitignored, never committed
```

## Scripts

| Command                                         | What it does                                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn setup`                                    | Fetch the backend, install both projects, create and reconcile `.env` files. Re-runnable.                                                    |
| `yarn setup:backend [--force]`                  | Just the backend fetch. `--force` deletes and re-fetches at the pinned commit.                                                               |
| `yarn seed`                                     | Import LaunchPad's demo content. **Destructive** — wipes existing Strapi data. Run with `yarn dev` stopped.                                  |
| `yarn dev`                                      | Strapi first, then the client once Strapi answers. Ports come from the `.env` files (default :1337 and :3000). Stopping one stops the other. |
| `yarn check:env`                                | Verify both `.env` files are complete and their shared secrets agree. Also runs automatically before `yarn dev`.                             |
| `yarn build` / `yarn lint` / `yarn typecheck`   | Run against `client/`.                                                                                                                       |
| `yarn client <script>` / `yarn strapi <script>` | Run any script in that project directly.                                                                                                     |

## Environment

`yarn setup` writes `client/.env` and `strapi/.env` from their `.env.example` files, generating a fresh secret for every `tobemodified` placeholder. Existing `.env` files are never overwritten.

Most values belong to one app, but a few are a **contract between the two**:

| Variable            | Where  | Why it matters                                                                                                                                                                                                                |
| ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PREVIEW_SECRET`    | both   | Strapi signs preview URLs with it; the client validates them. If these drift, preview mode fails with a bare `401 Invalid token`. Setup generates it once and writes it to both files, then re-checks agreement on every run. |
| `VITE_STRAPI_URL`   | client | Where the client reaches Strapi.                                                                                                                                                                                              |
| `CLIENT_URL`        | strapi | Where Strapi points the admin preview iframe.                                                                                                                                                                                 |
| `SESSION_SECRET`    | client | Signs the auth session cookie. Must be 32+ characters.                                                                                                                                                                        |
| `REVALIDATE_SECRET` | client | Bearer token Strapi sends to `POST /api/revalidate`.                                                                                                                                                                          |

`yarn check:env` reports drift by name rather than letting it surface as a runtime error, and `yarn dev` runs it before starting anything.

### Running alongside another LaunchPad instance

Ports are read from the `.env` files, so nothing needs editing in the scripts. To run this stack next to the original LaunchPad on its default 1337/3000:

```sh
# strapi/.env
PORT=1340
CLIENT_URL=http://localhost:3040

# client/.env
PORT=3040
WEBSITE_URL=http://localhost:3040
VITE_STRAPI_URL=http://localhost:1340
```

`yarn dev` picks both up, waits on the right Strapi health endpoint, and `yarn check:env` verifies `CLIENT_URL` still matches the client's port.

## Troubleshooting

**The Strapi admin spins forever instead of showing the login form.** Almost always a stale admin JWT in your browser for `localhost:1337`, left by a different Strapi instance on the same port. The admin retries `users/me` → `access-token` → `logout`, all 401, and loops. It works in an incognito window, which confirms it. Fix: DevTools → Application → **Clear site data**, or run `localStorage.clear(); sessionStorage.clear(); location.reload()` in the console.

**Preview from the Strapi admin says `Invalid token`.** `PREVIEW_SECRET` differs between `strapi/.env` and `client/.env`. Run `yarn check:env` — it names the mismatch — then `yarn setup` to sync them, and restart both servers. `.env` changes are not hot-reloaded.

**`yarn dev` refuses to start.** It runs `yarn check:env` first and won't start with an inconsistent environment. The output lists each problem by file and key.

**`yarn seed` fails with "Seed archive not found".** The backend either isn't fetched or was fetched at a commit where the archive moved. Check `seedArchive` in `launchpad.json` against `ls strapi/data/`.

**Images 404 in the browser.** Check `VITE_STRAPI_URL` in `client/.env` actually points at your running Strapi, including the port. The client resolves relative `/uploads/...` paths against it.

**Port already in use.** See [Running alongside another LaunchPad instance](#running-alongside-another-launchpad-instance).

## Features

- Multilingual routes (`en`, `fr`) under `/$locale`, with Accept-Language negotiation in request middleware
- Strapi dynamic zones — hero, features, testimonials, pricing, FAQ, CTA, and more
- Blog, products, and CMS-driven pages
- Draft-mode preview with Strapi's click-to-edit overlay
- Editor-managed redirects, read from Strapi's `redirections` collection
- Sign-up / sign-in with an encrypted HttpOnly session cookie
- Static prerendering at build time, with SSR fallback and a revalidation webhook

## Prerendering and revalidation

`client/vite.config.ts` queries Strapi at build time for every `pages`, `articles`, and `products` slug and prerenders those paths across both locales. If Strapi is unreachable the build still succeeds — those routes fall through to SSR.

`POST /api/revalidate` deletes the prerendered HTML for whatever Strapi reports as changed, so the next request re-renders from live content. Point a Strapi webhook at it with an `Authorization: Bearer <REVALIDATE_SECRET>` header.

## Differences from the Next.js LaunchPad frontend

| Concern             | LaunchPad `next/`                 | This client                                    |
| ------------------- | --------------------------------- | ---------------------------------------------- |
| Images              | `next/image` optimization         | plain `<img>`, no resizing                     |
| Server-side caching | `'use cache'` + tags, 15 min      | none; build-time prerender + `/api/revalidate` |
| Strapi redirects    | built once by `next.config.mjs`   | fetched per request, cached 60s                |
| Fonts               | self-hosted via `next/font`       | Google Fonts stylesheet                        |
| Auth                | static sign-up form, not wired up | working sign-in / sign-up / logout             |
| Page transitions    | `next-view-transitions`           | none                                           |

Set `IS_DEMO=true` to show the hosted-demo banner.

## Notes

`yarn lint` passes but reports warnings, mostly `no-unnecessary-condition` on defensive checks against CMS data that TypeScript types as always present. Those guards are deliberate — see `client/eslint.config.mjs`.

## License

MIT
