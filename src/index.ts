/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

/* @cloudflare/workers-types package names are included in tsconfig.json */
import { getAssetFromKV, NotFoundError, MethodNotAllowedError } from '@cloudflare/kv-asset-handler'
// URL is available in the global scope of Cloudflare Workers
import manifestJSON from '__STATIC_CONTENT_MANIFEST'

export interface Env {
	WAQI_TOKEN: string;
	NWS_AGENT: string;
	AIRNOW_KEY: string;
	__STATIC_CONTENT: KVNamespace;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const start = performance.now();
		const timezone = typeof request.cf?.timezone === "string" ? request.cf.timezone : undefined;
		const dateFormat = new Intl.DateTimeFormat('en-US', {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: false,
			timeZone: timezone,
			timeZoneName: "short"
		});
		const localized_date = new Date(
			new Date().toLocaleString('en-US', { timeZone: timezone })
		);

		const assetManifest = JSON.parse(manifestJSON)
		const url = new URL(request.url); // URL is available in the global scope of Cloudflare Workers

		// pull location data, use to generate API requests
		const latitude = request.cf?.latitude;
		const longitude = request.cf?.longitude;
		// WAQI API setup https://aqicn.org/api/
		const waqiApiRequestUrl = `https://api.waqi.info/feed/geo:${latitude};${longitude}/?token=${env.WAQI_TOKEN}`;
		const waqiRequestInit = {
			headers: {
				'content-type': 'application/json;charset=UTF-8',
			},
		};
		// https://www.weather.gov/documentation/services-web-api API setup
		const nwsPointsRequestUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
		const nwsRequestInit = {
			headers: {
				'accept': 'application/geo+json',
				'User-Agent': env.NWS_AGENT, // ID to send to weather.gov API
			},
		};
		// AirNow API setup https://docs.airnowapi.org/CurrentObservationsByLatLon/query
		const airnowSensorRequestUrl = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${latitude}&longitude=${longitude}&distance=75&API_KEY=${env.AIRNOW_KEY}`;
		const airnowForecastRequestUrl = `https://www.airnowapi.org/aq/forecast/latLong/?format=application/json&latitude=${latitude}&longitude=${longitude}&date=&distance=75&API_KEY=${env.AIRNOW_KEY}`;
		const airnowRequestInit = {
			headers: {
				'content-type': 'application/json;charset=UTF-8',
			},
		};


		// performance JSON object
		const timing = {
			renderHead: NaN,
			renderGeolocation: NaN,
			renderWeather: NaN,
			renderForecast: NaN,
			renderFooter: NaN,
			renderTotal: NaN,
		}
		// The `fetchTimeout` constant defines the maximum time (in milliseconds) to wait for a response from an API request.
		// A value of 3000ms (3 seconds) was chosen as a balance between user experience and network latency,
		// ensuring that the application does not hang indefinitely while waiting for a response.
		const fetchTimeout = 3000;

		// web mercator conversion (degrees to meters) https://wiki.openstreetmap.org/wiki/Mercator
		const PI = Math.PI;
		const DEG2RAD = PI / 180;
		const R = 6378137.0;
		function lat2y(lat: number) {
			return Math.log(Math.tan(PI / 4 + lat * DEG2RAD / 2)) * R
		}
		function lon2x(lon: number) {
			return lon * DEG2RAD * R;
		}

