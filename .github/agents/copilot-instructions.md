# Copilot Instructions for IP Geolocation Project

## Project Overview
This is a TypeScript-based Cloudflare Workers application that provides IP geolocation services combined with weather data. The app displays current location information, weather conditions, forecasts, and air quality data for visitors.

## Key Technologies
- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Build Tool**: Wrangler (Cloudflare's CLI)
- **APIs Used**: WAQI (air quality), NWS (weather), AirNow (air quality)

## Architecture
- **Entry Point**: `src/index.ts` - Main worker handler
- **Rendering**: `src/ssr.ts` - Server-side HTML rendering
- **Utilities**: `src/utils.ts` - Helper functions
- **Static Assets**: `public/` directory served via Cloudflare Workers Assets
- **Configuration**: `wrangler.toml` for worker configuration

## Development Workflow

### Building and Testing
```bash
# Build the project
npm run build

# Run locally for development
npm run dev

# Deploy to Cloudflare
npm run deploy

# Generate types
npm run generate-types
```

### Key Configuration Files
- `tsconfig.json` - TypeScript configuration with Cloudflare Workers types
- `wrangler.toml` - Cloudflare Workers configuration
- `worker-configuration.d.ts` - Generated type definitions from Wrangler

## Code Guidelines

### TypeScript Standards
- Use strict TypeScript settings (already configured)
- Export interfaces for all environment variables (`Env` interface)
- Maintain type safety with Cloudflare Workers runtime types
- Use JSDoc comments for functions and classes

### Cloudflare Workers Best Practices
- Keep the main `fetch` handler lightweight
- Use structured logging with performance metrics
- Implement proper error handling for external API calls
- Set appropriate security headers (CSP, X-Frame-Options, etc.)
- Use environment variables for API keys and sensitive data

### Code Organization
- **Handlers**: Keep request handling logic in `src/index.ts`
- **Rendering**: HTML generation and templating in `src/ssr.ts`
- **Utilities**: Reusable functions in `src/utils.ts`
- **Types**: Interface definitions should be properly exported

### External API Integration
The project integrates with several external APIs:
- **WAQI API**: Air quality data (requires `WAQI_TOKEN`)
- **NWS API**: Weather data (requires `NWS_AGENT` user agent)
- **AirNow API**: Air quality forecasts (requires `AIRNOW_KEY`)

When working with these APIs:
- Always handle network failures gracefully
- Implement timeout handling
- Log API response status for debugging
- Use appropriate user agents for NWS API compliance

### Security Considerations
- Never commit API keys or secrets to the repository
- Use Cloudflare Workers secrets for sensitive data
- Implement proper Content Security Policy headers
- Validate and sanitize all external API responses
- Enforce TLS 1.2+ for all requests

### Performance Guidelines
- Use performance.now() for timing measurements
- Log performance metrics for monitoring
- Optimize API calls (consider caching where appropriate)
- Keep response times under Cloudflare Workers limits

## Common Tasks

### Adding New API Integrations
1. Add required environment variables to `Env` interface
2. Implement error handling for API failures
3. Add performance logging
4. Update security headers if needed
5. Test with both successful and failed API responses

### Modifying HTML Output
- Edit rendering functions in `src/ssr.ts`
- Maintain existing styling patterns
- Ensure proper nonce usage for inline scripts
- Test responsive design changes

### Environment Variables
Set these secrets in Cloudflare Workers dashboard:
- `WAQI_TOKEN`: WAQI API token
- `NWS_AGENT`: User agent string for NWS API
- `AIRNOW_KEY`: AirNow API key
- `CLOUDFLARE_ACCOUNT_ID`: For deployment
- `CLOUDFLARE_API_TOKEN`: For deployment

## Deployment Notes
- Deployment is automated via GitHub Actions (`.github/workflows/deploy.yml`)
- Uses Wrangler for deployment to Cloudflare Workers
- Static assets are served via Cloudflare Workers Assets binding
- Environment variables must be configured in Cloudflare Workers dashboard

## Testing and Debugging
- Use `npm run dev` for local development with Wrangler
- Test with different IP addresses and locations
- Verify API integrations work with actual data
- Check CSP headers and security implementation
- Test error handling with API failures

## Code Style
- Use tabs for indentation (configured in `.editorconfig`)
- Follow Prettier configuration in `prettierrc.txt`
- Use single quotes and semicolons
- Line width of 140 characters
- Ensure trailing newlines in all files