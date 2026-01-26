/**
 * Server-side rendering module for assembling HTML pages with IP geolocation,
 * weather observations, air quality data, forecasts, and alerts.
 *
 * Integrates with:
 * - WAQI (World Air Quality Index) for air quality data
 * - NWS (National Weather Service) for forecasts and alerts
 * - AirNow for additional air quality data
 * - Cloudflare Workers Request.cf metadata for client location
 *
 * Produces lightweight HTML with embedded styles, MapLibre map integration,
 * and collapsible alert sections.
 *
 * @module
 * @author Matthew Lew
 */

import {
  aqiCategoryToEmoji,
  aqiToEmoji,
  calcDewPointF,
  calcHeatIndex,
  dewPointEmoji,
  fetchProducts,
  lat2y,
  lon2x,
  nwsAlertEventToEmoji,
  nwsAlertResponseToEmoji,
  nwsAlertSeverityToEmoji,
  nwsForecastIconToEmoji,
  statusEmoji,
  timeoutStatusEmoji,
  toCSSGradient,
  userAgentIcon,
  windDirectionToEmoji,
} from "./utils.ts";

/**
 * Environment bindings and secrets for the Cloudflare Worker.
 *
 * @interface
 */
interface Env {
  /** Token for WAQI (World Air Quality Index) API */
  WAQI_TOKEN: string;
  /** User agent string for NWS (National Weather Service) API */
  NWS_AGENT: string;
  /** API key for AirNow air quality service */
  AIRNOW_KEY: string;
  /** Fetcher binding for serving static assets */
  ASSETS: Fetcher;
}

const intFormatTwoDigit = new Intl.NumberFormat("en-US", {
  minimumIntegerDigits: 2,
});
const floatFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

// User information
const user = {
  timezone: "America/New_York",
  localizedDate: new Date(),
  dateFormat: new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }),
  latitude: "40.712778", // default to NYC
  longitude: "-74.006111", // default to NYC
  miPerKm: 0.621371, // miles per kilometer
  nonce: "", // nonce for CSP
};

// performance JSON object
const timingLog = {
  message: "",
  renderHead: NaN,
  renderGeolocation: NaN,
  renderWeather: NaN,
  renderForecast: NaN,
  renderFooter: NaN,
  renderTotal: NaN,
};

/**
 * Generates the HTML head section with styles and metadata.
 * Adjusts colors based on time of day.
 *
 * @private
 * @returns {string} HTML string containing the document head and opening body tag
 */
