# IP Geolocation 🌐 + Weather 🌦

![Deploy status](https://github.com/mdlew/ip/actions/workflows/deploy.yml/badge.svg)

Lightweight Cloudflare Worker that exposes IP geolocation, current conditions, forecasts, and simple browser info. Built with TypeScript and deployed as a Workers Module.

[Check it out!](https://ip.matthewlew.info)

## Table of contents

- Project overview
- Features
- Repository layout
- Local development
- Build
- Deploy to Cloudflare Workers
- Configuration & secrets
- License & credits

## Project overview

- Purpose: Provide an IP- and browser-based snapshot including geolocation, weather/air data, and other metadata via a Cloudflare Worker.
- Language: TypeScript
- Bundling: TypeScript -> `dist` (ES Modules)

## Features

- IP geolocation lookup
- Current weather and forecast via public APIs
- Air-quality integration (optional)
- Static asset handling via `public/`

## Repository layout

- `src/` — TypeScript source files (`index.ts`, `ssr.ts`, `utils.ts`)
- `public/` — static assets served by the Worker (images, `robots.txt`, etc.)
- `dist/` — build output (generated)
- `wrangler.toml` — Cloudflare Workers configuration
- `package.json` — scripts and dev dependencies
- `tsconfig.json` — TypeScript config

## Quick start — prerequisites

- Node.js (v16+ recommended)
- `pnpm` or `npm` (repo includes `pnpm-lock.yaml`, `pnpm` recommended)
- Cloudflare account
- Wrangler (installed as devDependency; can be run via `pnpm`/`npm` scripts)

### Install dependencies

```pwsh
pnpm install
```

### Build

- Compile TypeScript to `dist/`:

```pwsh
pnpm run build
```

### Deploy to Cloudflare Workers

This project uses `wrangler` and the configuration in `wrangler.toml`.

1. Authenticate with Cloudflare (one-time):

```pwsh
wrangler login
```

2. Verify `wrangler.toml` contains your `name`, `main`, and `compatibility_date`. Add/confirm `account_id` in an environment-specific config or set it with secrets (recommended).

3. Set required secrets. Two common approaches:

- GitHub Actions / CI: Add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to your repository secrets.
- Local / interactive: Use `wrangler secret put` for each secret. Example:

```pwsh
wrangler secret put MY_SECRET_NAME
```

4. Deploy:

```pwsh
pnpm run deploy
```

This runs `wrangler deploy` which uses `wrangler.toml` to publish the Worker.

## Config & environment variables

- Non-sensitive defaults can go into `wrangler.toml` under `[vars]`.
- Sensitive keys (API keys, tokens) should be stored as Wrangler secrets or CI repository secrets. Example variables used by this project:
	- `WAQI_TOKEN` — World Air Quality Index token (optional), [https://aqicn.org/data-platform/token/](https://aqicn.org/data-platform/token/)
	- `NWS_AGENT` — User agent string for Weather.gov API, [Your app's user agent](https://www.weather.gov/documentation/services-web-api)
	- `AIRNOW_KEY` — AirNow API key (optional), [https://docs.airnowapi.org/faq](https://docs.airnowapi.org/faq)
	- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account id (required for some workflows)
	- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Worker publish permissions

### Security notes

- Never commit secrets to the repository.
- Prefer short-lived API tokens and grant minimal permissions.

## CI / GitHub Actions

- If you want to add automatic deployments, configure a workflow that sets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as repository secrets and runs `pnpm run build` followed by `pnpm run deploy`.

## Troubleshooting

- If `wrangler deploy` fails, check that `account_id` is set in your environment or `wrangler.toml`, and that the API token has `Workers Scripts` permissions.
- For TypeScript issues, ensure `typescript` is installed and `tsc -p tsconfig.json` works locally.

## Credits & resources

- Cloudflare Workers docs: https://developers.cloudflare.com/workers/
- Wrangler CLI docs: https://developers.cloudflare.com/workers/cli-wrangler/
- [World Air Quality Index project](https://aqicn.org/json-api/doc/)
- [Weather.gov](https://www.weather.gov/documentation/services-web-api)
- [Air Now.gov](https://docs.airnowapi.org/webservices)

Script adapted from:

- [Cloudflare examples](https://developers.cloudflare.com/workers/examples/)
- [NikSec ip check tool](https://niksec.com/creating-a-simple-ip-check-tool-with-cloudflare-workers/)