		// gradient data for background color
		const grads = [
			[
				{ color: '#00000c', position: 0 },
				{ color: '#00000c', position: 0 },
			],
			[
				{ color: '#020111', position: 85 },
				{ color: '#191621', position: 100 },
			],
			[
				{ color: '#020111', position: 60 },
				{ color: '#20202c', position: 100 },
			],
			[
				{ color: '#020111', position: 10 },
				{ color: '#3a3a52', position: 100 },
			],
			[
				{ color: '#20202c', position: 0 },
				{ color: '#515175', position: 100 },
			],
			[
				{ color: '#40405c', position: 0 },
				{ color: '#6f71aa', position: 80 },
				{ color: '#8a76ab', position: 100 },
			],
			[
				{ color: '#4a4969', position: 0 },
				{ color: '#7072ab', position: 50 },
				{ color: '#cd82a0', position: 100 },
			],
			[
				{ color: '#757abf', position: 0 },
				{ color: '#8583be', position: 60 },
				{ color: '#eab0d1', position: 100 },
			],
			[
				{ color: '#82addb', position: 0 },
				{ color: '#ebb2b1', position: 100 },
			],
			[
				{ color: '#94c5f8', position: 1 },
				{ color: '#a6e6ff', position: 70 },
				{ color: '#b1b5ea', position: 100 },
			],
			[
				{ color: '#b7eaff', position: 0 },
				{ color: '#94dfff', position: 100 },
			],
			[
				{ color: '#9be2fe', position: 0 },
				{ color: '#67d1fb', position: 100 },
			],
			[
				{ color: '#90dffe', position: 0 },
				{ color: '#38a3d1', position: 100 },
			],
			[
				{ color: '#57c1eb', position: 0 },
				{ color: '#246fa8', position: 100 },
			],
			[
				{ color: '#2d91c2', position: 0 },
				{ color: '#1e528e', position: 100 },
			],
			[
				{ color: '#2473ab', position: 0 },
				{ color: '#1e528e', position: 70 },
				{ color: '#5b7983', position: 100 },
			],
			[
				{ color: '#1e528e', position: 0 },
				{ color: '#265889', position: 50 },
				{ color: '#9da671', position: 100 },
			],
			[
				{ color: '#1e528e', position: 0 },
				{ color: '#728a7c', position: 50 },
				{ color: '#e9ce5d', position: 100 },
			],
			[
				{ color: '#154277', position: 0 },
				{ color: '#576e71', position: 30 },
				{ color: '#e1c45e', position: 70 },
				{ color: '#b26339', position: 100 },
			],
			[
				{ color: '#163C52', position: 0 },
				{ color: '#4F4F47', position: 30 },
				{ color: '#C5752D', position: 60 },
				{ color: '#B7490F', position: 80 },
				{ color: '#2F1107', position: 100 },
			],
			[
				{ color: '#071B26', position: 0 },
				{ color: '#071B26', position: 30 },
				{ color: '#8A3B12', position: 80 },
				{ color: '#240E03', position: 100 },
			],
			[
				{ color: '#010A10', position: 30 },
				{ color: '#59230B', position: 80 },
				{ color: '#2F1107', position: 100 },
			],
			[
				{ color: '#090401', position: 50 },
				{ color: '#4B1D06', position: 100 },
			],
			[
				{ color: '#00000c', position: 80 },
				{ color: '#150800', position: 100 },
			],
		];
		async function toCSSGradient(hour: number) {
			let css = 'linear-gradient(to bottom,';
			const data = grads[hour];
			const len = data.length;
			for (let i = 0; i < len; i++) {
				const item = data[i];
				css += ` ${item.color} ${item.position}%`;
				if (i < len - 1) css += ',';
			}
			return css + ')';
		}
		async function aqiToEmoji(AQI: number) {
			if (AQI == undefined) {
				return '';	// If undefined, return empty string
			}
			else if (AQI <= 50) {
				return '🟢';  // Good
			}
			else if (AQI <= 100) {
				return '🟡';  // Moderate
			}
			else if (AQI <= 150) {
				return '🟠';  // Unhealthy for Sensitive Groups
			}
			else if (AQI <= 200) {
				return '🔴';  // Unhealthy
			}
			else if (AQI <= 300) {
				return '🟣';  // Very Unhealthy
			}
			else {
				return '⚫';  // Hazardous
			}
		}
		async function aqiCategoryToEmoji(category: number) {
			if (category == undefined) {
				return '';	// If undefined, return empty string
			}
			else if (category === 1) {
				return '🟢';  // Good
			}
			else if (category === 2) {
				return '🟡';  // Moderate
			}
			else if (category === 3) {
				return '🟠';  // Unhealthy for Sensitive Groups
			}
			else if (category === 4) {
				return '🔴';  // Unhealthy
			}
			else if (category === 5) {
				return '🟣';  // Very Unhealthy
			}
			else {
				return '⚫';  // Hazardous
			}
		}
		async function nwsForecastIconToEmoji(iconText: string) {
			if (iconText == undefined) {
				return '';	// If undefined, return empty string
			}
			let forecastIcons = '';
			iconText = iconText.toLowerCase();
			if (iconText.includes('day/skc')) {
				forecastIcons += '🌞';
			}
			if (iconText.includes('night/skc')) {
				forecastIcons += '🌜';
			}
			if (iconText.includes('day/few')) {
				forecastIcons += '☀️';
			}
			if (iconText.includes('night/few')) {
				forecastIcons += '🌙';
			}
			if (iconText.includes('day/sct')) {
				forecastIcons += '⛅';
			}
			if (iconText.includes('night/sct')) {
				forecastIcons += '🌙☁️';
			}
			if (iconText.includes('day/bkn')) {
				forecastIcons += '🌥️';
			}
			if (iconText.includes('night/bkn')) {
				forecastIcons += '🌙☁️';
			}
			if (iconText.includes('day/ovc')) {
				forecastIcons += '☁️';
			}
			if (iconText.includes('night/ovc')) {
				forecastIcons += '☁️';
			}
			if (iconText.includes('wind')) {
				forecastIcons += '🌬️';
			}
			if (iconText.includes('snow')) {
				forecastIcons += '❄️';
			}
			if (iconText.includes('rain')) {
				forecastIcons += '🌧️';
			}
			if (iconText.includes('sleet')) {
				forecastIcons += '🧊🌨️';
			}
			if (iconText.includes('fzra')) {
				forecastIcons += '🧊🌧️';
			}
			if (iconText.includes('tsra')) {
				forecastIcons += '⛈️';
			}
			if (iconText.includes('tornado')) {
				forecastIcons += '🌪️';
			}
			if (iconText.includes('hurricane')) {
				forecastIcons += '🌀';
			}
			if (iconText.includes('tropical')) {
				forecastIcons += '🌀';
			}
			if (iconText.includes('dust')) {
				forecastIcons += '🌫️💨';
			}
			if (iconText.includes('smoke')) {
				forecastIcons += '🔥🌫️';
			}
			if (iconText.includes('haze')) {
				forecastIcons += '😶‍🌫️';
			}
			if (iconText.includes('hot')) {
				forecastIcons += '🥵';
			}
			if (iconText.includes('cold')) {
				forecastIcons += '🥶';
			}
			if (iconText.includes('blizzard')) {
				forecastIcons += '🌬️❄️';
			}
			if (iconText.includes('fog')) {
				forecastIcons += '🌫️';
			}
			return forecastIcons;
		}
		async function nwsAlertSeverityToEmoji(alertSeverity: string) {
			if (alertSeverity == undefined) {
				return '';	// If undefined, return empty string
			}
			alertSeverity = alertSeverity.toUpperCase();
			if (alertSeverity.includes('MINOR')) {
				return '🟡';  // Minor
			} else if (alertSeverity.includes('MODERATE')) {
				return '🟠';  // Moderate
			} else if (alertSeverity.includes('SEVERE')) {
				return '🔴';  // Severe
			} else if (alertSeverity.includes('EXTREME')) {
				return '🚨🔴';  // Extreme
			} else {
				return '';  // Unknown
			}
		}
		async function nwsAlertResponseToEmoji(response: string) {
			if (response == undefined) {
				return '';	// If undefined, return empty string
			}
			response = response.toUpperCase();
			if (response.includes('ΑLLCLEAR')) {
				return '👌';  // All clear
			} else if (response.includes('ASSESS')) {
				return '📋';  // Assess
			} else if (response.includes('MONITOR')) {
				return '🌐📺📻';  // Monitor
			} else if (response.includes('AVOID')) {
				return '⛔';  // Avoid
			} else if (response.includes('EXECUTE')) {
				return '➡️';  // Execute
			} else if (response.includes('PREPARE')) {
				return '🔦🥫🚰⚡🔋🎒';  // Prepare
			} else if (response.includes('EVACUATE')) {
				return '🚨🚗🛣️';  // Evacuate
			} else if (response.includes('SHELTER')) {
				return '🚨🏠';  // Shelter
			} else {
				return '';  // other
			}
		}
		async function nwsAlertEventToEmoji(event: string) {
			if (event == undefined) {
				return '';	// If undefined, return empty string
			}
			let eventIcons = '';
			event = event.toUpperCase();
			if (event.includes('WINTER')) {
				eventIcons += '❄️🧊🌨️';  // Winter
			}
			if (event.includes('BLIZZARD')) {
				eventIcons += '🌬️❄️';  // Blizzard
			}
			if (event.includes('ICE')) {
				eventIcons += '🧊🌧️';  // Ice
			}
			if (event.includes('COLD')) {
				eventIcons += '🥶';  // Freeze
			}
			if (event.includes('FOG')) {
				eventIcons += '🌫️';  // Fog
			}
			if (event.includes('THUNDERSTORM')) {
				eventIcons += '⛈️';  // Thunderstorm
			}
			if (event.includes('TORNADO')) {
				eventIcons += '🌪️';  // Tornado
			}
			if (event.includes('WIND')) {
				eventIcons += '🌬️';  // Wind
			}
			if (event.includes('FLOOD')) {
				eventIcons += '🌊';  // Flood
			}
			if (event.includes('HEAT')) {
				eventIcons += '🥵';  // Heat
			}
			if (event.includes('TROPICAL')) {
				eventIcons += '🌀';  // Tropical
			}
			if (event.includes('HURRICANE')) {
				eventIcons += '🌀';  // Hurricane
			}
			if (event.includes('ADVISORY')) {
				eventIcons += '⚠️';  // Advisory
			}
			if (event.includes('WATCH')) {
				eventIcons += '👀';  // Watch
			}
			if (event.includes('WARNING')) {
				eventIcons += '🚨';  // Warning
			}
			return eventIcons;
		}
		async function userAgentIcon(userAgentStr: string) {
			if (userAgentStr == undefined) {
				return '';	// If undefined, return empty string
			}
			let userAgentIcons = '';
			userAgentStr = userAgentStr.toLowerCase();
			if (userAgentStr.includes('windows')) {
				userAgentIcons += '💻🪟';  // Windows
			}
			if (userAgentStr.includes('macintosh')) {
				userAgentIcons += '💻🍏';  // Mac
			}
			if (userAgentStr.includes('linux')) {
				userAgentIcons += '💻🐧';  // Linux
			}
			if (userAgentStr.includes('android')) {
				userAgentIcons += '📱🤖';  // Android
			}
			if (userAgentStr.includes('iphone')) {
				userAgentIcons += '📱🍏';  // iPhone
			}
			if (userAgentStr.includes('ipad')) {
				userAgentIcons += '📱🍏';  // iPad
			}
			return userAgentIcons;
		}
		const intFormatTwoDigit = new Intl.NumberFormat('en-US', {
			minimumIntegerDigits: 2,
		});
		const floatFormat = new Intl.NumberFormat('en-US', {
			maximumFractionDigits: 1,
		});