function renderHead(): string {
  const start = performance.now();

  const hour = user.localizedDate.getHours();
  let accentColor = "#f6821f";
  let textColor = "white";
  if (hour >= 7 && hour < 13) {
    accentColor = "black";
    textColor = "black";
  }

  const html_style = `@font-face {
  font-family: "Source Sans 3";
  src:
    local("Source Sans 3"), local("Source Sans Pro"),
    url("/SourceSans3-Regular.otf.woff2") format("woff2");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
 }
 @font-face {
  font-family: "Source Sans 3";
  src:
    local("Source Sans 3 Bold"), local("Source Sans Pro Bold"),
    url("/SourceSans3-Bold.otf.woff2") format("woff2");
  font-weight: bold;
  font-style: normal;
  font-display: swap;
 }
 body {padding:2em; font-family:'Source Sans 3','Source Sans Pro',sans-serif; color:${textColor}; margin:0 !important; height:100%; font-size:clamp(1rem, 0.96rem + 0.18vw, 1.125rem); background: ${toCSSGradient(
   hour,
 )};}
 img {max-width: 100%; height: auto;} #container {display: flex; flex-direction:column;min-height: 100%;}
 footer {padding: 3px; font-size:clamp(0.8rem, 0.96rem + 0.18vw, 1rem);}
 h1, h2, h3 {color: ${accentColor};} p{margin: 0.3em;} a {color: ${accentColor};} a:hover {color: ${textColor};}
 .collapsible {background-color: #8A3B12;  color: white;  font-family:'Source Sans 3','Source Sans Pro',sans-serif;  font-size:clamp(1rem, 0.96rem + 0.18vw, 1.125rem);  cursor: pointer;  padding: 18px;  width: 100%;  border: none;  text-align: left;  outline: none;}
 .active, .collapsible:hover {background-color: #59230B;}
 .collapsible:after {content: '➕';  color: white;  font-weight: bold;  float: right;  margin-left: 5px;} .active:after {content: '➖';}
 .content {padding: 0 18px;  max-height: 0;  overflow: hidden;  transition: max-height 0.2s ease-out;  color: white;  background-color: #8A3B12;}
 #map {width: 100%; height: 350px;}`;
  const html_head = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>IP Geolocation 🌐 + Weather 🌦</title>
  <meta charset="utf-8">
  <meta name="description" content="IP Geolocation and Weather information">
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
  <link rel="apple-touch-icon" href="/favicon.ico">
  <link rel="preconnect" href="https://unpkg.com" />
  <link rel="preconnect" href="https://tiles.stadiamaps.com" />
  <script nonce="${user.nonce}" type="text/javascript" src="//unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js"></script>
  <link href="//unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css" rel="stylesheet" />
  <style nonce="${user.nonce}" type="text/css"> ${html_style} </style>
</head>
<body>
<div id="container">`;

  timingLog.renderHead = performance.now() - start;
  return html_head;
}

/**
 * Generates the IP geolocation section with map and location details.
 *
 * @private
 * @param {Request} request - The incoming HTTP request with Cloudflare metadata
 * @returns {string} HTML string containing geolocation information and MapLibre map
 */
function renderGeolocation(request: Request): string {
  const start = performance.now();

  const clientIP = request.headers.get("CF-Connecting-IP");
  const clientASN = request.cf?.asn;
  const clientISP = request.cf?.asOrganization;

  const html_content = `  <h1>IP Geolocation 🌐</h1>
  <p> Public IP: ${clientIP} (<a href="https://radar.cloudflare.com/ip/${clientIP}">Cloudflare radar</a>)</p>
  <p> ISP: ${clientISP}, ASN: ${clientASN} (<a href="https://radar.cloudflare.com/quality/as${clientASN}">Cloudflare radar</a>)</p>
  <div id="map"></div>
  <p> Coordinates: <a href="https://www.openstreetmap.org/?mlat=${user.latitude}&amp;mlon=${user.longitude}#map=11/${user.latitude}/${user.longitude}">(${user.latitude}, ${user.longitude})</a>, Timezone: ${user.timezone}</p>
  <p> City: ${request.cf?.city}, <a href="https://en.wikipedia.org/wiki/List_of_television_stations_in_North_America_by_media_market">US DMA Code</a>: ${request.cf?.metroCode}</p>
  <p> <a href="https://en.wikipedia.org/wiki/ISO_3166-2">Region</a>: ${request.cf?.region}, RegionCode: ${request.cf?.regionCode}, PostalCode: ${request.cf?.postalCode}</p>
  <p> Country: ${request.cf?.country},  Continent: ${request.cf?.continent}</p>
  <script nonce="${user.nonce}" type="text/javascript">
    var map = new maplibregl.Map({
      container: 'map',
      style: 'https://tiles.stadiamaps.com/styles/outdoors.json',  // Style URL; see our documentation for more options
      center: [${user.longitude}, ${user.latitude}],  // Initial focus coordinate
      zoom: 11
    });
    // MapLibre GL JS does not handle RTL text by default,
    // so we recommend adding this dependency to fully support RTL rendering if your style includes RTL text
    maplibregl.setRTLTextPlugin('https://unpkg.com/@mapbox/mapbox-gl-rtl-text@latest/dist/mapbox-gl-rtl-text.js');
    // Add zoom and rotation controls to the map.
    map.addControl(new maplibregl.NavigationControl());
    // Next, we can add markers to the map
    const marker = new maplibregl.Marker()
      .setLngLat([${user.longitude}, ${user.latitude}])
      .addTo(map);
  </script>`;

  timingLog.renderGeolocation = performance.now() - start;
  return html_content;
}

/**
 * Fetches and renders current weather conditions and air quality data.
 * Queries WAQI, NWS, and AirNow APIs concurrently.
 *
 * @private
 * @param {Request} request - The incoming HTTP request
 * @param {Env} env - Environment bindings with API tokens
 * @returns {Promise<[string, any, any, boolean, boolean, boolean, boolean, boolean, boolean]>}
 *   Tuple containing HTML content, API response data, and success flags
 */
async function renderWeather(
  request: Request,
  env: Env,
): Promise<
  [string, any, any, boolean, boolean, boolean, boolean, boolean, boolean]
> {
  const start = performance.now();

  // WAQI API setup https://aqicn.org/api/
  const waqiApiRequestUrl = `https://api.waqi.info/feed/geo:${user.latitude};${user.longitude}/?token=${env.WAQI_TOKEN}`;
  const waqiRequestInit = {
    headers: {
      "content-type": "application/json;charset=UTF-8",
    },
  };
  // https://www.weather.gov/documentation/services-web-api API setup
  const nwsPointsRequestUrl = `https://api.weather.gov/points/${user.latitude},${user.longitude}`;
  const nwsRequestInit = {
    headers: {
      accept: "application/geo+json",
      "User-Agent": env.NWS_AGENT, // ID to send to weather.gov API
    },
  };
  // AirNow API setup https://docs.airnowapi.org/CurrentObservationsByLatLon/query
  const airnowSensorRequestUrl = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${user.latitude}&longitude=${user.longitude}&distance=75&API_KEY=${env.AIRNOW_KEY}`;
  const airnowRequestInit = {
    headers: {
      "content-type": "application/json;charset=UTF-8",
    },
  };

  // issue concurrent requests to WAQI, NWS, AirNow APIs
  let waqiData = undefined;
  let nwsPointsData = undefined;
  let airnowSensorData = undefined;
  try {
    [waqiData, nwsPointsData, airnowSensorData] = await Promise.allSettled([
      fetchProducts(waqiApiRequestUrl, waqiRequestInit, true),
      fetchProducts(
        nwsPointsRequestUrl,
        nwsRequestInit,
        typeof request.cf?.country === "string" &&
          request.cf?.country.toUpperCase().includes("US"),
      ),
      fetchProducts(
        airnowSensorRequestUrl,
        airnowRequestInit,
        typeof request.cf?.country === "string" &&
          request.cf?.country.toUpperCase().includes("US"),
      ),
    ]);
  } catch (e) {
    console.log({ error: e, error_stack: (e as Error).stack });
  }
  const waqiRequestSuccess =
    !(waqiData == undefined) &&
    waqiData.status === "fulfilled" &&
    !(waqiData.value == undefined);
  const nwsPointsRequestSuccess =
    !(nwsPointsData == undefined) &&
    nwsPointsData.status === "fulfilled" &&
    !(nwsPointsData.value == undefined) &&
    typeof nwsPointsData.value === "object" &&
    nwsPointsData.value !== null &&
    "properties" in nwsPointsData.value;
  const airnowSensorRequestSuccess =
    !(airnowSensorData == undefined) &&
    airnowSensorData.status === "fulfilled" &&
    Array.isArray(airnowSensorData.value) &&
    airnowSensorData.value.length > 0;
  // parse responses if successful
  if (waqiRequestSuccess) {
    waqiData = (waqiData as PromiseFulfilledResult<any>).value.data;
  } else {
    waqiData = undefined;
  }
  if (nwsPointsRequestSuccess) {
    nwsPointsData = (nwsPointsData as PromiseFulfilledResult<any>).value
      .properties;
  } else {
    nwsPointsData = undefined;
  }
  if (airnowSensorRequestSuccess) {
    airnowSensorData = (airnowSensorData as PromiseFulfilledResult<any>).value;
  } else {
    airnowSensorData = undefined;
  }

  // ********************************************************************************************************************
  // parse AirNow response
  const airnowPM25 = {
    AQI: undefined,
    category: undefined,
  };
  const airnowPM10 = {
    AQI: undefined,
    category: undefined,
  };
  const airnowO3 = {
    AQI: undefined,
    category: undefined,
  };
  const airnowOverall = {
    AQI: undefined,
    category: undefined,
  };
  if (!(airnowSensorData == undefined)) {
    for (let i = 0; i < airnowSensorData.length; i++) {
      if (i === 0 || airnowSensorData[i]?.AQI > (airnowOverall.AQI ?? -1)) {
        airnowOverall.AQI = airnowSensorData[i]?.AQI;
        airnowOverall.category = airnowSensorData[i]?.Category.Name;
      }
      let airnowParameterName =
        airnowSensorData[i]?.ParameterName.toUpperCase();
      if (airnowParameterName.includes("PM2.5")) {
        airnowPM25.AQI = airnowSensorData[i]?.AQI;
        airnowPM25.category = airnowSensorData[i]?.Category.Name;
      } else if (airnowParameterName.includes("PM10")) {
        airnowPM10.AQI = airnowSensorData[i]?.AQI;
        airnowPM10.category = airnowSensorData[i]?.Category.Name;
      } else if (airnowParameterName.includes("O3")) {
        airnowO3.AQI = airnowSensorData[i]?.AQI;
        airnowO3.category = airnowSensorData[i]?.Category.Name;
      }
    }
  }

  // temperature data
  const tempC = !(waqiData == undefined) ? parseFloat(waqiData.iaqi.t?.v) : NaN;
  const tempF = (tempC * 9.0) / 5.0 + 32.0; // convert to Fahrenheit
  const humidity = !(waqiData == undefined) ? waqiData.iaqi.h?.v : NaN;
  const dewPointF = calcDewPointF(tempC, humidity);
  const windSpeed = !(waqiData == undefined)
    ? (parseFloat(waqiData.iaqi.w?.v) * 1000 * user.miPerKm) / 3600.0
    : NaN; // m/s to mph
  // compute heat index if it's warm enough
  const heatIndex = calcHeatIndex(tempF, humidity);
  // compute wind chill
  const windChill =
    35.74 +
    0.6215 * tempF -
    35.75 * Math.pow(windSpeed, 0.16) +
    0.4275 * tempF * Math.pow(windSpeed, 0.16);

  // ********************************************************************************************************************
  // build HTML content
  let html_content = `<h1>Current Conditions 🌡️</h1><p> Temperature: ${floatFormat.format(
    tempF,
  )} °F (${floatFormat.format(
    !(waqiData == undefined) ? waqiData.iaqi.t?.v : NaN,
  )} °C)</p>`;
  // if within range, print heat index
  //if (tempF > 80 && humidity > 40) {
  if (heatIndex > 80) {
    html_content += `<p> Feels like: ${floatFormat.format(
      heatIndex,
    )} °F (<a href="https://www.weather.gov/safety/heat-index">heat index</a>)</p>`;
  }
  // if within range, print wind chill
  if (windChill < 40) {
    html_content += `<p> Feels like: ${floatFormat.format(
      windChill,
    )} °F (<a href="https://www.weather.gov/safety/cold-wind-chill-chart">wind chill</a>)</p>`;
  }

  html_content += `<p> Relative humidity: ${dewPointEmoji(
    dewPointF,
  )} ${humidity}&percnt;, <a href="https://www.weather.gov/tbw/dewpoint#dp">Dew point</a>: ${floatFormat.format(
    dewPointF,
  )} °F</p>`;
  html_content += `<p> Wind speed: ${floatFormat.format(windSpeed)} mph</p>`;

  // air quality data
  html_content += `<p> Overall: ${aqiToEmoji(
    !(waqiData == undefined) ? waqiData.aqi : undefined,
  )} ${!(waqiData == undefined) ? waqiData.aqi + " AQI" : "N/A"} `;
  if (!(airnowOverall.AQI == undefined)) {
    html_content += ` (AirNow: ${aqiToEmoji(airnowOverall.AQI)} ${
      airnowOverall.AQI
    } AQI, ${airnowOverall.category})</p>`;
  } else {
    html_content += `</p>`;
  }
  html_content += `<p> PM<sub>2.5</sub>: ${aqiToEmoji(
    !(waqiData == undefined) ? waqiData.iaqi.pm25?.v : undefined,
  )} ${!(waqiData == undefined) ? waqiData.iaqi.pm25?.v + " AQI" : "N/A"} `;
  if (!(airnowPM25.AQI == undefined)) {
    html_content += ` (<a href="https://gispub.epa.gov/airnow/?showlegend=no&xmin=${
      lon2x(parseFloat(user.longitude)) - 200000
    }&xmax=${lon2x(parseFloat(user.longitude)) + 200000}&ymin=${
      lat2y(parseFloat(user.latitude)) - 200000
    }&ymax=${
      lat2y(parseFloat(user.latitude)) + 200000
    }&monitors=pm25&contours=pm25">AirNow</a>: ${aqiToEmoji(airnowPM25.AQI)} ${
      airnowPM25.AQI
    } AQI, ${airnowPM25.category})</p>`;
  } else {
    html_content += `</p>`;
  }
  html_content += `<p> PM<sub>10</sub>: ${aqiToEmoji(
    !(waqiData == undefined) ? waqiData.iaqi.pm10?.v : undefined,
  )} ${!(waqiData == undefined) ? waqiData.iaqi.pm10?.v + " AQI" : "N/A"} `;
  if (!(airnowPM10.AQI == undefined)) {
    html_content += ` (<a href="https://gispub.epa.gov/airnow/?showlegend=no&xmin=${
      lon2x(parseFloat(user.longitude)) - 200000
    }&xmax=${lon2x(parseFloat(user.longitude)) + 200000}&ymin=${
      lat2y(parseFloat(user.latitude)) - 200000
    }&ymax=${
      lat2y(parseFloat(user.latitude)) + 200000
    }&monitors=pm10&contours=ozonepm">AirNow</a>: ${aqiToEmoji(
      airnowPM10.AQI,
    )} ${airnowPM10.AQI} AQI, ${airnowPM10.category})</p>`;
  } else {
    html_content += `</p>`;
  }
  html_content += `<p> O<sub>3</sub> (ozone): ${aqiToEmoji(
    !(waqiData == undefined) ? waqiData.iaqi.o3?.v : undefined,
  )} ${!(waqiData == undefined) ? waqiData.iaqi.o3?.v + " AQI" : "N/A"} `;
  if (!(airnowO3.AQI == undefined)) {
    html_content += ` (<a href="https://gispub.epa.gov/airnow/?showlegend=no&xmin=${
      lon2x(parseFloat(user.longitude)) - 200000
    }&xmax=${lon2x(parseFloat(user.longitude)) + 200000}&ymin=${
      lat2y(parseFloat(user.latitude)) - 200000
    }&ymax=${
      lat2y(parseFloat(user.latitude)) + 200000
    }&contours=ozone&monitors=ozone">AirNow</a>: ${aqiToEmoji(airnowO3.AQI)} ${
      airnowO3.AQI
    } AQI, ${airnowO3.category})</p>`;
  } else {
    html_content += `</p>`;
  }
  html_content += `<p> NO<sub>2</sub> (nitrogen dioxide): ${aqiToEmoji(
    !(waqiData == undefined) ? waqiData.iaqi.no2?.v : undefined,
  )} ${!(waqiData == undefined) ? waqiData.iaqi.no2?.v + " AQI" : "N/A"}</p>`;
  html_content += `<p> SO<sub>2</sub> (sulphur dioxide): ${aqiToEmoji(
    !(waqiData == undefined) ? waqiData.iaqi.so2?.v : undefined,
  )} ${!(waqiData == undefined) ? waqiData.iaqi.so2?.v + " AQI" : "N/A"}</p>`;
  html_content += `<p> CO (carbon monoxide): ${aqiToEmoji(
    !(waqiData == undefined) ? waqiData.iaqi.co?.v : undefined,
  )} ${!(waqiData == undefined) ? waqiData.iaqi.co?.v + " AQI" : "N/A"}</p>`;

  // add NWS radar loop if available, change URL every 2 minutes to avoid caching
  if (!(nwsPointsData == undefined)) {
    html_content += `<p> <a href="https://radar.weather.gov/station/${
      nwsPointsData?.radarStation
    }/standard"><img loading="lazy" src="/radarproxy/?id=${
      nwsPointsData?.radarStation
    }&refreshed=${Math.round(
      Date.now() / 120000,
    )}" width="600" height="550" alt="radar loop"></a></p>`;
  }

  if (!(waqiData == undefined)) {
    const waqiTime = user.dateFormat.format(new Date(waqiData.time.iso));
    html_content += `<p> Sensor data from <a href="${waqiData.city.url}">${waqiData.city.name}</a>, measured on ${waqiTime}</p>`;
  }
  if (!(airnowSensorData == undefined)) {
    const firstAirnowSensor = airnowSensorData[0];
    html_content += `<p> AirNow data from <a href="https://www.airnow.gov/?city=${encodeURIComponent(
      firstAirnowSensor.ReportingArea,
    )}&state=${firstAirnowSensor.StateCode}&country=USA">${
      firstAirnowSensor.ReportingArea
    }, ${firstAirnowSensor.StateCode}</a>, measured on ${
      firstAirnowSensor.DateObserved
    }, ${firstAirnowSensor.HourObserved}:00 ${
      firstAirnowSensor.LocalTimeZone
    }</p>`;
  }

  timingLog.renderWeather = performance.now() - start;
  return [
    html_content,
    nwsPointsData,
    airnowSensorData,
    waqiRequestSuccess,
    nwsPointsRequestSuccess,
    airnowSensorRequestSuccess,
    !(waqiData == undefined),
    !(nwsPointsData == undefined),
    !(airnowSensorData == undefined),
  ];
}

