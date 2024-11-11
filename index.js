/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { getAssetFromKV, NotFoundError, MethodNotAllowedError } from '@cloudflare/kv-asset-handler'
import manifestJSON from '__STATIC_CONTENT_MANIFEST'
const assetManifest = JSON.parse(manifestJSON)

const grads = [
  [
    { color: "00000c", position: 0 },
    { color: "00000c", position: 0 },
  ],
  [
    { color: "020111", position: 85 },
    { color: "191621", position: 100 },
  ],
  [
    { color: "020111", position: 60 },
    { color: "20202c", position: 100 },
  ],
  [
    { color: "020111", position: 10 },
    { color: "3a3a52", position: 100 },
  ],
  [
    { color: "20202c", position: 0 },
    { color: "515175", position: 100 },
  ],
  [
    { color: "40405c", position: 0 },
    { color: "6f71aa", position: 80 },
    { color: "8a76ab", position: 100 },
  ],
  [
    { color: "4a4969", position: 0 },
    { color: "7072ab", position: 50 },
    { color: "cd82a0", position: 100 },
  ],
  [
    { color: "757abf", position: 0 },
    { color: "8583be", position: 60 },
    { color: "eab0d1", position: 100 },
  ],
  [
    { color: "82addb", position: 0 },
    { color: "ebb2b1", position: 100 },
  ],
  [
    { color: "94c5f8", position: 1 },
    { color: "a6e6ff", position: 70 },
    { color: "b1b5ea", position: 100 },
  ],
  [
    { color: "b7eaff", position: 0 },
    { color: "94dfff", position: 100 },
  ],
  [
    { color: "9be2fe", position: 0 },
    { color: "67d1fb", position: 100 },
  ],
  [
    { color: "90dffe", position: 0 },
    { color: "38a3d1", position: 100 },
  ],
  [
    { color: "57c1eb", position: 0 },
    { color: "246fa8", position: 100 },
  ],
  [
    { color: "2d91c2", position: 0 },
    { color: "1e528e", position: 100 },
  ],
  [
    { color: "2473ab", position: 0 },
    { color: "1e528e", position: 70 },
    { color: "5b7983", position: 100 },
  ],
  [
    { color: "1e528e", position: 0 },
    { color: "265889", position: 50 },
    { color: "9da671", position: 100 },
  ],
  [
    { color: "1e528e", position: 0 },
    { color: "728a7c", position: 50 },
    { color: "e9ce5d", position: 100 },
  ],
  [
    { color: "154277", position: 0 },
    { color: "576e71", position: 30 },
    { color: "e1c45e", position: 70 },
    { color: "b26339", position: 100 },
  ],
  [
    { color: "163C52", position: 0 },
    { color: "4F4F47", position: 30 },
    { color: "C5752D", position: 60 },
    { color: "B7490F", position: 80 },
    { color: "2F1107", position: 100 },
  ],
  [
    { color: "071B26", position: 0 },
    { color: "071B26", position: 30 },
    { color: "8A3B12", position: 80 },
    { color: "240E03", position: 100 },
  ],
  [
    { color: "010A10", position: 30 },
    { color: "59230B", position: 80 },
    { color: "2F1107", position: 100 },
  ],
  [
    { color: "090401", position: 50 },
    { color: "4B1D06", position: 100 },
  ],
  [
    { color: "00000c", position: 80 },
    { color: "150800", position: 100 },
  ],
];
const heatIndexHumidity = [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
const heatIndexTemp = [80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 110];
const heatIndexTab = [
  [80, 81, 83, 85, 88, 91, 94, 97, 101, 105, 109, 114, 119, 124, 130, 136],
  [80, 82, 84, 87, 89, 93, 96, 100, 104, 109, 114, 119, 124, 130, 137, 999],
  [80, 83, 85, 88, 91, 95, 99, 103, 108, 113, 118, 124, 131, 137, 999, 999],
  [81, 84, 86, 89, 93, 97, 101, 106, 112, 117, 124, 130, 137, 999, 999, 999],
  [82, 84, 88, 91, 95, 100, 105, 110, 116, 123, 129, 137, 999, 999, 999, 999],
  [82, 85, 89, 93, 98, 103, 108, 114, 121, 128, 136, 999, 999, 999, 999, 999],
  [83, 86, 90, 95, 100, 105, 112, 119, 126, 134, 999, 999, 999, 999, 999, 999],
  [84, 88, 92, 97, 103, 109, 116, 124, 132, 999, 999, 999, 999, 999, 999, 999],
  [84, 89, 94, 100, 106, 113, 121, 129, 999, 999, 999, 999, 999, 999, 999, 999],
  [85, 90, 96, 102, 110, 117, 126, 135, 999, 999, 999, 999, 999, 999, 999, 999],
  [86, 91, 98, 105, 113, 122, 131, 999, 999, 999, 999, 999, 999, 999, 999, 999],
  [86, 93, 100, 108, 117, 127, 999, 999, 999, 999, 999, 999, 999, 999, 999, 999],
  [87, 95, 103, 112, 121, 132, 999, 999, 999, 999, 999, 999, 999, 999, 999, 999],
];
async function toCSSGradient(hour) {
  let css = "linear-gradient(to bottom,";
  const data = grads[hour];
  const len = data.length;
  for (let i = 0; i < len; i++) {
    const item = data[i];
    css += ` #${item.color} ${item.position}%`;
    if (i < len - 1) css += ",";
  }
  return css + ")";
}
const nf = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});