		// fetch URL helper *******************************************************
		// adapted from https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Async_JS/Promises
		// use fetchEnabled to quickly return null and resolve Promise if fetch is unnecessary
		async function fetchProducts(url: string, options: RequestInit, fetchEnabled: boolean = true) {
			if (!fetchEnabled) {
				return null;
			}
			try {
				const controller = new AbortController();
				const timeoutID = setTimeout(() => controller.abort(`Abort Error (timeout ${fetchTimeout} ms)`), fetchTimeout);

				// after this line, our function will wait for the `fetch()` call to be settled
				// the `fetch()` call will either return a Response or log an error
				// add signal from AbortController to abort after a timeout period
				const response = await fetch(url, { ...options, signal: controller.signal });

				clearTimeout(timeoutID);
				if (!response.ok) {
					console.log({ response_url: response.url, response_status: response.status, response_statusText: response.statusText });
					return null;
				} else {
					// after this line, our function will wait for the `response.json()` call to be settled
					// the `response.json()` call will either return the parsed JSON object or log an error
					const data = await response.json();
					return data;
				}
			} catch (e) {
				console.log({ request_url: url, error: e, error_stack: (e as Error).stack });
				return null;
			}
		}


		// build HTML *******************************************************
		async function renderHead() {
			const start = performance.now();

			const hour = localized_date.getHours();
			let accentColor = '#f6821f';
			let textColor = 'white';
			if (hour >= 7 && hour < 13) {
				accentColor = 'black';
				textColor = 'black';
			}

			const html_style = `body{padding:2em; font-family:'Source Sans 3','Source Sans Pro',sans-serif; color:${textColor}; margin:0 !important; height:100%; font-size:clamp(1rem, 0.96rem + 0.18vw, 1.125rem);}
 footer { padding: 3px; font-size:clamp(0.8rem, 0.96rem + 0.18vw, 1rem);}
 #container{display: flex; flex-direction:column;min-height: 100%;}
 body{background: ${await toCSSGradient(hour)};} h1{color: ${accentColor};} p{margin: 0.3em;} a{color: ${accentColor};} a:hover{color: ${textColor};}
 .collapsible {  background-color: #8A3B12;  color: white;  font-family:'Source Sans 3','Source Sans Pro',sans-serif;  font-size:clamp(1rem, 0.96rem + 0.18vw, 1.125rem);  cursor: pointer;  padding: 18px;  width: 100%;  border: none;  text-align: left;  outline: none; }
 .active, .collapsible:hover {  background-color: #59230B;}
 .collapsible:after {  content: '➕';  color: white;  font-weight: bold;  float: right;  margin-left: 5px;} .active:after {  content: '➖';}
 .content {  padding: 0 18px;  max-height: 0;  overflow: hidden;  transition: max-height 0.2s ease-out;  color: white;  background-color: #8A3B12;}`;
			const html_head = `<!DOCTYPE html>
<html lang="en">
<head>
	<title>IP Geolocation 🌐 + Weather 🌦</title>
	<meta charset="utf-8">
	<meta name="description" content="IP Geolocation and Weather information">
	<meta name="viewport" content="width=device-width" />
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
	<link rel="apple-touch-icon" href="/favicon.ico">
	<link rel="preconnect" href="https://www.openstreetmap.org" />
	<link rel="preconnect" href="https://radar.weather.gov" />
	<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
	<style> ${html_style} </style>
</head>
<body>
<div id="container">`;

			timing.renderHead = performance.now() - start;
			return html_head;
		}