/**
 * Fetches and renders weather forecasts, alerts, and air quality forecasts.
 * Queries NWS and AirNow APIs for forecast data.
 *
 * @private
 * @param {Env} env - Environment bindings with API tokens
 * @param {any} nwsPointsData - NWS points data from previous weather query
 * @param {any} airnowSensorData - AirNow sensor data from previous weather query
 * @returns {Promise<[string, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean]>}
 *   Tuple containing HTML content and success flags for various API calls
 */
async function renderForecast(
  env: Env,
  nwsPointsData: any,
  airnowSensorData: any,
): Promise<
  [
    string,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
  ]
> {
  const start = performance.now();

  // prepare to fetch data from APIs
  const tomorrow = new Date(user.localizedDate);
  tomorrow.setDate(user.localizedDate.getDate() + 1);
  const airnowDateStr = [
    `${user.localizedDate.getFullYear()}-${intFormatTwoDigit.format(
      user.localizedDate.getMonth() + 1,
    )}-${intFormatTwoDigit.format(user.localizedDate.getDate())}`,
    `${tomorrow.getFullYear()}-${intFormatTwoDigit.format(
      tomorrow.getMonth() + 1,
    )}-${intFormatTwoDigit.format(tomorrow.getDate())}`,
  ];
  const dayStr = ["Today", "Tomorrow"];

  let nwsCounty = undefined;
  let nwsForecastZone = undefined;
  if (!(nwsPointsData == undefined)) {
    nwsCounty = nwsPointsData.county.split("/");
    nwsCounty = nwsCounty ? nwsCounty[nwsCounty.length - 1] : undefined;
    nwsForecastZone = nwsPointsData.forecastZone.split("/");
    nwsForecastZone = nwsForecastZone
      ? nwsForecastZone[nwsForecastZone.length - 1]
      : undefined;
  }

  const nwsAlertRequestUrl = `https://api.weather.gov/alerts/active/zone/${nwsCounty}`;
  const nwsObservationsRequestUrl = `https://api.weather.gov/zones/forecast/${nwsForecastZone}/observations?limit=1`;
  const nwsRequestInit = {
    headers: {
      accept: "application/geo+json",
      "User-Agent": env.NWS_AGENT, // ID to send to weather.gov API
    },
  };
  const airnowForecastRequestUrl = `https://www.airnowapi.org/aq/forecast/latLong/?format=application/json&latitude=${user.latitude}&longitude=${user.longitude}&date=&distance=75&API_KEY=${env.AIRNOW_KEY}`;
  const airnowRequestInit = {
    headers: {
      "content-type": "application/json;charset=UTF-8",
    },
  };

  // grab NWS, airnow forecasts if available
  let nwsAlertData = undefined;
  let nwsForecastData = undefined;
  let nwsObservationsData = undefined;
  let airnowForecastData = undefined;
  try {
    [nwsAlertData, nwsForecastData, nwsObservationsData, airnowForecastData] =
      await Promise.allSettled([
        fetchProducts(
          nwsAlertRequestUrl,
          nwsRequestInit,
          !(nwsPointsData == undefined),
        ),
        fetchProducts(
          !(nwsPointsData == undefined) ? nwsPointsData.forecast : undefined,
          nwsRequestInit,
          !(nwsPointsData == undefined),
        ),
        fetchProducts(
          nwsObservationsRequestUrl,
          nwsRequestInit,
          !(nwsPointsData == undefined),
        ),
        fetchProducts(
          airnowForecastRequestUrl,
          airnowRequestInit,
          !(airnowSensorData == undefined),
        ),
      ]);
  } catch (e) {
    console.log({ error: e, error_stack: (e as Error).stack });
  }
  const nwsAlertRequestSuccess =
    !(nwsAlertData == undefined) && nwsAlertData.status === "fulfilled";
  const nwsAlertSuccess =
    !(nwsAlertData == undefined) &&
    nwsAlertData.status === "fulfilled" &&
    nwsAlertData.value !== undefined &&
    typeof nwsAlertData.value === "object" &&
    nwsAlertData.value !== null &&
    Array.isArray((nwsAlertData.value as any).features) &&
    (nwsAlertData.value as any).features.length > 0;
  const nwsForecastRequestSuccess =
    !(nwsForecastData == undefined) && nwsForecastData.status === "fulfilled";
  const nwsForecastSuccess =
    !(nwsForecastData == undefined) &&
    nwsForecastData.status === "fulfilled" &&
    nwsForecastData.value !== undefined &&
    typeof nwsForecastData.value === "object" &&
    nwsForecastData.value !== null &&
    "properties" in nwsForecastData.value;
  const nwsObservationsRequestSuccess =
    !(nwsObservationsData == undefined) &&
    nwsObservationsData.status === "fulfilled";
  const nwsObservationsSuccess =
    !(nwsObservationsData == undefined) &&
    nwsObservationsData.status === "fulfilled" &&
    nwsObservationsData.value !== undefined &&
    typeof nwsObservationsData.value === "object" &&
    nwsObservationsData.value !== null &&
    Array.isArray((nwsObservationsData.value as any).features) &&
    (nwsObservationsData.value as any).features.length > 0;
  const airnowForecastRequestSuccess =
    !(airnowForecastData == undefined) &&
    airnowForecastData.status === "fulfilled";
  const airnowForecastSuccess =
    !(airnowForecastData == undefined) &&
    airnowForecastData.status === "fulfilled" &&
    Array.isArray(airnowForecastData.value) &&
    airnowForecastData.value.length > 0;
  // parse responses if successful
  if (nwsAlertSuccess) {
    const value = (nwsAlertData as PromiseFulfilledResult<any>).value;
    nwsAlertData = (value as { features: any[] }).features;
  } else {
    nwsAlertData = undefined;
  }
  if (nwsForecastSuccess) {
    // TypeScript now knows nwsForecastData is fulfilled
    nwsForecastData = (nwsForecastData as PromiseFulfilledResult<any>).value
      .properties;
  } else {
    nwsForecastData = undefined;
  }
  if (nwsObservationsSuccess) {
    const value = (nwsObservationsData as PromiseFulfilledResult<any>).value;
    nwsObservationsData = (value as { features: any[] }).features[0].properties;
  } else {
    nwsObservationsData = undefined;
  }
  if (airnowForecastSuccess) {
    airnowForecastData = (airnowForecastData as PromiseFulfilledResult<any>)
      .value;
  } else {
    airnowForecastData = undefined;
  }

  // ********************************************************************************************************************
  // build HTML content
  let html_content = "";
  if (!(nwsPointsData == undefined)) {
    if (nwsForecastSuccess || nwsObservationsSuccess || nwsAlertSuccess) {
      html_content += `<h1>NWS Forecast 🌦️</h1><p> <a href="https://www.weather.gov/${nwsPointsData?.gridId}/">${nwsPointsData?.gridId} forecast office</a></p>`;
    }
    // parse alert data
    if (nwsAlertSuccess && Array.isArray(nwsAlertData)) {
      html_content += `<h2>⚠️ Alerts</h2>`;
      for (let i = 0; i < nwsAlertData.length; i++) {
        let alertInfo = nwsAlertData[i].properties;
        html_content += `<div><button class="collapsible"> ${nwsAlertResponseToEmoji(
          alertInfo?.response,
        )} ${alertInfo?.response}, ${nwsAlertSeverityToEmoji(
          alertInfo?.severity,
        )} ${alertInfo?.severity}: ${nwsAlertEventToEmoji(
          alertInfo?.headline,
        )} ${
          alertInfo?.headline
        }</button><div class="content"><h3> ${nwsAlertEventToEmoji(
          alertInfo?.event,
        )} ${alertInfo?.event}</h3><p>${alertInfo?.description.replace(
          /\n\n/g,
          "</p><p>",
        )}</p><p>Instruction: ${alertInfo?.instruction}</p><p>Status: ${
          alertInfo?.status
        }, Urgency: ${alertInfo?.urgency}, Certainty: ${
          alertInfo?.certainty
        }</p><p>Onset: ${user.dateFormat.format(
          new Date(alertInfo?.onset),
        )}, Ends: ${user.dateFormat.format(
          new Date(alertInfo?.ends),
        )}</p><p>Affected areas: ${alertInfo?.areaDesc}</p><p>Sender: ${
          alertInfo?.senderName
        }, Sent: ${user.dateFormat.format(
          new Date(alertInfo?.sent),
        )}, Expires: ${user.dateFormat.format(
          new Date(alertInfo?.expires),
        )}</p></div></div>`;
      }
    }
    // parse observations data
    if (nwsObservationsSuccess) {
      const dewPointF =
        (nwsObservationsData?.dewpoint.value * 9.0) / 5.0 + 32.0;

      html_content += `<p> Conditions at <a href="https://forecast.weather.gov/zipcity.php?inputstring=${
        nwsObservationsData?.stationId
      }">${nwsObservationsData?.stationName}</a> as of ${user.dateFormat.format(
        new Date(nwsObservationsData?.timestamp),
      )}: ${nwsForecastIconToEmoji(
        nwsObservationsData?.icon,
      )} ${nwsObservationsData?.textDescription}</p>`;
      html_content += `<p> Temperature: ${floatFormat.format(
        (nwsObservationsData?.temperature.value * 9.0) / 5.0 + 32.0,
      )} °F (${floatFormat.format(
        nwsObservationsData?.temperature.value,
      )} °C)</p>`;
      // if hot enough, print heat index
      if ((nwsObservationsData?.heatIndex.value * 9.0) / 5.0 + 32.0 > 80) {
        html_content += `<p> Feels like: ${floatFormat.format(
          (nwsObservationsData?.heatIndex.value * 9.0) / 5.0 + 32.0,
        )} °F</p>`;
      }
      // if chilly enough, print wind chill
      if ((nwsObservationsData?.windChill.value * 9.0) / 5.0 + 32.0 < 40) {
        html_content += `<p> Feels like: ${floatFormat.format(
          (nwsObservationsData?.windChill.value * 9.0) / 5.0 + 32.0,
        )} °F</p>`;
      }
      html_content += `<p> Relative humidity: ${dewPointEmoji(
        dewPointF,
      )} ${floatFormat.format(
        nwsObservationsData?.relativeHumidity.value,
      )}%, Dew point: ${floatFormat.format(dewPointF)} °F</p>`;
      html_content += `<p> Wind: ${windDirectionToEmoji(nwsObservationsData?.windDirection.value)} ${floatFormat.format(nwsObservationsData?.windSpeed.value * user.miPerKm)} mph</p>`;
    }
    // parse forecast data
    if (nwsForecastSuccess) {
      for (let i = 0; i < Math.min(4, nwsForecastData.periods.length); i++) {
        html_content += `<p> ${
          nwsForecastData.periods[i].name
        }: ${nwsForecastIconToEmoji(nwsForecastData.periods[i].icon)} ${
          nwsForecastData.periods[i].detailedForecast
        }</p>`;
      }
    }
  }

  if (airnowForecastSuccess) {
    const firstAirnowForecast = airnowForecastData[0];
    html_content += `<h1>AirNow Forecast 🌬️</h1><p> <a href="https://www.airnow.gov/?city=${encodeURIComponent(
      firstAirnowForecast.ReportingArea,
    )}&state=${firstAirnowForecast.StateCode}&country=USA">${
      firstAirnowForecast.ReportingArea
    }, ${firstAirnowForecast.StateCode}</a></p>`;
    let airnowDateIdx = 0;
    let newDate = true;
    for (let i = 0; i < airnowForecastData.length; i++) {
      let currAirnowData = airnowForecastData[i];
      // check if we should increment date
      if (
        airnowDateIdx < airnowDateStr.length - 1 &&
        currAirnowData.DateForecast === airnowDateStr[airnowDateIdx + 1]
      ) {
        newDate = true;
        airnowDateIdx++;
        if (i > 0) {
          html_content += `</p>`;
        }
      }
      // if date matches, then push data to HTML
      if (currAirnowData?.DateForecast === airnowDateStr[airnowDateIdx]) {
        if (newDate) {
          html_content += `<p> ${dayStr[airnowDateIdx]}: `;
          if (currAirnowData?.ActionDay) {
            html_content += `<b>⚠️ Action day ⚠️</b></p><p>`;
          }
          newDate = false;
        } else {
          html_content += `</p><p>`;
        }
        html_content += `${currAirnowData.ParameterName}: ${aqiCategoryToEmoji(
          currAirnowData.Category.Number,
        )}`;
        if (currAirnowData?.AQI > 0) {
          html_content += ` ${currAirnowData.AQI} AQI,`;
        }
        html_content += ` ${currAirnowData.Category.Name}`;
      }
    }
    html_content += `</p>`;
    // add discussion if available
    if (
      !(firstAirnowForecast?.Discussion == undefined) &&
      !(firstAirnowForecast?.Discussion === "")
    ) {
      if (
        typeof firstAirnowForecast.Discussion === "string" &&
        URL.canParse(firstAirnowForecast.Discussion)
      ) {
        html_content += `<p> <a href="${firstAirnowForecast.Discussion}">Discussion: ${firstAirnowForecast.Discussion}</a></p>`;
      } else {
        html_content += `<div><button class="collapsible">Discussion</button><div class="content"><p>${
          typeof firstAirnowForecast.Discussion === "string"
            ? firstAirnowForecast.Discussion.replace(/\n\n/g, "</p><p>")
            : ""
        }</p></div></div>`;
      }
    }
  }

  timingLog.renderForecast = performance.now() - start;
  return [
    html_content,
    nwsAlertRequestSuccess,
    nwsForecastRequestSuccess,
    nwsObservationsRequestSuccess,
    airnowForecastRequestSuccess,
    nwsAlertSuccess && Array.isArray(nwsAlertData),
    nwsForecastSuccess,
    nwsObservationsSuccess,
    airnowForecastSuccess,
  ];
}

