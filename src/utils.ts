/**
 * @file utils.ts
 * @description Collection of small utilities used across the app:
 *  - network helper with timeout/abort support,
 *  - Web Mercator coordinate conversions,
 *  - hour-based CSS background gradient data/formatter,
 *  - temperature/humidity helpers (heat index, dew point) and related emoji mapping,
 *  - air quality and NWS forecast/alert emoji mappers,
 *  - simple user-agent → icon mapper.
 *
 * Notes:
 *  - `fetchTimeout` is a local timeout constant used by `fetchProducts` (not exported).
 *  - `grads` is an exported array of gradient stop definitions (indexed by hour 0–23).
 *
 * Exports:
 *  - `fetchProducts(url, options, fetchEnabled?)` : Promise<any | null>
 *  - `lat2y(lat)` : number
 *  - `lon2x(lon)` : number
 *  - `grads` : Array<Array<{color: string, position: number}>>
 *  - `toCSSGradient(hour)` : string
 *  - `calcHeatIndex(tempF, humidity)` : number
 *  - `calcDewPointF(tempC, humidity)` : number
 *  - `dewPointEmoji(dewPointF)` : string
 *  - `statusEmoji(fetchSuccess)` : string
 *  - `timeoutStatusEmoji(fetchSuccess)` : string
 *  - `aqiToEmoji(AQI)` : string
 *  - `aqiCategoryToEmoji(category)` : string
 *  - `nwsForecastIconToEmoji(iconText)` : string
 *  - `nwsAlertSeverityToEmoji(alertSeverity)` : string
 *  - `nwsAlertResponseToEmoji(response)` : string
 *  - `nwsAlertEventToEmoji(event)` : string
 *  - `userAgentIcon(userAgentStr)` : string
 *
 * @author Matthew Lew
 * @date July 1, 2025
 */

// The `fetchTimeout` constant defines the maximum time (in milliseconds) to wait for a response from an API request.
// A value of 3000ms (3 seconds) was chosen as a balance between user experience and network latency,
// ensuring that the application does not hang indefinitely while waiting for a response.
const fetchTimeout = 3000;

// fetch URL helper *******************************************************
// adapted from https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Async_JS/Promises
// use fetchEnabled to quickly return null and resolve Promise if fetch is unnecessary
export async function fetchProducts(
  url: string,
  options: RequestInit,
  fetchEnabled: boolean = true
) {
  if (!fetchEnabled) {
    return null;
  }
  try {
    const controller = new AbortController();
    const timeoutID = setTimeout(
      () => controller.abort(`Abort Error (timeout ${fetchTimeout} ms)`),
      fetchTimeout
    );

    // after this line, our function will wait for the `fetch()` call to be settled
    // the `fetch()` call will either return a Response or log an error
    // add signal from AbortController to abort after a timeout period
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutID);
    if (!response.ok) {
      console.log({
        response_url: response.url,
        response_status: response.status,
        response_statusText: response.statusText,
      });
      return null;
    } else {
      // after this line, our function will wait for the `response.json()` call to be settled
      // the `response.json()` call will either return the parsed JSON object or log an error
      const data = await response.json();
      return data;
    }
  } catch (e) {
    console.log({
      request_url: url,
      error: e,
      error_stack: (e as Error).stack,
    });
    return null;
  }
}

// web mercator conversion (degrees to meters) https://wiki.openstreetmap.org/wiki/Mercator
const PI = Math.PI;
const DEG2RAD = PI / 180;
const R = 6378137.0;
export function lat2y(lat: number): number {
  return Math.log(Math.tan(PI / 4 + (lat * DEG2RAD) / 2)) * R;
}
export function lon2x(lon: number): number {
  return lon * DEG2RAD * R;
}

