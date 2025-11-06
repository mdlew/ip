# IP Geolocation 🌐 + Weather 🌦

![Deploy status](https://github.com/mdlew/ip/actions/workflows/deploy.yml/badge.svg)

IP geolocation, current conditions, forecasts, and browser info using Cloudflare workers, with API calls to publicly available services. [Check it out!](https://ip.matthewlew.info)

## Setup

### APIs

- [World Air Quality Index project](https://aqicn.org/json-api/doc/)
- [Weather.gov](https://www.weather.gov/documentation/services-web-api)
- [Air Now.gov](https://docs.airnowapi.org/webservices)

To deploy, set up the following secrets in your repository (Settings → Secrets and variables → Actions)

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `WAQI_TOKEN`: [https://aqicn.org/data-platform/token/](https://aqicn.org/data-platform/token/)
- `NWS_AGENT`: [Your app's user agent](https://www.weather.gov/documentation/services-web-api)
- `AIRNOW_KEY`: [https://docs.airnowapi.org/faq](https://docs.airnowapi.org/faq)

## Credits

Script adapted from:

- [Cloudflare examples](https://developers.cloudflare.com/workers/examples/)
- [NikSec ip check tool](https://niksec.com/creating-a-simple-ip-check-tool-with-cloudflare-workers/)
