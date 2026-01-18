# IP Geolocation 🌐 + Weather 🌦

![Deploy status](https://github.com/mdlew/ip/actions/workflows/deploy.yml/badge.svg)

A serverless IP geolocation service with real-time weather, air quality, forecasts, and alerts — built on Cloudflare Workers. [**Check it out!**](https://ip.matthewlew.info)

## Features

- 🌍 **IP Geolocation** - Automatic location detection using Cloudflare's edge network
- 🌤️ **Weather Data** - Current conditions and forecasts from National Weather Service (NWS)
- 💨 **Air Quality** - Real-time AQI data from World Air Quality Index and AirNow
- 🚨 **Weather Alerts** - Active weather warnings and advisories
- 🗺️ **Interactive Map** - Location visualization with MapLibre GL JS
- 📡 **Radar Images** - Weather radar with WebP optimization
- 🔒 **Security First** - CSP headers, TLS 1.2+, and modern security practices
- ⚡ **Edge Performance** - Global deployment via Cloudflare Workers

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Build**: Wrangler CLI
- **APIs**: National Weather Service, WAQI, AirNow
- **Map**: MapLibre GL JS with Stadia Maps

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [pnpm](https://pnpm.io/) package manager
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mdlew/ip.git
   cd ip
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure API tokens (see [API Setup](#api-setup) below)

### Development

Run the development server locally:

```bash
pnpm dev
```

The worker will be available at `http://localhost:8787`

### Build

Compile TypeScript to JavaScript:

```bash
pnpm build
```

### Deployment

Deploy to Cloudflare Workers:

```bash
pnpm deploy
```

For automated deployment via GitHub Actions, see [CI/CD Setup](#cicd-setup).

## Configuration

### API Setup

This project requires API keys from the following services:

1. **WAQI Token** (Air Quality)
   - Get your token: [https://aqicn.org/data-platform/token/](https://aqicn.org/data-platform/token/)
   - [API Documentation](https://aqicn.org/json-api/doc/)

2. **NWS User Agent** (Weather)
   - Format: `(YourAppName, your@email.com)`
   - [API Documentation](https://www.weather.gov/documentation/services-web-api)

3. **AirNow API Key** (Air Quality)
   - Request access: [https://docs.airnowapi.org/faq](https://docs.airnowapi.org/faq)
   - [API Documentation](https://docs.airnowapi.org/webservices)

### Local Development Setup

Create a `.dev.vars` file in the project root:

```ini
WAQI_TOKEN=your_waqi_token_here
NWS_AGENT=(YourApp, your@email.com)
AIRNOW_KEY=your_airnow_key_here
```

### Production Setup (Cloudflare)

Set secrets using Wrangler:

```bash
wrangler secret put WAQI_TOKEN
wrangler secret put NWS_AGENT
wrangler secret put AIRNOW_KEY
```

### CI/CD Setup

For automated deployment via GitHub Actions, add these secrets to your repository (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` - API token with Workers edit permissions
- `WAQI_TOKEN` - Air quality API token
- `NWS_AGENT` - Weather.gov user agent string
- `AIRNOW_KEY` - AirNow API key

## Project Structure

```
ip/
├── src/
│   ├── index.ts    # Main entry point and request router
│   ├── ssr.ts      # Server-side rendering logic
│   └── utils.ts    # Utility functions and helpers
├── public/         # Static assets (fonts, robots.txt)
├── wrangler.toml   # Cloudflare Workers configuration
├── package.json    # Dependencies and scripts
└── tsconfig.json   # TypeScript configuration
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is open source and available under the [MIT License](LICENSE).

## Credits

Built by [Matthew Lew](https://github.com/mdlew)

Adapted from:
- [Cloudflare Workers Examples](https://developers.cloudflare.com/workers/examples/)
- [NikSec IP Check Tool](https://niksec.com/creating-a-simple-ip-check-tool-with-cloudflare-workers/)

## Acknowledgments

- Weather data provided by [National Weather Service](https://www.weather.gov/)
- Air quality data from [WAQI](https://aqicn.org/) and [AirNow](https://www.airnow.gov/)
- Maps powered by [MapLibre GL JS](https://maplibre.org/) and [Stadia Maps](https://stadiamaps.com/)