		async function renderGeolocation() {
			const start = performance.now();
			const clientIP = request.headers.get('CF-Connecting-IP');
			const clientASN = request.cf?.asn;
			const clientISP = request.cf?.asOrganization;

			const html_content = `  <h1>IP Geolocation 🌐</h1>
  <p> Public IP: ${clientIP} (<a href="https://radar.cloudflare.com/ip/${clientIP}">Cloudflare radar</a>)</p>
  <p> ISP: ${clientISP}, ASN: ${clientASN} (<a href="https://radar.cloudflare.com/quality/as${clientASN}">Cloudflare radar</a>)</p>
  <iframe loading="lazy" title="OpenStreetMap widget" width="425" height="350" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://www.openstreetmap.org/export/embed.html?bbox=${(parseFloat(longitude) - 0.35)}%2C${(parseFloat(latitude) - 0.35)}%2C${(parseFloat(longitude) + 0.35)}%2C${(parseFloat(latitude) + 0.35)}&amp;layer=mapnik&amp;marker=${latitude}%2C${longitude}" style="border: 1px solid black; max-width: 100%;"></iframe>
  <p> Coordinates: <a href="https://www.openstreetmap.org/?mlat=${latitude}&amp;mlon=${longitude}#map=9/${latitude}/${longitude}">(${latitude}, ${longitude})</a>, Timezone: ${timezone}</p>
  <p> City: ${request.cf?.city}, <a href="https://en.wikipedia.org/wiki/List_of_television_stations_in_North_America_by_media_market">US DMA Code</a>: ${request.cf?.metroCode}</p>
  <p> <a href="https://en.wikipedia.org/wiki/ISO_3166-2">Region</a>: ${request.cf?.region}, RegionCode: ${request.cf?.regionCode}, PostalCode: ${request.cf?.postalCode}</p>
  <p> Country: ${request.cf?.country},  Continent: ${request.cf?.continent}</p>`;

			timing.renderGeolocation = performance.now() - start;
			return html_content;
		}