// gradient data for background color
export const grads = [
  [
    { color: "#00000c", position: 0 },
    { color: "#00000c", position: 0 },
  ],
  [
    { color: "#020111", position: 85 },
    { color: "#191621", position: 100 },
  ],
  [
    { color: "#020111", position: 60 },
    { color: "#20202c", position: 100 },
  ],
  [
    { color: "#020111", position: 10 },
    { color: "#3a3a52", position: 100 },
  ],
  [
    { color: "#20202c", position: 0 },
    { color: "#515175", position: 100 },
  ],
  [
    { color: "#40405c", position: 0 },
    { color: "#6f71aa", position: 80 },
    { color: "#8a76ab", position: 100 },
  ],
  [
    { color: "#4a4969", position: 0 },
    { color: "#7072ab", position: 50 },
    { color: "#cd82a0", position: 100 },
  ],
  [
    { color: "#757abf", position: 0 },
    { color: "#8583be", position: 60 },
    { color: "#eab0d1", position: 100 },
  ],
  [
    { color: "#82addb", position: 0 },
    { color: "#ebb2b1", position: 100 },
  ],
  [
    { color: "#94c5f8", position: 1 },
    { color: "#a6e6ff", position: 70 },
    { color: "#b1b5ea", position: 100 },
  ],
  [
    { color: "#b7eaff", position: 0 },
    { color: "#94dfff", position: 100 },
  ],
  [
    { color: "#9be2fe", position: 0 },
    { color: "#67d1fb", position: 100 },
  ],
  [
    { color: "#90dffe", position: 0 },
    { color: "#38a3d1", position: 100 },
  ],
  [
    { color: "#57c1eb", position: 0 },
    { color: "#246fa8", position: 100 },
  ],
  [
    { color: "#2d91c2", position: 0 },
    { color: "#1e528e", position: 100 },
  ],
  [
    { color: "#2473ab", position: 0 },
    { color: "#1e528e", position: 70 },
    { color: "#5b7983", position: 100 },
  ],
  [
    { color: "#1e528e", position: 0 },
    { color: "#265889", position: 50 },
    { color: "#9da671", position: 100 },
  ],
  [
    { color: "#1e528e", position: 0 },
    { color: "#728a7c", position: 50 },
    { color: "#e9ce5d", position: 100 },
  ],
  [
    { color: "#154277", position: 0 },
    { color: "#576e71", position: 30 },
    { color: "#e1c45e", position: 70 },
    { color: "#b26339", position: 100 },
  ],
  [
    { color: "#163C52", position: 0 },
    { color: "#4F4F47", position: 30 },
    { color: "#C5752D", position: 60 },
    { color: "#B7490F", position: 80 },
    { color: "#2F1107", position: 100 },
  ],
  [
    { color: "#071B26", position: 0 },
    { color: "#071B26", position: 30 },
    { color: "#8A3B12", position: 80 },
    { color: "#240E03", position: 100 },
  ],
  [
    { color: "#010A10", position: 30 },
    { color: "#59230B", position: 80 },
    { color: "#2F1107", position: 100 },
  ],
  [
    { color: "#090401", position: 50 },
    { color: "#4B1D06", position: 100 },
  ],
  [
    { color: "#00000c", position: 80 },
    { color: "#150800", position: 100 },
  ],
];

// Converts a given hour (0-23) to a CSS linear gradient string
export function toCSSGradient(hour: number): string {
  let css = "linear-gradient(to bottom,";
  const data = grads[hour];
  const len = data.length;
  for (let i = 0; i < len; i++) {
    const item = data[i];
    css += ` ${item.color} ${item.position}%`;
    if (i < len - 1) css += ",";
  }
  return css + ")";
}

