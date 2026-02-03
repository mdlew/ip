# Copilot Instructions for IP Geolocation Project

## Project Overview

This is a serverless IP geolocation service with real-time weather, air quality, forecasts, and alerts, built on Cloudflare Workers. The service automatically detects location using Cloudflare's edge network and provides comprehensive weather information from the National Weather Service (NWS) along with air quality data from WAQI and AirNow.

## Tech Stack

- **Runtime**: Cloudflare Workers (serverless edge computing)
- **Language**: TypeScript with strict type checking enabled
- **Build Tool**: Wrangler CLI (Cloudflare Workers CLI)
- **Package Manager**: pnpm
- **APIs**:
  - National Weather Service (NWS) for weather data
  - World Air Quality Index (WAQI) for air quality
  - AirNow for additional air quality data
  - MapLibre GL JS for interactive maps
  - Stadia Maps for map tiles

## Project Structure

```
/src/
  index.ts    # Main entry point and request router
  ssr.ts      # Server-side rendering logic
  utils.ts    # Utility functions and helpers
/public/      # Static assets (fonts, robots.txt)
```

## Code Style and Conventions

### TypeScript Configuration
- **Target**: ESNext
- **Module**: ESNext with Bundler module resolution
- **Strict mode**: Enabled (all strict type-checking options)
- **JSX**: react-jsx
- **Tab indentation**: Use tabs, not spaces (per .editorconfig and prettier config)
- **Line width**: 140 characters (per prettier config)
- **Quotes**: Single quotes
- **Semicolons**: Required

### Formatting
- Use tabs for indentation (except YAML files which use 2 spaces)
- End of line: LF
- Charset: UTF-8
- Trim trailing whitespace
- Insert final newline
- Single quotes for strings
- Semicolons at end of statements

### Documentation
- Use JSDoc comments for functions, interfaces, and complex logic
- Include `@param`, `@returns`, and `@module` tags where appropriate
- Use TypeScript interfaces for type definitions
- Add module-level documentation for file purpose

## Development Workflow

### Commands
- `pnpm install` - Install dependencies
- `pnpm dev` - Run development server locally (available at http://localhost:8787)
- `pnpm build` - Compile TypeScript to JavaScript
- `pnpm deploy` - Deploy to Cloudflare Workers

### Environment Variables and Secrets
The application requires three secrets configured in Wrangler:
- `WAQI_TOKEN` - Air quality API token from aqicn.org
- `NWS_AGENT` - User agent string for weather.gov API (format: "(AppName, email@example.com)")
- `AIRNOW_KEY` - AirNow API key for air quality data

For local development, create a `.dev.vars` file in the project root with these values.

## Security Practices

- **TLS**: Enforce TLS 1.2+ for all requests
- **CSP Headers**: Content Security Policy headers are configured
- **Secrets Management**: Never commit secrets; use Wrangler secrets or `.dev.vars` (which is gitignored)
- **API Keys**: All external API requests must use appropriate authentication
- **Input Validation**: Validate and sanitize all user inputs

## Architecture Guidelines

### Request Handling
The main entry point (`src/index.ts`) handles routing:
1. Static asset serving (favicon, fonts, robots.txt)
2. Radar image proxying with WebP transformation
3. IP geolocation page rendering with weather data

### Error Handling
- Return appropriate HTTP status codes (405 for method not allowed, etc.)
- Log errors with structured data using `console.log({ error: ... })`
- Provide user-friendly error messages in responses

### Performance
- Leverage Cloudflare's global edge network
- Use WebP image optimization for radar images
- Minimize external API calls where possible
- Cache responses appropriately

## External Services Integration

### National Weather Service (NWS)
- Base URL: `https://api.weather.gov`
- Requires custom User-Agent header (`NWS_AGENT` secret)
- Returns JSON responses with weather forecasts, conditions, and alerts
- [API Documentation](https://www.weather.gov/documentation/services-web-api)

### WAQI (World Air Quality Index)
- API token required (`WAQI_TOKEN` secret)
- Returns air quality index (AQI) data
- [API Documentation](https://aqicn.org/json-api/doc/)

### AirNow
- API key required (`AIRNOW_KEY` secret)
- Provides supplementary air quality data
- [API Documentation](https://docs.airnowapi.org/webservices)

## CI/CD

GitHub Actions workflows are configured in `.github/workflows/`:
- `deploy.yml` - Automated deployment to Cloudflare Workers
- `dependabot-auto-merge.yml` - Auto-merge Dependabot updates

Deployment requires these GitHub secrets:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `WAQI_TOKEN`
- `NWS_AGENT`
- `AIRNOW_KEY`

## Common Tasks

### Adding New Features
1. Implement in appropriate file (`index.ts`, `ssr.ts`, or `utils.ts`)
2. Add TypeScript types and interfaces
3. Add JSDoc documentation
4. Test locally with `pnpm dev`
5. Build with `pnpm build` to check for type errors
6. Deploy with `pnpm deploy` after testing

### Modifying API Integrations
- Update type definitions in interfaces
- Ensure error handling for API failures
- Respect rate limits and API terms of service
- Log API responses for debugging (remove sensitive data)

### Updating Dependencies
- Use `pnpm` for package management
- Test thoroughly after updates, especially Cloudflare Workers types
- Dependabot is configured for automated updates

## Important Notes

- This is a serverless application; state cannot be stored between requests
- All code runs on Cloudflare's edge network
- The worker must handle requests from any global location
- Responses should be fast and efficient (edge computing principles)
- Assets are served through the ASSETS binding configured in wrangler.toml