export default {
  async fetch(request, env, ctx) {
    // Return a new Response based on a URL's pathname
    const FAVICON_URL = ["/favicon.ico", "/favicon.svg"];
    const url = new URL(request.url);

    // return static favicon asset
    if (FAVICON_URL.includes(url.pathname)) {
      async function MethodNotAllowed(request) {
        return new Response(`Method ${request.method} not allowed.`, {
          status: 405,
          headers: {
            Allow: "GET",
          },
        });
      }
      // Only GET requests work with this proxy.
      if (request.method !== "GET") return MethodNotAllowed(request);
      try {
        return await getAssetFromKV(
          {
            request,
            waitUntil(promise) {
              return ctx.waitUntil(promise)
            },
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: assetManifest,
          },
        )
      } catch (e) {
        const pathname = url.pathname;
        return new Response(`"${pathname}" not found`, {
          status: 404,
          statusText: "not found",
        });
      }
    }

    // else do IP geolocation
    else {
      // set default security headers
      const myHeaders = new Headers({
        "content-type": "text/html;charset=UTF-8",
        /*
      Secure your application with Content-Security-Policy headers.
      Enabling these headers will permit content from a trusted domain and all its subdomains.
      @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy
      "Content-Security-Policy": "default-src 'self' example.com *.example.com",
      */
        /*
      You can also set Strict-Transport-Security headers.
      These are not automatically set because your website might get added to Chrome's HSTS preload list.
      Here's the code if you want to apply it:
      "Strict-Transport-Security" : "max-age=63072000; includeSubDomains; preload",
      */
        /*
      Permissions-Policy header provides the ability to allow or deny the use of browser features, such as opting out of FLoC - which you can use below:
      "Permissions-Policy": "interest-cohort=()",
      */
        /*
      X-XSS-Protection header prevents a page from loading if an XSS attack is detected.
      @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection
      */
        "X-XSS-Protection": "0",
        /*
      X-Frame-Options header prevents click-jacking attacks.
      @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options
      */
        "X-Frame-Options": "DENY",
        /*
      X-Content-Type-Options header prevents MIME-sniffing.
      @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options
      */
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Cross-Origin-Embedder-Policy": 'require-corp; report-to="default";',
        "Cross-Origin-Opener-Policy": 'same-site; report-to="default";',
        "Cross-Origin-Resource-Policy": "same-site",
      });

      const clientUA = request.headers.get('User-Agent');
      const clientIP = request.headers.get('CF-Connecting-IP');
      const clientASN = request.cf.asn;
      const clientISP = request.cf.asOrganization;
      const latitude = request.cf.latitude;
      const longitude = request.cf.longitude;
      const tlsVersion = request.cf.tlsVersion;

      let html_style = `
          /* html{width:100vw; height:100vh;} */
          body{padding:2em; font-family:'Source Sans 3','Source Sans Pro',sans-serif; color:white; margin:0 !important; height:100%; font-size:clamp(1rem, 0.96rem + 0.18vw, 1.125rem);}
          #container {
            display: flex;
            flex-direction:column;
            /* align-items: center; */
            /* justify-content: center; */
            min-height: 100%;
          }`;

      const timezone = request.cf.timezone;
      const localized_date = new Date(
        new Date().toLocaleString("en-US", { timeZone: timezone })
      );
      const hour = localized_date.getHours();

      html_style += "body{background:" + (await toCSSGradient(hour)) + ";}";
      html_style += "h1{color:#f6821f;}";
      html_style += "p{margin: 0.3em;}";
      html_style += "a{color: #f6821f;}";
      html_style += "a:hover{color: white;}";

      let html_content = "<h1>IP Geolocation 🌐</h1>";

      html_content += `<p> Public IP: ` + clientIP + ` (<a href="https://radar.cloudflare.com/ip/${clientIP}">Cloudflare Radar info</a>)</p>`;
      html_content += `<p> ISP: ` + clientISP + `, ASN: ` + clientASN + ` (<a href="https://radar.cloudflare.com/quality/as${clientASN}">Cloudflare Radar info</a>)</p>`;
      html_content += `<iframe loading="lazy" title="OpenStreetMap widget" width="425" height="350" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://www.openstreetmap.org/export/embed.html?bbox=` + (parseFloat(longitude) - 0.35) + `%2C` + (parseFloat(latitude) - 0.35) + `%2C` + (parseFloat(longitude) + 0.35) + `%2C` + (parseFloat(latitude) + 0.35) + `&amp;layer=mapnik&amp;marker=` + latitude + `%2C` + longitude + `" style="border: 1px solid black; max-width: 100%;"></iframe>`;
      html_content += `<p> (Latitude, Longitude): <a href="https://www.openstreetmap.org/?mlat=` + latitude + `&amp;mlon=` + longitude + `#map=9/` + latitude + `/` + longitude + `">(` + latitude + `, ` + longitude + `)</a></p>`;
      html_content += "<p> City: " + request.cf.city + ", MetroCode: " + request.cf.metroCode + "</p>";
      html_content += "<p> Region: " + request.cf.region + ", RegionCode: " + request.cf.regionCode + ", PostalCode: " + request.cf.postalCode + "</p>";
      html_content += "<p> Country: " + request.cf.country + ",  Continent: " + request.cf.continent + "</p>";
      html_content += "<p> Timezone: " + request.cf.timezone + "</p>";
      html_content += `<p> Cloudflare datacenter <a href="https://en.wikipedia.org/wiki/IATA_airport_code">IATA code</a>: ` + request.cf.colo + `</p>`;

      html_content += "<h1>Weather 🌦</h1>";
      try {
        // WAQI API setup
        const token = env.waqiToken; // Use a token from https://aqicn.org/api/
        const waqiApiRequestUrl = `https://api.waqi.info/feed/geo:${latitude};${longitude}/?token=${token}`;
        const waqiRequestInit = {
          headers: {
            "content-type": "application/json;charset=UTF-8",
          },
        };
        // https://www.weather.gov/documentation/services-web-api API setup
        const agent = env.nwsAgent; // ID to send to weather.gov API
        const nwsApiPointsRequestUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
        const nwsRequestInit = {
          headers: {
            "accept": "application/geo+json",
            "User-Agent": agent,
          },
        };

        // issue concurrent requests to WAQI and NWS APIs
        const [waqiResponse, nwsPointsResponse] = await Promise.all([
          fetch(waqiApiRequestUrl, waqiRequestInit),
          fetch(nwsApiPointsRequestUrl, nwsRequestInit),
        ]);
        const [waqiContent, nwsPointsContent] = await Promise.all([
          waqiResponse.json(),
          nwsPointsResponse.json(),
        ]);
        let nwsForecastResponse = null;
        let nwsForecastContent = null;
        if ("properties" in nwsPointsContent) {
          nwsForecastResponse = await fetch(nwsPointsContent.properties.forecast, nwsRequestInit);
          nwsForecastContent = await nwsForecastResponse.json();
        }

        const tempF = parseFloat(waqiContent.data.iaqi.t?.v) * 9 / 5 + 32; //deg C to deg F
        const humidity = waqiContent.data.iaqi.h?.v;
        const windSpeed = parseFloat(waqiContent.data.iaqi.w?.v) * 2.23694; // m/s to mph

        // compute heat index if it's warm enough
        let heatIndex = 0.5 * (tempF + 61.0 + ((tempF - 68.0) * 1.2) + (humidity * 0.094));
        if ((tempF + heatIndex) / 2 > 80) {
          heatIndex = -42.379 + 2.04901523 * tempF + 10.14333127 * humidity - .22475541 * tempF * humidity - .00683783 * tempF * tempF - .05481717 * humidity * humidity + .00122874 * tempF * tempF * humidity + .00085282 * tempF * humidity * humidity - .00000199 * tempF * tempF * humidity * humidity;
          if (humidity < 13 && tempF > 80 && tempF < 112) {
            heatIndex -= ((13 - humidity) / 4) * Math.sqrt((17 - Math.abs(tempF - 95)) / 17); // low humidity correction
          }
          if (humidity > 85 && tempF > 80 && tempF < 87) {
            heatIndex += ((humidity - 85) / 10) * ((87 - tempF) / 5); // high humidity correction
          }
        }
        // compute wind chill
        const windChill = 35.74 + 0.6215 * tempF - 35.75 * Math.pow(windSpeed, 0.16) + 0.4275 * tempF * Math.pow(windSpeed, 0.16);

        html_content += `<p> Temperature: ` + nf.format(tempF) + `°F (${nf.format(waqiContent.data.iaqi.t?.v)} °C)</p>`;
        // if within range, print heat index
        //if (tempF > 80 && humidity > 40) {
        if (heatIndex > 80) {
          //const humidityIdx = heatIndexHumidity.findIndex((element) => element > humidity);
          //const tempIdx = heatIndexTemp.findIndex((element) => element > tempF);
          //const humidityGrad = (heatIndexTab[humidityIdx][tempIdx-1]-heatIndexTab[humidityIdx-1][tempIdx-1])/(heatIndexHumidity[humidityIdx]-heatIndexHumidity[humidityIdx-1]);
          //const tempGrad = (heatIndexTab[humidityIdx-1][tempIdx]-heatIndexTab[humidityIdx-1][tempIdx-1])/(heatIndexTemp[tempIdx]-heatIndexTemp[tempIdx-1]);
          //const heatIndex = heatIndexTab[humidityIdx-1][tempIdx-1] + humidityGrad*(humidity - heatIndexHumidity[humidityIdx-1]) + tempGrad*(tempF - heatIndexTemp[tempIdx-1]);
          html_content += `<p> Feels like: ${nf.format(heatIndex)}°F (<a href="https://www.weather.gov/safety/heat-index">heat index</a>)</p>`;
        }
        // if within range, print wind chill
        if (windChill < 40) {
          html_content += `<p> Feels like: ${nf.format(windChill)}°F (<a href="https://www.weather.gov/safety/cold-wind-chill-chart">wind chill</a>)</p>`;
        }

        html_content += `<p> Relative humidity: ${humidity}&percnt;</p>`;
        html_content += `<p> Wind speed: ${nf.format(windSpeed)} mph</p>`;
        if ("properties" in nwsPointsContent) {
          html_content += `<p> <a href="https://www.weather.gov/${nwsPointsContent.properties.gridId}/">Forecast</a>:<br /><ul>`;
          for (let i=0; i<3; i++) {
            html_content += `<li>${nwsForecastContent.properties.periods[i].name}: ${nwsForecastContent.properties.periods[i].detailedForecast}</li>`;
          }
          html_content += `</ul></p><p><a href="https://radar.weather.gov/station/${nwsPointsContent.properties.radarStation}/standard"><img loading="lazy" src="https://radar.weather.gov/ridge/standard/${nwsPointsContent.properties.radarStation}_loop.gif" width="600" height="550" alt="radar loop" style="max-width: 100%; height: auto;"></a></p>`;
        }
        html_content += `<p> Overall AQI: ${waqiContent.data.aqi}</p>`;
        html_content += `<p> PM<sub>2.5</sub> AQI: ${waqiContent.data.iaqi.pm25?.v}</p>`;
        html_content += `<p> PM<sub>10</sub> AQI: ${waqiContent.data.iaqi.pm10?.v}</p>`;
        html_content += `<p> O<sub>3</sub> (ozone) AQI: ${waqiContent.data.iaqi.o3?.v}</p>`;
        html_content += `<p> NO<sub>2</sub> AQI: ${waqiContent.data.iaqi.no2?.v}</p>`;
        html_content += `<p> SO<sub>2</sub> AQI: ${waqiContent.data.iaqi.so2?.v}</p>`;
        html_content += `<p> CO AQI: ${waqiContent.data.iaqi.co?.v}</p>`;
        html_content += `<p> Sensor data from <a href="${waqiContent.data.city.url}">${waqiContent.data.city.name}</a>, measured at ${waqiContent.data.time.s} (${waqiContent.data.time.tz})</p>`;
      } catch (e) {
        html_content += `<p>Unexpected error: ` + e + `</p>`;
        html_content += `<p>` + e.stack + `</p>`;
      }
      html_content += `<p><iframe loading="lazy" title="Airnow widget" height="230" width="230" src="https://widget.airnow.gov/aq-dial-widget-primary-pollutant/?latitude=${latitude}&longitude=${longitude}&transparent=true" style="border: none; border-radius: 25px;"></iframe></p>`

      html_content += "<h1>Browser 🗔</h1>";
      html_content += "<p> User Agent: " + clientUA + "</p>";
      html_content += "<p> HTTP Version: " + request.cf.httpProtocol + "</p>";
      html_content += "<p> TLS Version: " + tlsVersion + "</p>";
      html_content += "<p> TLS Cipher: " + request.cf.tlsCipher + "</p>";

      let html = `<!DOCTYPE html>
      <html lang="en">
      <head>
        <title>IP Geolocation 🌐 + Weather 🌦</title>
        <meta name="viewport" content="width=device-width" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
        <link rel="apple-touch-icon" href="/favicon.png">
        <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
        <style> ${html_style} </style>
      </head>
      <body>
        <div id="container">
        ${html_content}
        </div>
      </body>
      <footer>
        <p>Script adapted from <a href="https://developers.cloudflare.com/workers/examples/">Cloudflare</a> and <a href="https://niksec.com/creating-a-simple-ip-check-tool-with-cloudflare-workers/">NikSec</a> examples.</p>
        <p><a href="https://github.com/mdlew/ip">Fork this project on GitHub</a></p>
      </footer>
      </html>`;


      if (tlsVersion !== "TLSv1.2" && tlsVersion !== "TLSv1.3") {
        return new Response("You need to use TLS version 1.2 or higher.", {
          status: 400,
        });
      } else {
        return new Response(html, {
          headers: myHeaders,
        });
      }
    }
  }
};