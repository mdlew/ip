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

let grads = [
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
        let pathname = url.pathname;
        return new Response(`"${pathname}" not found`, {
          status: 404,
          statusText: "not found",
        });
      }
    }

    // else do IP geolocation
    else {

      const clientUA = request.headers.get('User-Agent');
      const clientIP = request.headers.get('CF-Connecting-IP');
      const clientASN = request.cf.asn;
      const clientISP = request.cf.asOrganization;
      const latitude = request.cf.latitude;
      const longitude = request.cf.longitude;

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
      let localized_date = new Date(
        new Date().toLocaleString("en-US", { timeZone: timezone })
      );
      let hour = localized_date.getHours();

      html_style += "body{background:" + (await toCSSGradient(hour)) + ";}";
      html_style += "h1{color:#f6821f;}";
      html_style += "p{margin: 0.3em;}";
      html_style += "a{color: #f6821f;}";
      html_style += "a:hover{color: white;}";

      let html_content = "<h1>IP Geolocation 🌐</h1>";

      html_content += `<p> Public IP: ` + clientIP + ` (<a href="https://radar.cloudflare.com/ip/${clientIP}">Cloudflare Radar info</a>)</p>`;
      html_content += `<p> ISP: ` + clientISP + `, ASN: ` + clientASN + ` (<a href="https://radar.cloudflare.com/quality/as${clientASN}">Cloudflare Radar info</a>)</p>`;
      html_content += `<iframe width="425" height="350" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://www.openstreetmap.org/export/embed.html?bbox=` + (parseFloat(longitude) - 0.5) + `%2C` + (parseFloat(latitude) - 0.6) + `%2C` + (parseFloat(longitude) + 0.5) + `%2C` + (parseFloat(latitude) + 0.6) + `&amp;layer=mapnik&amp;marker=` + latitude + `%2C` + longitude + `" style="border: 1px solid black"></iframe>`;
      html_content += `<p> (Latitude, Longitude): <a href="https://www.openstreetmap.org/?mlat=` + latitude + `&amp;mlon=` + longitude + `#map=9/` + latitude + `/` + longitude + `">(` + latitude + `, ` + longitude + `)</a></p>`;
      html_content += "<p> City: " + request.cf.city + ", MetroCode: " + request.cf.metroCode + "</p>";
      html_content += "<p> Region: " + request.cf.region + ", RegionCode: " + request.cf.regionCode + ", PostalCode: " + request.cf.postalCode + "</p>";
      html_content += "<p> Country: " + request.cf.country + ",  Continent: " + request.cf.continent + "</p>";
      html_content += "<p> Timezone: " + request.cf.timezone + "</p>";
      html_content += `<p> Cloudflare datacenter <a href="https://en.wikipedia.org/wiki/IATA_airport_code">IATA code</a>: ` + request.cf.colo + `</p>`;

      html_content += "<h1>Weather 🌦</h1>";
      try {
        // WAQI API setup
        const token = env.waqiToken; //Use a token from https://aqicn.org/api/
        let endpoint = `https://api.waqi.info/feed/geo:${latitude};${longitude}/?token=${token}`;
        const init = {
          headers: {
            "content-type": "application/json;charset=UTF-8",
          },
        };

        const response = await fetch(endpoint, init);
        const content = await response.json();

        html_content += `<p> Temperature: ` + nf.format(parseFloat(content.data.iaqi.t?.v) * 9 / 5 + 32) + `°F (${nf.format(content.data.iaqi.t?.v)} °C)</p>`;
        html_content += `<p> Relative humidity: ${content.data.iaqi.h?.v}&percnt;</p>`;
        html_content += `<p> AQI: ${content.data.aqi}</p>`;
        html_content += `<p> PM<sub>2.5</sub> level: ${content.data.iaqi.pm25?.v}</p>`;
        html_content += `<p> PM<sub>10</sub> level: ${content.data.iaqi.pm10?.v}</p>`;
        html_content += `<p> O<sub>3</sub> (ozone) level: ${content.data.iaqi.o3?.v}</p>`;
        html_content += `<p> NO<sub>2</sub> level: ${content.data.iaqi.no2?.v}</p>`;
        html_content += `<p> SO<sub>2</sub> level: ${content.data.iaqi.so2?.v}</p>`;
        html_content += `<p> CO level: ${content.data.iaqi.co?.v}</p>`;
        html_content += `<p> Sensor data from <a href="${content.data.city.url}">${content.data.city.name}</a>, measured at ${content.data.time.s}</p>`;
        html_content += `<p><iframe title="Example Primary Pollutant" height="230" width="230" src="https://widget.airnow.gov/aq-dial-widget-primary-pollutant/?latitude=${latitude}&longitude=${longitude}&transparent=true" style="border: none; border-radius: 25px;"></iframe></p>`
      } catch (e) {
        html_content += `<p>Unexpected error: ` + e + `</p>`;
      }


      html_content += "<h1>Browser 🗔</h1>";
      html_content += "<p> User Agent: " + clientUA + "</p>";
      html_content += "<p> HTTP Version: " + request.cf.httpProtocol + "</p>";
      html_content += "<p> TLS Version: " + request.cf.tlsVersion + "</p>";
      html_content += "<p> TLS Cipher: " + request.cf.tlsCipher + "</p>";

      let html = `<!DOCTYPE html>
      <html lang="en">
      <head>
        <title>IP Geolocation 🌐 + Weather 🌦</title>
        <link rel="icon" href="./favicon.svg" type="image/svg+xml" sizes="any">
        <link rel="apple-touch-icon" href="./apple-touch-icon.png">
        <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
        <style> ${html_style} </style>
      </head>
      <body>
        <div id="container">
        ${html_content}
        <p>Script adapted from <a href="https://developers.cloudflare.com/workers/examples/">Cloudflare</a> and <a href="https://niksec.com/creating-a-simple-ip-check-tool-with-cloudflare-workers/">NikSec</a> examples.</p>
        </div>
      </body>
      </html>`;

      return new Response(html, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
        },
      });
    }
  }
};