export function calcHeatIndex(tempF: number, humidity: number): number {
  // Calculate the heat index using the formula
  let heatIndex =
    0.5 * (tempF + 61.0 + (tempF - 68.0) * 1.2 + humidity * 0.094);
  if ((tempF + heatIndex) / 2 > 80) {
    heatIndex =
      -42.379 +
      2.04901523 * tempF +
      10.14333127 * humidity -
      0.22475541 * tempF * humidity -
      0.00683783 * tempF * tempF -
      0.05481717 * humidity * humidity +
      0.00122874 * tempF * tempF * humidity +
      0.00085282 * tempF * humidity * humidity -
      0.00000199 * tempF * tempF * humidity * humidity;
    if (humidity < 13 && tempF > 80 && tempF < 112) {
      heatIndex -=
        ((13 - humidity) / 4) * Math.sqrt((17 - Math.abs(tempF - 95)) / 17); // low humidity correction
    }
    if (humidity > 85 && tempF > 80 && tempF < 87) {
      heatIndex += ((humidity - 85) / 10) * ((87 - tempF) / 5); // high humidity correction
    }
  }
  return heatIndex;
}

export function calcDewPointF(tempC: number, humidity: number): number {
  // Calculate the dew point using the formula from Lawrence MG (2005) The Relationship between Relative Humidity and the Dewpoint Temperature in Moist Air: A Simple Conversion and Applications. Bulletin of the American Meteorological Society, 86(2):225–234. https://doi.org/10.1175/BAMS-86-2-225
  // Eq 11:
  const tempK = tempC + 273.15; // Convert Celsius to Kelvin
  const dewPointK =
    tempK /
    (1 - (tempK * Math.log(humidity / 100)) / ((2.501 * 10 ** 6) / 461.5));
  return (dewPointK - 273.15) * (9 / 5) + 32; // Convert to Fahrenheit
}

export function dewPointEmoji(dewPointF: number): string {
  if (isNaN(dewPointF)) {
    return "";
  } else if (dewPointF < 50) {
    return "🏜️"; // Very dry
  } else if (dewPointF < 60) {
    return "🏖️"; // Comfortable
  } else if (dewPointF < 70) {
    return "💧"; // Humid
  } else {
    return "💦"; // Oppressive
  }
}

export function statusEmoji(fetchSuccess: boolean): string {
  if (fetchSuccess) {
    return "✅"; // Success
  } else {
    return "❌"; // Error
  }
}
export function timeoutStatusEmoji(fetchSuccess: boolean): string {
  if (fetchSuccess) {
    return ""; // Success
  } else {
    return "⏳"; // Timeout
  }
}

export function aqiToEmoji(AQI: number): string {
  if (AQI == undefined) {
    return ""; // If undefined, return empty string
  } else if (AQI <= 50) {
    return "🟢"; // Good
  } else if (AQI <= 100) {
    return "🟡"; // Moderate
  } else if (AQI <= 150) {
    return "🟠"; // Unhealthy for Sensitive Groups
  } else if (AQI <= 200) {
    return "🔴"; // Unhealthy
  } else if (AQI <= 300) {
    return "🟣"; // Very Unhealthy
  } else {
    return "⚫"; // Hazardous
  }
}

export function aqiCategoryToEmoji(category: number): string {
  if (category == undefined) {
    return ""; // If undefined, return empty string
  } else if (category === 1) {
    return "🟢"; // Good
  } else if (category === 2) {
    return "🟡"; // Moderate
  } else if (category === 3) {
    return "🟠"; // Unhealthy for Sensitive Groups
  } else if (category === 4) {
    return "🔴"; // Unhealthy
  } else if (category === 5) {
    return "🟣"; // Very Unhealthy
  } else {
    return "⚫"; // Hazardous
  }
}