		async function renderWeather() {
			const start = performance.now();
			let html_content = '  <h1>Weather 🌦</h1>';

			// issue concurrent requests to WAQI, NWS, AirNow APIs
			let waqiData = undefined;
			let nwsPointsData = undefined;
			let airnowSensorData = undefined;
			try {
				[waqiData, nwsPointsData, airnowSensorData] = await Promise.allSettled([
					fetchProducts(waqiApiRequestUrl, waqiRequestInit, true),
					fetchProducts(nwsPointsRequestUrl, nwsRequestInit, request.cf?.country.toUpperCase().includes('US')),
					fetchProducts(airnowSensorRequestUrl, airnowRequestInit, request.cf?.country.toUpperCase().includes('US')),
				]);
			}
			catch (e) {
				html_content += `<p> Error: ${e}</p>`;
				html_content += `<p> ${(e as Error).stack}</p>`;
				console.log({ error: e, error_stack: (e as Error).stack });
			}
			const waqiRequestSuccess = !(waqiData == undefined) && waqiData.status === 'fulfilled' && !(waqiData.value == undefined);
			const nwsPointsRequestSuccess = !(nwsPointsData == undefined) && nwsPointsData.status === 'fulfilled' && !(nwsPointsData.value == undefined) && 'properties' in nwsPointsData.value
			const airnowSensorRequestSuccess = !(airnowSensorData == undefined) && airnowSensorData.status === 'fulfilled' && Array.isArray(airnowSensorData.value) && airnowSensorData.value.length > 0;
			// parse responses if successful
			if (waqiRequestSuccess) {
				waqiData = waqiData?.value.data;
			} else {
				waqiData = undefined;
			}
			if (nwsPointsRequestSuccess) {
				nwsPointsData = nwsPointsData?.value.properties;
			} else {
				nwsPointsData = undefined;
			}
			if (airnowSensorRequestSuccess) {
				airnowSensorData = airnowSensorData?.value;
			} else {
				airnowSensorData = undefined;
			}

			// ********************************************************************************************************************
			// parse AirNow response
			const airnowPM25 = {
				AQI: undefined,
				category: undefined
			};
			const airnowPM10 = {
				AQI: undefined,
				category: undefined
			};
			const airnowO3 = {
				AQI: undefined,
				category: undefined
			};
			const airnowOverall = {
				AQI: undefined,
				category: undefined
			};
			if (!(airnowSensorData == undefined)) {
				for (let i = 0; i < airnowSensorData.length; i++) {
					if (i === 0 || airnowSensorData[i]?.AQI > (airnowOverall.AQI ?? -1)) {
						airnowOverall.AQI = airnowSensorData[i]?.AQI;
						airnowOverall.category = airnowSensorData[i]?.Category.Name;
					}
					let airnowParameterName = airnowSensorData[i]?.ParameterName.toUpperCase();
					if (airnowParameterName.includes('PM2.5')) {
						airnowPM25.AQI = airnowSensorData[i]?.AQI;
						airnowPM25.category = airnowSensorData[i]?.Category.Name;
					}
					else if (airnowParameterName.includes('PM10')) {
						airnowPM10.AQI = airnowSensorData[i]?.AQI;
						airnowPM10.category = airnowSensorData[i]?.Category.Name;
					}
					else if (airnowParameterName.includes('O3')) {
						airnowO3.AQI = airnowSensorData[i]?.AQI;
						airnowO3.category = airnowSensorData[i]?.Category.Name;
					}
				}
			}

			// temperature data
			const tempF = !(waqiData == undefined) ? parseFloat(waqiData.iaqi.t?.v) * 9 / 5 + 32 : NaN; //deg C to deg F
			const humidity = !(waqiData == undefined) ? waqiData.iaqi.h?.v : NaN;
			const windSpeed = !(waqiData == undefined) ? parseFloat(waqiData.iaqi.w?.v) * 2.23694 : NaN; // m/s to mph
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

			// ********************************************************************************************************************
			// build HTML content
			html_content += `<p> Temperature: ${floatFormat.format(tempF)} °F (${floatFormat.format(!(waqiData == undefined) ? waqiData.iaqi.t?.v : NaN)} °C)</p>`;
			// if within range, print heat index
			//if (tempF > 80 && humidity > 40) {
			if (heatIndex > 80) {
				html_content += `<p> Feels like: ${floatFormat.format(heatIndex)} °F (<a href="https://www.weather.gov/safety/heat-index">heat index</a>)</p>`;
			}
			// if within range, print wind chill
			if (windChill < 40) {
				html_content += `<p> Feels like: ${floatFormat.format(windChill)} °F (<a href="https://www.weather.gov/safety/cold-wind-chill-chart">wind chill</a>)</p>`;
			}

			html_content += `<p> Relative humidity: ${humidity}&percnt;</p>`;
			html_content += `<p> Wind speed: ${floatFormat.format(windSpeed)} mph</p>`;

			// air quality data
			html_content += `<p> Overall: ${await aqiToEmoji(!(waqiData == undefined) ? waqiData.aqi : undefined)} ${!(waqiData == undefined) ? (waqiData.aqi + ' AQI') : 'N/A'} `;
			if (!(airnowOverall.AQI == undefined)) {
				html_content += ` (AirNow: ${await aqiToEmoji(airnowOverall.AQI)} ${airnowOverall.AQI} AQI, ${airnowOverall.category})</p>`;
			}
			else {
				html_content += `</p>`;
			}
			html_content += `<p> PM<sub>2.5</sub>: ${await aqiToEmoji(!(waqiData == undefined) ? waqiData.iaqi.pm25?.v : undefined)} ${!(waqiData == undefined) ? (waqiData.iaqi.pm25?.v + ' AQI') : 'N/A'} `;
			if (!(airnowPM25.AQI == undefined)) {
				html_content += ` (<a href="https://gispub.epa.gov/airnow/?showlegend=no&xmin=${lon2x(longitude) - 200000}&xmax=${lon2x(longitude) + 200000}&ymin=${lat2y(latitude) - 200000}&ymax=${lat2y(latitude) + 200000}&monitors=pm25&contours=pm25">AirNow</a>: ${await aqiToEmoji(airnowPM25.AQI)} ${airnowPM25.AQI} AQI, ${airnowPM25.category})</p>`;
			}
			else {
				html_content += `</p>`;
			}
			html_content += `<p> PM<sub>10</sub>: ${await aqiToEmoji(!(waqiData == undefined) ? waqiData.iaqi.pm10?.v : undefined)} ${!(waqiData == undefined) ? (waqiData.iaqi.pm10?.v + ' AQI') : 'N/A'} `;
			if (!(airnowPM10.AQI == undefined)) {
				html_content += ` (<a href="https://gispub.epa.gov/airnow/?showlegend=no&xmin=${lon2x(longitude) - 200000}&xmax=${lon2x(longitude) + 200000}&ymin=${lat2y(latitude) - 200000}&ymax=${lat2y(latitude) + 200000}&monitors=pm10&contours=ozonepm">AirNow</a>: ${await aqiToEmoji(airnowPM10.AQI)} ${airnowPM10.AQI} AQI, ${airnowPM10.category})</p>`;
			}
			else {
				html_content += `</p>`;
			}
			html_content += `<p> O<sub>3</sub> (ozone): ${await aqiToEmoji(!(waqiData == undefined) ? waqiData.iaqi.o3?.v : undefined)} ${!(waqiData == undefined) ? (waqiData.iaqi.o3?.v + ' AQI') : 'N/A'} `;
			if (!(airnowO3.AQI == undefined)) {
				html_content += ` (<a href="https://gispub.epa.gov/airnow/?showlegend=no&xmin=${lon2x(longitude) - 200000}&xmax=${lon2x(longitude) + 200000}&ymin=${lat2y(latitude) - 200000}&ymax=${lat2y(latitude) + 200000}&contours=ozonepm&monitors=ozone">AirNow</a>: ${await aqiToEmoji(airnowO3.AQI)} ${airnowO3.AQI} AQI, ${airnowO3.category})</p>`;
			}
			else {
				html_content += `</p>`;
			}
			html_content += `<p> NO<sub>2</sub> (nitrogen dioxide): ${await aqiToEmoji(!(waqiData == undefined) ? waqiData.iaqi.no2?.v : undefined)} ${!(waqiData == undefined) ? (waqiData.iaqi.no2?.v + ' AQI') : 'N/A'}</p>`;
			html_content += `<p> SO<sub>2</sub> (sulphur dioxide): ${await aqiToEmoji(!(waqiData == undefined) ? waqiData.iaqi.so2?.v : undefined)} ${!(waqiData == undefined) ? (waqiData.iaqi.so2?.v + ' AQI') : 'N/A'}</p>`;
			html_content += `<p> CO (carbon monoxide): ${await aqiToEmoji(!(waqiData == undefined) ? waqiData.iaqi.co?.v : undefined)} ${!(waqiData == undefined) ? (waqiData.iaqi.co?.v + ' AQI') : 'N/A'}</p>`;

			// add NWS radar loop if available
			if (!(nwsPointsData == undefined)) {
				html_content += `<p> <a href="https://radar.weather.gov/station/${nwsPointsData?.radarStation}/standard"><img loading="lazy" src="https://radar.weather.gov/ridge/standard/${nwsPointsData?.radarStation}_loop.gif" width="600" height="550" alt="radar loop" style="max-width: 100%; height: auto;"></a></p>`;
			}

			if (!(waqiData == undefined)) {
				const waqiTime = dateFormat.format(new Date(waqiData.time.iso));
				html_content += `<p> Sensor data from <a href="${waqiData.city.url}">${waqiData.city.name}</a>, measured on ${waqiTime}</p>`;
			}
			if (!(airnowSensorData == undefined)) {
				const firstAirnowSensor = airnowSensorData[0];
				html_content += `<p> AirNow data from <a href="https://www.openstreetmap.org/?mlat=${firstAirnowSensor.Latitude}&amp;mlon=${firstAirnowSensor.Longitude}#map=9/${firstAirnowSensor.Latitude}/${firstAirnowSensor.Longitude}">${firstAirnowSensor.ReportingArea}, ${firstAirnowSensor.StateCode}</a>, measured on ${firstAirnowSensor.DateObserved}, ${firstAirnowSensor.HourObserved}:00 ${firstAirnowSensor.LocalTimeZone}</p>`;
			}
			// html_content += `<p><iframe loading="lazy" title="Airnow widget" height="230" width="230" src="https://widget.airnow.gov/aq-dial-widget-primary-pollutant/?latitude=${latitude}&longitude=${longitude}&transparent=true" style="border: none; border-radius: 25px;"></iframe></p>`

			timing.renderWeather = performance.now() - start;
			return [html_content, waqiData, nwsPointsData, airnowSensorData];
		}