/**
 * Generates the page footer with browser information and API status indicators.
 *
 * @private
 * @param {Request} request - The incoming HTTP request
 * @param {boolean} waqiRequestSuccess - Whether WAQI request completed
 * @param {boolean} nwsPointsRequestSuccess - Whether NWS points request completed
 * @param {boolean} airnowSensorRequestSuccess - Whether AirNow sensor request completed
 * @param {boolean} waqiDataExists - Whether WAQI returned valid data
 * @param {boolean} nwsPointsDataExists - Whether NWS points returned valid data
 * @param {boolean} airnowSensorDataExists - Whether AirNow sensor returned valid data
 * @param {boolean} nwsAlertRequestSuccess - Whether NWS alert request completed
 * @param {boolean} nwsForecastRequestSuccess - Whether NWS forecast request completed
 * @param {boolean} nwsObservationsRequestSuccess - Whether NWS observations request completed
 * @param {boolean} airnowForecastRequestSuccess - Whether AirNow forecast request completed
 * @param {boolean} nwsAlertDataExists - Whether NWS alerts returned valid data
 * @param {boolean} nwsForecastDataExists - Whether NWS forecast returned valid data
 * @param {boolean} nwsObservationsDataExists - Whether NWS observations returned valid data
 * @param {boolean} airnowForecastDataExists - Whether AirNow forecast returned valid data
 * @returns {string} HTML string containing the footer and closing tags
 */
