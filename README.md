# NiubiGEO on Railway

NiubiGEO — open-source AI brand visibility and competitor reports. Deploy on Railway with one click.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/fa9HRB)

This repository packages the official [NiubiGEO](https://github.com/Albert-Weasker/niubigeo) image (`ghcr.io/albert-weasker/niubigeo:v0.3.3`, Apache-2.0) for Railway. It is an independent community packaging, not affiliated with or endorsed by the NiubiGEO project.

## What you get

- One service built from `ghcr.io/onepush-dev/niubigeo:0.3.3` (upstream image, unmodified app code).
- **Password protection.** The NiubiGEO workbench has no built-in login, so Caddy sits in front of it with a login page (cookie session). User `admin`, password = the generated `NIUBIGEO_PASSWORD` variable (Railway service → Variables). The app itself only listens on `127.0.0.1`.
- **Scheduled monitoring worker** (upstream compose profile `monitoring`) runs in the same container, because Railway volumes can't be shared between services. Disable with `NIUBIGEO_WORKER_ENABLED=false`.
- **Persistent data** on a Railway volume at `/app/data` (projects, baselines, runs, evidence, schedules in `/app/data/product-v2`).

## Using it

1. Deploy, open the public domain, sign in on the login page as `admin` with `NIUBIGEO_PASSWORD`.
2. Connect a model provider: either click a platform logo in the workbench (browser keys are temporary and not used by the worker), **or** add `OPENROUTER_API_KEY` (or `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY`, `DEEPSEEK_API_KEY`) as a Railway variable so reports and scheduled runs work server-side.
3. Create a project with your domain, confirm competitors and keywords, run tests, schedule repeats.

Model API calls are billed by your provider. Due scheduled runs incur API charges.

## Variables

| Variable | Default | Purpose |
|---|---|---|
| `NIUBIGEO_PASSWORD` | generated | Login password for the workbench |
| `NIUBIGEO_USERNAME` | `admin` | Login user name (image default) |
| `NIUBIGEO_WORKER_ENABLED` | `true` | Run the schedule worker in the same container |
| `NIUBIGEO_WORKER_INTERVAL` | `60` | Worker poll interval (seconds) |
| `NIUBIGEO_VIDEO_ADVISOR_ENABLED` | `true` | Show upstream's external advisor link card |
| `OPENROUTER_API_KEY` | – | Optional server-side model key |

## Notes

- Back up the volume before upgrading. To upgrade, bump the base image tag/digest in the `Dockerfile`; GitHub Actions rebuilds `ghcr.io/onepush-dev/niubigeo`.
- `/health` is the only unauthenticated path (Railway healthcheck).