		async function renderForecast(
			waqiData: any,
			nwsPointsData: any,
			airnowSensorData: any
		): Promise<string> {
			const start = performance.now();

			// prepare to fetch data from APIs
			const tomorrow = new Date(localized_date);
			tomorrow.setDate(localized_date.getDate() + 1);
			const airnowDateStr = [
				`${localized_date.getFullYear()}-${intFormatTwoDigit.format(localized_date.getMonth() + 1)}-${intFormatTwoDigit.format(localized_date.getDate())}`,
				`${tomorrow.getFullYear()}-${intFormatTwoDigit.format(tomorrow.getMonth() + 1)}-${intFormatTwoDigit.format(tomorrow.getDate())}`
			];
			const dayStr = ['Today', 'Tomorrow'];

			let html_content = '';
			let nwsCounty = undefined;
			if (!(nwsPointsData == undefined)) {
				nwsCounty = nwsPointsData.county.split('/');
				nwsCounty = nwsCounty ? nwsCounty[nwsCounty.length - 1] : undefined;
			}

			// grab NWS, airnow forecasts if available
			const nwsAlertRequestUrl = `https://api.weather.gov/alerts/active/zone/${nwsCounty}`;
			let nwsAlertData = undefined;
			let nwsForecastData = undefined;
			let airnowForecastData = undefined;
			try {
				[nwsAlertData, nwsForecastData, airnowForecastData] = await Promise.allSettled([
					fetchProducts(nwsAlertRequestUrl, nwsRequestInit, !(nwsPointsData == undefined)),
					fetchProducts(
						!(nwsPointsData == undefined) ? nwsPointsData.forecast : undefined,
						nwsRequestInit,
						!(nwsPointsData == undefined)
					),
					fetchProducts(airnowForecastRequestUrl, airnowRequestInit, !(airnowSensorData == undefined)),
				]);
			} catch (e) {
				html_content += `<p> Error: ${e}</p>`;
				html_content += `<p> ${(e as Error).stack}</p>`;
				console.log({ error: e, error_stack: (e as Error).stack });
			}
			const nwsAlertRequestSuccess =
				!(nwsAlertData == undefined) &&
				nwsAlertData.status === 'fulfilled' &&
				Array.isArray(nwsAlertData.value?.features) &&
				nwsAlertData.value.features.length > 0;
			const nwsForecastRequestSuccess =
				!(nwsForecastData == undefined) &&
				nwsForecastData.status === 'fulfilled' &&
				!(nwsForecastData.value == undefined) &&
				'properties' in nwsForecastData.value;
			const airnowForecastRequestSuccess =
				!(airnowForecastData == undefined) &&
				airnowForecastData.status === 'fulfilled' &&
				Array.isArray(airnowForecastData.value) &&
				airnowForecastData.value.length > 0;
			// parse responses if successful
			if (nwsAlertRequestSuccess) {
				nwsAlertData = nwsAlertData?.value.features;
			} else {
				nwsAlertData = undefined;
			}
			if (nwsForecastRequestSuccess) {
				nwsForecastData = nwsForecastData?.value.properties;
			} else {
				nwsForecastData = undefined;
			}
			if (airnowForecastRequestSuccess) {
				airnowForecastData = airnowForecastData?.value;
			} else {
				airnowForecastData = undefined;
			}

			// ********************************************************************************************************************
			// build HTML content
			if (nwsAlertRequestSuccess || nwsForecastRequestSuccess || airnowForecastRequestSuccess) {
				html_content += ` <h3>Forecast 🔮</h3>`;
			}
			if (!(nwsPointsData == undefined)) {
				if (nwsForecastRequestSuccess || nwsAlertRequestSuccess) {
					html_content += `<p> NWS (<a href="https://www.weather.gov/${nwsPointsData?.gridId}/">${nwsPointsData?.gridId} forecast office</a>):<br /><ul>`;
				}
				// parse alert data
				if (nwsAlertRequestSuccess) {
					html_content += `<li>Alerts ⚠️`;
					for (let i = 0; i < nwsAlertData.length; i++) {
						let alertInfo = nwsAlertData[i].properties;
						html_content += `<br /><button class="collapsible"> ${alertInfo?.response} ${await nwsAlertResponseToEmoji(
							alertInfo?.response
						)}, ${alertInfo?.severity} ${await nwsAlertSeverityToEmoji(alertInfo?.severity)}: ${alertInfo?.headline
							}</button><div class="content"><h3>${alertInfo?.event} ${await nwsAlertEventToEmoji(
								alertInfo?.event
							)}</h3><p>${alertInfo?.description}</p><p>Instruction: ${alertInfo?.instruction
							}</p><p>Status: ${alertInfo?.status}, Urgency: ${alertInfo?.urgency}, Certainty: ${alertInfo?.certainty
							}</p><p>Onset: ${dateFormat.format(new Date(alertInfo?.onset))}, Ends: ${dateFormat.format(
								new Date(alertInfo?.ends)
							)}</p><p>Affected areas: ${alertInfo?.areaDesc}</p><p>Sender: ${alertInfo?.senderName
							}, Sent: ${dateFormat.format(new Date(alertInfo?.sent))}, Expires: ${dateFormat.format(
								new Date(alertInfo?.expires)
							)}</p></div>`;
					}
					html_content += `</li>`;
				}
				// parse forecast data
				if (nwsForecastRequestSuccess) {
					for (let i = 0; i < Math.min(4, nwsForecastData.periods.length); i++) {
						html_content += `<li>${nwsForecastData.periods[i].name}: ${await nwsForecastIconToEmoji(
							nwsForecastData.periods[i].icon
						)} ${nwsForecastData.periods[i].detailedForecast}</li>`;
					}
				}
				html_content += `</ul></p>`;
			}

			if (airnowForecastRequestSuccess) {
				const firstAirnowForecast = airnowForecastData[0];
				html_content += `<p> AirNow forecast for <a href="https://www.openstreetmap.org/?mlat=${firstAirnowForecast.Latitude}&amp;mlon=${firstAirnowForecast.Longitude}#map=9/${firstAirnowForecast.Latitude}/${firstAirnowForecast.Longitude}">${firstAirnowForecast.ReportingArea}, ${firstAirnowForecast.StateCode}</a>:<br /><ul>`;
				let airnowDateIdx = 0;
				let newDate = true;
				for (let i = 0; i < airnowForecastData.length; i++) {
					let currAirnowData = airnowForecastData[i];
					// check if we should increment date
					if (
						airnowDateIdx < airnowDateStr.length - 1 &&
						currAirnowData.DateForecast === airnowDateStr[airnowDateIdx + 1]
					) {
						html_content += `</li>`;
						newDate = true;
						airnowDateIdx++;
					}
					// if date matches, then push data to HTML
					if (currAirnowData?.DateForecast === airnowDateStr[airnowDateIdx]) {
						if (newDate) {
							html_content += `<li>${dayStr[airnowDateIdx]}: `;
							if (currAirnowData?.ActionDay) {
								html_content += `Action day ⚠️<br />`;
							}
							newDate = false;
						} else {
							html_content += `<br />`;
						}
						html_content += `${currAirnowData.ParameterName}: ${await aqiCategoryToEmoji(currAirnowData.Category.Number)}`;
						if (currAirnowData?.AQI > 0) {
							html_content += ` ${currAirnowData.AQI} AQI,`;
						}
						html_content += ` ${currAirnowData.Category.Name}`;
					}
				}
				html_content += `</li>`;
				// add discussion if available
				if (!(firstAirnowForecast?.Discussion == undefined) && !(firstAirnowForecast?.Discussion === '')) {
					if (typeof firstAirnowForecast.Discussion === "string" && URL.canParse(firstAirnowForecast.Discussion)) {
						html_content += `<li><a href="${firstAirnowForecast.Discussion}">Discussion: ${firstAirnowForecast.Discussion}</a></li>`;
					} else {
						html_content += `<li><button class="collapsible">Discussion</button><div class="content"><p>${typeof firstAirnowForecast.Discussion === "string" ? firstAirnowForecast.Discussion : ""
							}</p></div></li>`;
					}
				}
				html_content += `</ul></p>`;
			}

			timing.renderForecast = performance.now() - start;
			return html_content;
		}