function renderFooter(
  request: Request,
  waqiRequestSuccess: boolean,
  nwsPointsRequestSuccess: boolean,
  airnowSensorRequestSuccess: boolean,
  waqiDataExists: boolean,
  nwsPointsDataExists: boolean,
  airnowSensorDataExists: boolean,
  nwsAlertRequestSuccess: boolean,
  nwsForecastRequestSuccess: boolean,
  nwsObservationsRequestSuccess: boolean,
  airnowForecastRequestSuccess: boolean,
  nwsAlertDataExists: boolean,
  nwsForecastDataExists: boolean,
  nwsObservationsDataExists: boolean,
  airnowForecastDataExists: boolean,
): string {
  const start = performance.now();

  const userAgentStr = request.headers.get("User-Agent");

  const html_footer = `  <h1>Browser ${userAgentIcon(userAgentStr ?? "")}</h1>
  <p> User Agent: ${userAgentStr}</p>
  <p> Request: ${request.cf?.httpProtocol}, ${request.cf?.tlsVersion}, ${
    request.cf?.tlsCipher
  } <a href="https://developers.cloudflare.com/ssl/origin-configuration/cipher-suites/">cipher</a></p>
</div>
<footer>
  <p> Page generated on ${user.dateFormat.format(new Date())} in ${
    timingLog.renderHead +
    timingLog.renderGeolocation +
    timingLog.renderWeather +
    timingLog.renderForecast +
    performance.now() -
    start
  } ms by Cloudflare <a href="https://en.wikipedia.org/wiki/IATA_airport_code">${
    request.cf?.colo
  }</a>.</p>
  <p> NWS location ${timeoutStatusEmoji(nwsPointsRequestSuccess)}${statusEmoji(
    nwsPointsDataExists,
  )}. NWS alert ${timeoutStatusEmoji(nwsAlertRequestSuccess)}${statusEmoji(
    nwsAlertDataExists,
  )}. NWS forecast ${timeoutStatusEmoji(
    nwsForecastRequestSuccess,
  )}${statusEmoji(nwsForecastDataExists)}. NWS observations ${timeoutStatusEmoji(
    nwsObservationsRequestSuccess,
  )}${statusEmoji(nwsObservationsDataExists)}. AirNow forecast ${timeoutStatusEmoji(
    airnowForecastRequestSuccess,
  )}${statusEmoji(
    airnowForecastDataExists,
  )}. Airnow sensor ${timeoutStatusEmoji(
    airnowSensorRequestSuccess,
  )}${statusEmoji(airnowSensorDataExists)}. WAQI ${timeoutStatusEmoji(
    waqiRequestSuccess,
  )}${statusEmoji(waqiDataExists)}.</p>
  <p> Script adapted from <a href="https://developers.cloudflare.com/workers/examples/">Cloudflare</a> and <a href="https://niksec.com/creating-a-simple-ip-check-tool-with-cloudflare-workers/">NikSec</a> examples.</p>
  <p> <a href="https://github.com/mdlew/ip">Fork this project on GitHub</a></p>
</footer>
<script nonce="${
    user.nonce
  }"> /* Script borrowed from https://www.w3schools.com/howto/howto_js_collapsible.asp */
var coll = document.getElementsByClassName("collapsible");
var i;
for (i = 0; i < coll.length; i++) {
  coll[i].addEventListener("click", function() {
    this.classList.toggle("active");
    var content = this.nextElementSibling;
    if (content.style.maxHeight){
      content.style.maxHeight = null;
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
    } 
  });
}
</script>
</body>
</html>`;

  timingLog.renderFooter = performance.now() - start;
  return html_footer;
}

