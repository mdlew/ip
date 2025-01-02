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
		const timezone = request.cf.timezone;
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

		const latitude = request.cf.latitude;
		const longitude = request.cf.longitude;

		// performance JSON object
		const timing = {
			renderHead: NaN,
			renderGeolocation: NaN,
			renderWeatherFirstFetch: NaN,
			renderWeather: NaN,
			renderFooter: NaN,
			renderTotal: NaN,
		}
		const fetchTimeout = 3000; // time to wait before assuming the server won't respond

		// web mercator conversion (degrees to meters) https://wiki.openstreetmap.org/wiki/Mercator
		const PI = Math.PI;
		const DEG2RAD = PI / 180;
		const R = 6378137.0;
		async function lat2y(lat: number) {
			return Math.log(Math.tan(PI / 4 + lat * DEG2RAD / 2)) * R
		}
		async function lon2x(lon: number) {
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
		async function AQItoEmoji(AQI: number) {
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
		async function categoryToEmoji(category: number) {
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
				// after this line, our function will wait for the `fetch()` call to be settled
				// the `fetch()` call will either return a Response or log an error
				const response = await fetch(url, options);
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

			const html_style = ` body{padding:2em; font-family:'Source Sans 3','Source Sans Pro',sans-serif; color:${textColor}; margin:0 !important; height:100%; font-size:clamp(1rem, 0.96rem + 0.18vw, 1.125rem);}
 footer { padding: 3px; font-size:clamp(0.8rem, 0.96rem + 0.18vw, 1rem);}
 #container{display: flex; flex-direction:column;min-height: 100%;}
 body{background: ${await toCSSGradient(hour)};} h1{color: ${accentColor};} p{margin: 0.3em;} a{color: ${accentColor};} a:hover{color: ${textColor};}`;
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
			const clientASN = request.cf.asn;
			const clientISP = request.cf.asOrganization;

			const html_content = `  <h1>IP Geolocation 🌐</h1>
  <p> Public IP: ${clientIP} (<a href="https://radar.cloudflare.com/ip/${clientIP}">Cloudflare radar</a>)</p>
  <p> ISP: ${clientISP}, ASN: ${clientASN} (<a href="https://radar.cloudflare.com/quality/as${clientASN}">Cloudflare radar</a>)</p>
  <iframe loading="lazy" title="OpenStreetMap widget" width="425" height="350" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://www.openstreetmap.org/export/embed.html?bbox=${(parseFloat(longitude) - 0.35)}%2C${(parseFloat(latitude) - 0.35)}%2C${(parseFloat(longitude) + 0.35)}%2C${(parseFloat(latitude) + 0.35)}&amp;layer=mapnik&amp;marker=${latitude}%2C${longitude}" style="border: 1px solid black; max-width: 100%;"></iframe>
  <p> Coordinates: <a href="https://www.openstreetmap.org/?mlat=${latitude}&amp;mlon=${longitude}#map=9/${latitude}/${longitude}">(${latitude}, ${longitude})</a>, Timezone: ${timezone}</p>
  <p> City: ${request.cf.city}, <a href="https://en.wikipedia.org/wiki/List_of_television_stations_in_North_America_by_media_market">US DMA Code</a>: ${request.cf.metroCode}</p>
  <p> <a href="https://en.wikipedia.org/wiki/ISO_3166-2">Region</a>: ${request.cf.region}, RegionCode: ${request.cf.regionCode}, PostalCode: ${request.cf.postalCode}</p>
  <p> Country: ${request.cf.country},  Continent: ${request.cf.continent}</p>`;

			timing.renderGeolocation = performance.now() - start;
			return html_content;
		}

		async function renderWeather() {
			const start = performance.now();
			const airnowDateStr = `${localized_date.getFullYear()}-${intFormatTwoDigit.format(localized_date.getMonth() + 1)}-${intFormatTwoDigit.format(localized_date.getDate())}`;

			let html_content = '  <h1>Weather 🌦</h1>';
			// WAQI API setup https://aqicn.org/api/
			const waqiApiRequestUrl = `https://api.waqi.info/feed/geo:${latitude};${longitude}/?token=${env.WAQI_TOKEN}`;
			const waqiRequestInit = {
				headers: {
					'content-type': 'application/json;charset=UTF-8',
				},
				signal: AbortSignal.timeout(fetchTimeout),
			};
			// https://www.weather.gov/documentation/services-web-api API setup
			const nwsPointsRequestUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
			const nwsRequestInit = {
				headers: {
					'accept': 'application/geo+json',
					'User-Agent': env.NWS_AGENT, // ID to send to weather.gov API
				},
				signal: AbortSignal.timeout(fetchTimeout),
			};
			// AirNow API setup https://docs.airnowapi.org/CurrentObservationsByLatLon/query
			const airnowSensorRequestUrl = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${latitude}&longitude=${longitude}&distance=75&API_KEY=${env.AIRNOW_KEY}`;
			const airnowForecastRequestUrl = `https://www.airnowapi.org/aq/forecast/latLong/?format=application/json&latitude=${latitude}&longitude=${longitude}&date=${airnowDateStr}&distance=75&API_KEY=${env.AIRNOW_KEY}`;
			const airnowRequestInit = {
				headers: {
					'content-type': 'application/json;charset=UTF-8',
				},
				signal: AbortSignal.timeout(fetchTimeout),
			};

			// issue concurrent requests to WAQI, NWS, AirNow APIs
			let waqiData = undefined;
			let nwsPointsData = undefined;
			let airnowSensorData = undefined;
			try {
				[waqiData, nwsPointsData, airnowSensorData] = await Promise.allSettled([
					fetchProducts(waqiApiRequestUrl, waqiRequestInit, true),
					fetchProducts(nwsPointsRequestUrl, nwsRequestInit, request.cf.continent.toUpperCase().includes('NA')),
					fetchProducts(airnowSensorRequestUrl, airnowRequestInit, request.cf.continent.toUpperCase().includes('NA')),
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
			timing.renderWeatherFirstFetch = performance.now() - start;

			// grab NWS, airnow forecasts if available
			let nwsForecastData = undefined;
			let airnowForecastData = undefined;
			try {
				[nwsForecastData, airnowForecastData] = await Promise.allSettled([
					fetchProducts(nwsPointsData?.status === 'fulfilled' ? nwsPointsData?.value?.properties.forecast : undefined, nwsRequestInit, nwsPointsRequestSuccess),
					fetchProducts(airnowForecastRequestUrl, airnowRequestInit, airnowSensorRequestSuccess),
				]);
			} catch (e) {
				html_content += `<p> Error: ${e}</p>`;
				html_content += `<p> ${(e as Error).stack}</p>`;
				console.log({ error: e, error_stack: (e as Error).stack });
			}
			const nwsForecastRequestSuccess = !(nwsForecastData == undefined) && nwsForecastData.status === 'fulfilled' && !(nwsForecastData.value == undefined) && 'properties' in nwsForecastData.value
			const airnowForecastRequestSuccess = !(airnowForecastData == undefined) && airnowForecastData.status === 'fulfilled' && Array.isArray(airnowForecastData.value) && airnowForecastData.value.length > 0;

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
			if (airnowSensorRequestSuccess) {
				for (let i = 0; i < airnowSensorData.value.length; i++) {
					if (i === 0 || airnowSensorData.value[i].AQI > (airnowOverall.AQI ?? -1)) {
						airnowOverall.AQI = airnowSensorData.value[i].AQI;
						airnowOverall.category = airnowSensorData.value[i].Category.Name;
					}
					if (airnowSensorData.value[i].ParameterName.toUpperCase().includes('PM2.5')) {
						airnowPM25.AQI = airnowSensorData.value[i].AQI;
						airnowPM25.category = airnowSensorData.value[i].Category.Name;
					}
					else if (airnowSensorData.value[i].ParameterName.toUpperCase().includes('PM10')) {
						airnowPM10.AQI = airnowSensorData.value[i].AQI;
						airnowPM10.category = airnowSensorData.value[i].Category.Name;
					}
					else if (airnowSensorData.value[i].ParameterName.toUpperCase().includes('O3')) {
						airnowO3.AQI = airnowSensorData.value[i].AQI;
						airnowO3.category = airnowSensorData.value[i].Category.Name;
					}
				}
			}


			// temperature data
			const tempF = (waqiRequestSuccess) ? parseFloat(waqiData.value.data.iaqi.t?.v) * 9 / 5 + 32 : NaN; //deg C to deg F
			const humidity = (waqiRequestSuccess) ? waqiData.value.data.iaqi.h?.v : NaN;
			const windSpeed = (waqiRequestSuccess) ? parseFloat(waqiData.value.data.iaqi.w?.v) * 2.23694 : NaN; // m/s to mph
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

			html_content += `<p> Temperature: ${floatFormat.format(tempF)} °F (${floatFormat.format((waqiRequestSuccess) ? waqiData.value.data.iaqi.t?.v : NaN)} °C)</p>`;
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
			if (nwsPointsRequestSuccess) {
				if (nwsForecastRequestSuccess) {
					html_content += `<p> <a href="https://www.weather.gov/${nwsPointsData.value.properties.gridId}/">NWS forecast</a>:<br /><ul>`;

					for (let i = 0; i < 3; i++) {
						const weatherIconText = nwsForecastData.value.properties.periods[i].icon.toLowerCase();
						let weatherIcons = ''
						if (weatherIconText.includes('day/skc')) {
							weatherIcons += '🌞';
						}
						if (weatherIconText.includes('night/skc')) {
							weatherIcons += '🌜';
						}
						if (weatherIconText.includes('day/few')) {
							weatherIcons += '☀️';
						}
						if (weatherIconText.includes('night/few')) {
							weatherIcons += '🌙';
						}
						if (weatherIconText.includes('day/sct')) {
							weatherIcons += '⛅';
						}
						if (weatherIconText.includes('night/sct')) {
							weatherIcons += '🌙☁️';
						}
						if (weatherIconText.includes('day/bkn')) {
							weatherIcons += '🌥️';
						}
						if (weatherIconText.includes('night/bkn')) {
							weatherIcons += '🌙☁️';
						}
						if (weatherIconText.includes('day/ovc')) {
							weatherIcons += '☁️';
						}
						if (weatherIconText.includes('night/ovc')) {
							weatherIcons += '☁️';
						}
						if (weatherIconText.includes('wind')) {
							weatherIcons += '🌬️';
						}
						if (weatherIconText.includes('snow')) {
							weatherIcons += '❄️';
						}
						if (weatherIconText.includes('rain')) {
							weatherIcons += '🌧️';
						}
						if (weatherIconText.includes('sleet')) {
							weatherIcons += '🧊🌨️';
						}
						if (weatherIconText.includes('fzra')) {
							weatherIcons += '🧊🌧️';
						}
						if (weatherIconText.includes('tsra')) {
							weatherIcons += '⛈️';
						}
						if (weatherIconText.includes('tornado')) {
							weatherIcons += '🌪️';
						}
						if (weatherIconText.includes('hurricane')) {
							weatherIcons += '🌀';
						}
						if (weatherIconText.includes('tropical')) {
							weatherIcons += '🌀';
						}
						if (weatherIconText.includes('dust')) {
							weatherIcons += '🌫️💨';
						}
						if (weatherIconText.includes('smoke')) {
							weatherIcons += '🔥🌫️';
						}
						if (weatherIconText.includes('haze')) {
							weatherIcons += '😶‍🌫️';
						}
						if (weatherIconText.includes('hot')) {
							weatherIcons += '🥵';
						}
						if (weatherIconText.includes('cold')) {
							weatherIcons += '🥶';
						}
						if (weatherIconText.includes('blizzard')) {
							weatherIcons += '🌬️❄️';
						}
						if (weatherIconText.includes('fog')) {
							weatherIcons += '🌫️';
						}

						html_content += `<li>${nwsForecastData.value.properties.periods[i].name}: ${weatherIcons} ${nwsForecastData.value.properties.periods[i].detailedForecast}</li>`;
					}
				}
				html_content += `</ul></p><p><a href="https://radar.weather.gov/station/${nwsPointsData.value.properties.radarStation}/standard"><img loading="lazy" src="https://radar.weather.gov/ridge/standard/${nwsPointsData.value.properties.radarStation}_loop.gif" width="600" height="550" alt="radar loop" style="max-width: 100%; height: auto;"></a></p>`;
			}

			// air quality data
			html_content += `<p> Overall AQI: ${(waqiRequestSuccess) ? waqiData.value.data.aqi : 'N/A'} ${await AQItoEmoji((waqiRequestSuccess) ? waqiData.value.data.aqi : undefined)}`;
			if (!(airnowOverall.AQI == undefined)) {
				html_content += ` (AirNow AQI: ${airnowOverall.AQI}, ${await AQItoEmoji(airnowOverall.AQI)} ${airnowOverall.category})</p>`;
			}
			else {
				html_content += `</p>`;
			}
			html_content += `<p> PM<sub>2.5</sub> AQI: ${(waqiRequestSuccess) ? waqiData.value.data.iaqi.pm25?.v : 'N/A'}  ${await AQItoEmoji((waqiRequestSuccess) ? waqiData.value.data.iaqi.pm25?.v : undefined)}`;
			if (!(airnowPM25.AQI == undefined)) {
				html_content += ` (<a href="https://gispub.epa.gov/airnow/?showlegend=no&xmin=${await lon2x(longitude) - 200000}&xmax=${await lon2x(longitude) + 200000}&ymin=${await lat2y(latitude) - 200000}&ymax=${await lat2y(latitude) + 200000}&monitors=pm25&contours=pm25">AirNow AQI</a>: ${airnowPM25.AQI}, ${await AQItoEmoji(airnowPM25.AQI)} ${airnowPM25.category})</p>`;
			}
			else {
				html_content += `</p>`;
			}
			html_content += `<p> PM<sub>10</sub> AQI: ${(waqiRequestSuccess) ? waqiData.value.data.iaqi.pm10?.v : 'N/A'} ${await AQItoEmoji((waqiRequestSuccess) ? waqiData.value.data.iaqi.pm10?.v : undefined)}`;
			if (!(airnowPM10.AQI == undefined)) {
				html_content += ` (<a href="https://gispub.epa.gov/airnow/?showlegend=no&xmin=${await lon2x(longitude) - 200000}&xmax=${await lon2x(longitude) + 200000}&ymin=${await lat2y(latitude) - 200000}&ymax=${await lat2y(latitude) + 200000}&monitors=pm10&contours=ozonepm">AirNow AQI</a>: ${airnowPM10.AQI}, ${await AQItoEmoji(airnowPM10.AQI)} ${airnowPM10.category})</p>`;
			}
			else {
				html_content += `</p>`;
			}
			html_content += `<p> O<sub>3</sub> (ozone) AQI: ${(waqiRequestSuccess) ? waqiData.value.data.iaqi.o3?.v : 'N/A'} ${await AQItoEmoji((waqiRequestSuccess) ? waqiData.value.data.iaqi.o3?.v : undefined)}`;
			if (!(airnowO3.AQI == undefined)) {
				html_content += ` (<a href="https://gispub.epa.gov/airnow/?showlegend=no&xmin=${await lon2x(longitude) - 200000}&xmax=${await lon2x(longitude) + 200000}&ymin=${await lat2y(latitude) - 200000}&ymax=${await lat2y(latitude) + 200000}&contours=ozonepm&monitors=ozone">AirNow AQI</a>: ${airnowO3.AQI}, ${await AQItoEmoji(airnowO3.AQI)} ${airnowO3.category})</p>`;
			}
			else {
				html_content += `</p>`;
			}
			html_content += `<p> NO<sub>2</sub> (nitrogen dioxide) AQI: ${(waqiRequestSuccess) ? waqiData.value.data.iaqi.no2?.v : 'N/A'} ${await AQItoEmoji((waqiRequestSuccess) ? waqiData.value.data.iaqi.no2?.v : undefined)}</p>`;
			html_content += `<p> SO<sub>2</sub> (sulphur dioxide) AQI: ${(waqiRequestSuccess) ? waqiData.value.data.iaqi.so2?.v : 'N/A'} ${await AQItoEmoji((waqiRequestSuccess) ? waqiData.value.data.iaqi.so2?.v : undefined)}</p>`;
			html_content += `<p> CO (carbon monoxide) AQI: ${(waqiRequestSuccess) ? waqiData.value.data.iaqi.co?.v : 'N/A'} ${await AQItoEmoji((waqiRequestSuccess) ? waqiData.value.data.iaqi.co?.v : undefined)}</p>`;

			if (airnowForecastRequestSuccess) {
				const firstAirnowData = airnowForecastData.value[0];
				html_content += `<p> AirNow forecast for <a href="https://www.openstreetmap.org/?mlat=${firstAirnowData.Latitude}&amp;mlon=${firstAirnowData.Longitude}#map=9/${firstAirnowData.Latitude}/${firstAirnowData.Longitude}">${firstAirnowData.ReportingArea}, ${firstAirnowData.StateCode}</a>:<br /><ul>`;
				if (firstAirnowData.ActionDay) {
					html_content += `<li>Action day ⚠️</li>`;
				}
				if (!(firstAirnowData.Discussion == undefined) && !(firstAirnowData.Discussion === '')) {
					if (URL.canParse(firstAirnowData.Discussion)) {
						html_content += `<li><a href="${firstAirnowData.Discussion}">Discussion: ${firstAirnowData.Discussion}</a></li>`;
					} else {
						html_content += `<li>${firstAirnowData.Discussion}</li>`;
					}
				}
				for (let i = 0; i < airnowForecastData.value.length; i++) {
					if (airnowForecastData.value[i].DateForecast === airnowDateStr) {
						html_content += `<li>${airnowForecastData.value[i].ParameterName}: ${airnowForecastData.value[i].Category.Name} ${await categoryToEmoji(airnowForecastData.value[i].Category.Number)}`;
						if (airnowForecastData.value[i].AQI > 0) {
							html_content += ` (AQI ${airnowForecastData.value[i].AQI})`
						}
						html_content += `</li>`;
					}
				}
				html_content += `</ul></p>`;
			}

			if ((waqiRequestSuccess)) {
				const waqiTime = dateFormat.format(new Date(waqiData.value.data.time.iso));
				html_content += `<p> Sensor data from <a href="${waqiData.value.data.city.url}">${waqiData.value.data.city.name}</a>, measured at ${waqiTime}</p>`;
			}
			if (airnowSensorRequestSuccess) {
				const firstAirnowData = airnowSensorData.value[0];
				html_content += `<p> AirNow data from <a href="https://www.openstreetmap.org/?mlat=${firstAirnowData.Latitude}&amp;mlon=${firstAirnowData.Longitude}#map=9/${firstAirnowData.Latitude}/${firstAirnowData.Longitude}">${firstAirnowData.ReportingArea}, ${firstAirnowData.StateCode}</a>, measured at ${firstAirnowData.DateObserved}, ${firstAirnowData.HourObserved}:00 ${firstAirnowData.LocalTimeZone}</p>`;
			}
			// html_content += `<p><iframe loading="lazy" title="Airnow widget" height="230" width="230" src="https://widget.airnow.gov/aq-dial-widget-primary-pollutant/?latitude=${latitude}&longitude=${longitude}&transparent=true" style="border: none; border-radius: 25px;"></iframe></p>`

			timing.renderWeather = performance.now() - start;
			return html_content;
		}

		async function renderFooter() {
			const start = performance.now();
			const clientUA = request.headers.get('User-Agent');
			const tlsVersion = request.cf.tlsVersion;

			const html_footer = `  <h1>Browser 🗔</h1>
  <p> User Agent: ${clientUA}</p>
  <p> HTTP Version: ${request.cf.httpProtocol}</p>
  <p> TLS Version: ${tlsVersion}</p>
  <p> TLS Cipher: ${request.cf.tlsCipher}</p>
  <p> Cloudflare datacenter <a href="https://en.wikipedia.org/wiki/IATA_airport_code">IATA code</a>: ${request.cf.colo}</p>
</div>
</body>
<footer>
  <p> Page generated at ${dateFormat.format(new Date())}</p>
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
			// build HTML content
			writer.write(encoder.encode(await renderGeolocation()));
			writer.write(encoder.encode(await renderWeather()));

			writer.write(encoder.encode(await renderFooter()));

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

			if (!(request.cf.tlsVersion.toUpperCase().includes('TLSV1.2') || request.cf.tlsVersion.toUpperCase().includes('TLSV1.3'))) {
				console.log({ error: `TLS version error: "${request.cf.tlsVersion}"` });
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