		async function renderFooter() {
			const start = performance.now();
			const userAgentStr = request.headers.get('User-Agent');

			const html_footer = `  <h1>Browser ${await userAgentIcon(userAgentStr)}</h1>
  <p> User Agent: ${userAgentStr}</p>
  <p> HTTP Version: ${request.cf?.httpProtocol}</p>
  <p> TLS Version: ${request.cf?.tlsVersion}</p>
  <p> TLS Cipher: ${request.cf?.tlsCipher}</p>
  <p> Cloudflare datacenter <a href="https://en.wikipedia.org/wiki/IATA_airport_code">IATA code</a>: ${request.cf?.colo}</p>
</div>
<script> /* Script borrowed from https://www.w3schools.com/howto/howto_js_collapsible.asp */
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
<footer>
  <p> Page generated on ${dateFormat.format(new Date())} in ${timing.renderHead + timing.renderGeolocation + timing.renderWeather + timing.renderForecast + performance.now() - start} ms.</p>
  <p> Script adapted from <a href="https://developers.cloudflare.com/workers/examples/">Cloudflare</a> and <a href="https://niksec.com/creating-a-simple-ip-check-tool-with-cloudflare-workers/">NikSec</a> examples.</p>
  <p> <a href="https://github.com/mdlew/ip">Fork this project on GitHub</a></p>
</footer>
</html>`;

			timing.renderFooter = performance.now() - start;
			return html_footer;
		}