/**
 * Main entry point for server-side rendering.
 * Orchestrates all rendering functions and streams HTML output to the writer.
 *
 * @param {WritableStreamDefaultWriter} writer - Stream writer for outputting HTML
 * @param {Request} request - The incoming HTTP request with Cloudflare metadata
 * @param {Env} env - Environment bindings with API tokens and secrets
 * @param {nonce} nonce - Content Security Policy nonce for inline scripts
 * @returns {Promise<void>} Promise that resolves when rendering is complete
 */
export async function renderPage(
  writer: WritableStreamDefaultWriter,
  request: Request,
  env: Env,
  nonce: string,
): Promise<void> {
  const start = performance.now();

  // initialize user object
  user.timezone =
    typeof request.cf?.timezone === "string"
      ? request.cf.timezone
      : "America/New_York";
  user.localizedDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: user.timezone }),
  );
  user.dateFormat = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: user.timezone,
    timeZoneName: "short",
  });
  user.latitude =
    typeof request.cf?.latitude === "string"
      ? request.cf.latitude
      : "40.712778"; // default to NYC
  user.longitude =
    typeof request.cf?.longitude === "string"
      ? request.cf.longitude
      : "-74.006111"; // default to NYC
  user.nonce = nonce;

  const encoder = new TextEncoder();

  writer.write(encoder.encode(renderHead()));
  writer.write(encoder.encode(renderGeolocation(request)));

  const [
    weatherContent,
    nwsPointsData,
    airnowSensorData,
    waqiRequestSuccess,
    nwsPointsRequestSuccess,
    airnowSensorRequestSuccess,
    waqiDataExists,
    nwsPointsDataExists,
    airnowSensorDataExists,
  ] = await renderWeather(request, env);
  writer.write(encoder.encode(weatherContent));
  const [
    forecastContent,
    nwsAlertRequestSuccess,
    nwsForecastRequestSuccess,
    nwsObservationsRequestSuccess,
    airnowForecastRequestSuccess,
    nwsAlertDataExists,
    nwsForecastDataExists,
    nwsObservationsDataExists,
    airnowForecastDataExists,
  ] = await renderForecast(env, nwsPointsData, airnowSensorData);
  writer.write(encoder.encode(forecastContent));
  writer.write(
    encoder.encode(
      renderFooter(
        request,
        waqiRequestSuccess,
        nwsPointsRequestSuccess,
        airnowSensorRequestSuccess,
        waqiDataExists,
        nwsPointsDataExists,
        airnowSensorDataExists,
        nwsAlertRequestSuccess,
        nwsForecastRequestSuccess,
        nwsObservationsRequestSuccess,
        airnowForecastRequestSuccess,
        nwsAlertDataExists,
        nwsForecastDataExists,
        nwsObservationsDataExists,
        airnowForecastDataExists,
      ),
    ),
  );

  // log performance
  timingLog.renderTotal = performance.now() - start;
  timingLog.message = "Rendered page in " + timingLog.renderTotal + " ms.";
  console.log(timingLog);

  return writer.close();
}