export function windDirectionToEmoji(degrees: number): string {
  if (degrees == undefined || isNaN(degrees)) {
    return ""; // If undefined or NaN, return empty string
  }
  const directions = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

export function nwsForecastIconToEmoji(iconText: string): string {
  if (iconText == undefined) {
    return ""; // If undefined, return empty string
  }
  let forecastIcons = "";
  iconText = iconText.toLowerCase();
  if (iconText.includes("day/skc")) {
    forecastIcons += "🌞";
  }
  if (iconText.includes("night/skc")) {
    forecastIcons += "🌜";
  }
  if (iconText.includes("day/few")) {
    forecastIcons += "☀️";
  }
  if (iconText.includes("night/few")) {
    forecastIcons += "🌙";
  }
  if (iconText.includes("day/sct")) {
    forecastIcons += "⛅";
  }
  if (iconText.includes("night/sct")) {
    forecastIcons += "🌙☁️";
  }
  if (iconText.includes("day/bkn")) {
    forecastIcons += "🌥️";
  }
  if (iconText.includes("night/bkn")) {
    forecastIcons += "🌙☁️";
  }
  if (iconText.includes("day/ovc")) {
    forecastIcons += "☁️";
  }
  if (iconText.includes("night/ovc")) {
    forecastIcons += "☁️";
  }
  if (iconText.includes("wind")) {
    forecastIcons += "🌬️";
  }
  if (iconText.includes("snow")) {
    forecastIcons += "❄️";
  }
  if (iconText.includes("rain")) {
    forecastIcons += "🌧️";
  }
  if (iconText.includes("sleet")) {
    forecastIcons += "🧊🌨️";
  }
  if (iconText.includes("fzra")) {
    forecastIcons += "🧊🌧️";
  }
  if (iconText.includes("tsra")) {
    forecastIcons += "⛈️";
  }
  if (iconText.includes("tornado")) {
    forecastIcons += "🌪️";
  }
  if (iconText.includes("hurricane")) {
    forecastIcons += "🌀";
  }
  if (iconText.includes("tropical")) {
    forecastIcons += "🌀";
  }
  if (iconText.includes("dust")) {
    forecastIcons += "🌫️💨";
  }
  if (iconText.includes("smoke")) {
    forecastIcons += "🔥🌫️";
  }
  if (iconText.includes("haze")) {
    forecastIcons += "😶‍🌫️";
  }
  if (iconText.includes("hot")) {
    forecastIcons += "🥵";
  }
  if (iconText.includes("cold")) {
    forecastIcons += "🥶";
  }
  if (iconText.includes("blizzard")) {
    forecastIcons += "🌬️❄️";
  }
  if (iconText.includes("fog")) {
    forecastIcons += "🌫️";
  }
  return forecastIcons;
}

export function nwsAlertSeverityToEmoji(alertSeverity: string): string {
  if (alertSeverity == undefined) {
    return ""; // If undefined, return empty string
  }
  alertSeverity = alertSeverity.toUpperCase();
  if (alertSeverity.includes("MINOR")) {
    return "🟡"; // Minor
  } else if (alertSeverity.includes("MODERATE")) {
    return "🟠"; // Moderate
  } else if (alertSeverity.includes("SEVERE")) {
    return "🔴"; // Severe
  } else if (alertSeverity.includes("EXTREME")) {
    return "🚨🔴"; // Extreme
  } else {
    return ""; // Unknown
  }
}

export function nwsAlertResponseToEmoji(response: string): string {
  if (response == undefined) {
    return ""; // If undefined, return empty string
  }
  response = response.toUpperCase();
  if (response.includes("ΑLLCLEAR")) {
    return "👌"; // All clear
  } else if (response.includes("ASSESS")) {
    return "📋"; // Assess
  } else if (response.includes("MONITOR")) {
    return "🌐📺📻"; // Monitor
  } else if (response.includes("AVOID")) {
    return "⛔"; // Avoid
  } else if (response.includes("EXECUTE")) {
    return "➡️"; // Execute
  } else if (response.includes("PREPARE")) {
    return "🔦🥫🚰⚡🔋🎒"; // Prepare
  } else if (response.includes("EVACUATE")) {
    return "🚨🚗🛣️"; // Evacuate
  } else if (response.includes("SHELTER")) {
    return "🚨🏠"; // Shelter
  } else {
    return ""; // other
  }
}

export function nwsAlertEventToEmoji(event: string): string {
  if (event == undefined) {
    return ""; // If undefined, return empty string
  }
  let eventIcons = "";
  event = event.toUpperCase();
  if (event.includes("DUST")) {
    eventIcons += "🌫️💨"; // Dust
  }
  if (event.includes("SMOKE")) {
    eventIcons += "🔥🌫️"; // Smoke
  }
  if (event.includes("FIRE")) {
    eventIcons += "🔥"; // Fire
  }
  if (event.includes("AIR QUALITY")) {
    eventIcons += "🌫️😷"; // Air Quality
  }

  if (event.includes("FREEZE")) {
    eventIcons += "🥶"; // Freeze
  }
  if (event.includes("FREEZING")) {
    eventIcons += "🥶"; // Freezing
  }
  if (event.includes("FROST")) {
    eventIcons += "❄️🥶"; // Frost
  }
  if (event.includes("WINTER")) {
    eventIcons += "❄️🧊🌨️"; // Winter
  }
  if (event.includes("BLIZZARD")) {
    eventIcons += "🌬️❄️"; // Blizzard
  }
  if (event.includes("ICE")) {
    eventIcons += "🧊🌧️"; // Ice
  }
  if (event.includes("SNOW")) {
    eventIcons += "❄️"; // Snow
  }
  if (event.includes("COLD")) {
    eventIcons += "🥶"; // Freeze
  }

  if (event.includes("FOG")) {
    eventIcons += "🌫️"; // Fog
  }
  if (event.includes("THUNDERSTORM")) {
    eventIcons += "⛈️"; // Thunderstorm
  }
  if (event.includes("TORNADO")) {
    eventIcons += "🌪️"; // Tornado
  }
  if (event.includes("WIND")) {
    eventIcons += "🌬️"; // Wind
  }
  if (event.includes("GALE")) {
    eventIcons += "🌬️"; // Gale
  }

  if (event.includes("FLOOD")) {
    eventIcons += "🌊"; // Flood
  }
  if (event.includes("SQUALL")) {
    eventIcons += "🌬️🌊"; // Squall
  }
  if (event.includes("STORM SURGE")) {
    eventIcons += "🌊🚨"; // Storm Surge
  }

  if (event.includes("HEAT")) {
    eventIcons += "🥵"; // Heat
  }

  if (event.includes("TROPICAL")) {
    eventIcons += "🌀"; // Tropical
  }
  if (event.includes("HURRICANE")) {
    eventIcons += "🌀"; // Hurricane
  }
  if (event.includes("TYPHOON")) {
    eventIcons += "🌀"; // Typhoon
  }
  if (event.includes("TSUNAMI")) {
    eventIcons += "🌊🚨"; // Tsunami
  }

  if (event.includes("ADVISORY")) {
    eventIcons += "⚠️"; // Advisory
  }
  if (event.includes("WATCH")) {
    eventIcons += "👀"; // Watch
  }
  if (event.includes("WARNING")) {
    eventIcons += "🚨"; // Warning
  }
  if (event.includes("EVACUATION")) {
    eventIcons += "🚨🚗🛣️"; // Evacuation
  }
  return eventIcons;
}

export function userAgentIcon(userAgentStr: string): string {
  if (userAgentStr == undefined) {
    return ""; // If undefined, return empty string
  }
  let userAgentIcons = "";
  userAgentStr = userAgentStr.toLowerCase();
  if (userAgentStr.includes("windows")) {
    userAgentIcons += "💻🪟"; // Windows
  }
  if (userAgentStr.includes("macintosh")) {
    userAgentIcons += "💻🍏"; // Mac
  }
  if (userAgentStr.includes("linux")) {
    userAgentIcons += "💻🐧"; // Linux
  }
  if (userAgentStr.includes("android")) {
    userAgentIcons += "📱🤖"; // Android
  }
  if (userAgentStr.includes("iphone")) {
    userAgentIcons += "📱🍏"; // iPhone
  }
  if (userAgentStr.includes("ipad")) {
    userAgentIcons += "📱🍏"; // iPad
  }
  return userAgentIcons;
}