		// render HTML
		async function renderPage(writer: WritableStreamDefaultWriter) {
			const encoder = new TextEncoder();

			writer.write(encoder.encode(await renderHead()));
			await writer.ready;
			writer.write(encoder.encode(await renderGeolocation()));

			const [html_content, waqiData, nwsPointsData, airnowSensorData] = await renderWeather();
			await writer.ready;
			writer.write(encoder.encode(html_content));
			await writer.ready;
			writer.write(encoder.encode(await renderForecast(waqiData, nwsPointsData, airnowSensorData)));
			await writer.ready;
			writer.write(encoder.encode(await renderFooter()));

			// Call ready to ensure that all chunks are written
			// before closing the writer.
			await writer.ready;
			// log performance
			timing.renderTotal = performance.now() - start;
			console.log(timing);

			return writer.close();
		}

		// Response logic ******************************************************

		// Return a new Response based on a URL's pathname
		const STATIC_URLS = ['/favicon.ico', '/favicon.svg', '/robots.txt'];
		const WORKER_URLS = ['/'];

		// return static asset
		if (STATIC_URLS.includes(url.pathname)) {
			async function MethodNotAllowed(request: Request) {
				console.log({ error: `Method ${request.method} not allowed` });
				return new Response(`Method ${request.method} not allowed.`, {
					status: 405,
					statusText: 'Method Not Allowed',
					headers: {
						Allow: 'GET',
					},
				});
			}
			// Only GET requests work with this proxy.
			if (request.method !== 'GET') {
				return MethodNotAllowed(request);
			}
			try {
				return await getAssetFromKV(
					{
						request,
						waitUntil(promise: Promise<any>) {
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
				console.log({ error: `"${pathname}" not found`, error_stack: (e as Error).stack });
				return new Response(`"${pathname}" not found`, {
					status: 404,
					statusText: 'Not Found',
				});
			}
		}

		// else do IP geolocation
		else {
			// set default security headers
			const myHeaders = new Headers({
				'content-type': 'text/html;charset=UTF-8',
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
			  'Permissions-Policy': 'interest-cohort=()',
			  */
				/*
			  X-XSS-Protection header prevents a page from loading if an XSS attack is detected.
			  @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection
			  */
				'X-XSS-Protection': '0',
				/*
			  X-Frame-Options header prevents click-jacking attacks.
			  @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options
			  */
				'X-Frame-Options': 'DENY',
				/*
			  X-Content-Type-Options header prevents MIME-sniffing.
			  @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options
			  */
				'X-Content-Type-Options': 'nosniff',
				'Referrer-Policy': 'strict-origin-when-cross-origin',
				'Cross-Origin-Embedder-Policy': 'require-corp; report-to="default";',
				'Cross-Origin-Opener-Policy': 'same-site; report-to="default";',
				'Cross-Origin-Resource-Policy': 'same-site',
			});

			if (!(request.cf?.tlsVersion.toUpperCase().includes('TLSV1.2') || request.cf?.tlsVersion.toUpperCase().includes('TLSV1.3'))) {
				console.log({ error: `TLS version error: "${request.cf?.tlsVersion}"` });
				return new Response('Please use TLS version 1.2 or higher.', {
					status: 403,
					statusText: 'Forbidden',
				});
			} else if (WORKER_URLS.includes(url.pathname)) {
				let { readable, writable } = new IdentityTransformStream();

				const writer = writable.getWriter();
				ctx.waitUntil(renderPage(writer));

				return new Response(readable, {
					headers: myHeaders,
				});
			} else {
				const pathname = url.pathname;
				console.log({ error: `"${pathname}" not found` });
				return new Response('Not found', {
					status: 404,
					statusText: 'Not Found',
				});
			}
		}
	},
} satisfies ExportedHandler<Env>;
