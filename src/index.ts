/**
 * Entry point for the Cloudflare Worker application.
 *
 * Handles incoming HTTP requests and routes them based on URL paths:
 * - Serves small static responses (favicon, robots.txt)
 * - Proxies radar images with WebP transformation
 * - Renders IP geolocation page with weather data
 *
 * All requests must use TLS 1.2+ and include appropriate security headers.
 *
 * @module
 * @author Matthew Lew
 */

import { renderPage } from "./ssr.js";

/**
 * Environment bindings and secrets for the Cloudflare Worker.
 *
 * @interface
 */
export interface Env {
  /** Token for WAQI (World Air Quality Index) API */
  WAQI_TOKEN: string;
  /** User agent string for NWS (National Weather Service) API */
  NWS_AGENT: string;
  /** API key for AirNow air quality service */
  AIRNOW_KEY: string;
}

const imgProxyLog = {
  message: "",
  radarId: "",
  cf_resized: "",
  contentType: "",
  contentLength: 0,
};

const FAVICON_ICO_BASE64 =
  "AAABAAEAICAQAAEABADoAgAAFgAAACgAAAAgAAAAQAAAAAEABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAtC7kANRi8AD0mvQBJOsAAVUnAAGdexABvaMYAgHrLAJSP0ACvrNoAxsXkAN7c7gDq6vYA+Pr/AP///wAAAAAA7u7u7u7u7u3e7e7u7u7u7u7u6WZWVlVVVWVlVlvu7u7u7ukQEQAQAAAAEAEb7u7u7u7pMzM0NDQ0QgADO+7u7u7u7u3u7t3d7esQCN7u7u7u7u7u7u7u7u7tgQCe7u7u7u7u7u7u7u7u7rEBG+7u7u7u7u7u3u7u7u7TAAfu7u7u7u7u7u7u7u7u5xABzu7u7u7u7ru7vu7u7ugBAK7u7u7u7u6yAb7u7u3oEAGe7u7u7u7upxat7u7u6AEAnu7u7u7u7mAATu7u7uQAAJ7u7u7u7u5hAD7u7u6wAAG+7u7u7u7uYABO7u7ugAAE3u7u7u7u7mAAPu7u6hABGt7u7u7u7u5gAE7u7qEAAX3u7u7u7u7uYAAWmYQBABbe7u7u7u7u7mAAOUABEAKd7u7u7u7u7u5gAD7ahEec7u7u7u7u7u7uYBBO7u3e7u7u7u7u7u7u7mAAPu7u7u7u7u7u7u7u7u5gAE7u7u7u7u7u7u7u7u7uYRA+7u7u7u7u7u7u7u7u3mAATu7u7u7u7u7u7u7u7u5RAD7u7u7u7u7u7u7u7u3tMAE+7u7u7u7u7u7u7u7sqAEATu7u7u7u7u7u7u7u6SABABve7u7u7u7u7u7u7u7cuYQDvu7u7u7u7u7u7u7u7u7tyq7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

const FAVICON_SVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="100%" height="100%" viewBox="0 0 36 36" version="1.1" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
    <g transform="matrix(1,0,0,1,6.0597,1.2766)">
        <g transform="matrix(1.9045,0,0,1.9045,-136.1,-40.947)">
            <path d="M76.434,38.063L76.434,37.81C76.431,37.806 76.425,37.805 76.421,37.8C76.424,37.891 76.434,37.967 76.434,38.063Z" style="fill:rgb(186,12,47);fill-rule:nonzero;"/>
            <path d="M78.752,27.925C78.313,27.925 77.925,28.045 77.304,28.309L75.934,28.885C75.934,28.885 75.907,24.593 75.934,23.265C75.946,22.672 76.838,22.344 76.838,22.344L76.855,21.5L75.934,21.829C74.641,22.189 72.754,22.525 71.461,22.669L71.461,23.341C72.986,23.461 73.09,23.653 73.09,25.069L73.09,32.922L75.934,32.913L75.934,29.678C76.348,29.534 76.813,29.414 77.356,29.414C79.166,29.414 80.872,30.758 80.872,33.686C80.872,35.41 80.417,36.651 79.695,37.376C79.201,37.873 78.582,38.126 77.899,38.126C77.217,38.109 76.744,38.152 76.434,37.81L76.434,38.063C76.434,37.968 76.424,37.892 76.421,37.8C76.42,37.799 76.418,37.799 76.417,37.797L73.089,37.875L73.089,38.198C74.744,38.822 76.063,39.062 77.355,39.062C81.026,39.062 84,36.494 84,32.989C84.001,30.253 81.751,27.925 78.752,27.925Z" style="fill:rgb(186,12,47);fill-rule:nonzero;"/>
        </g>
        <rect x="0" y="30.234" width="22.422" height="3.213" style="fill:rgb(186,12,47);"/>
        <g transform="matrix(1.9045,0,0,1.9045,-136.1,-40.947)">
            <path d="M73.052,33.998L73.989,32.852L75.005,32.852L75.943,33.998L73.052,33.998Z" style="fill:rgb(186,12,47);fill-rule:nonzero;"/>
        </g>
    </g>
</svg>`;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function staticResponse(pathname: string): Response | null {
  if (pathname === "/robots.txt") {
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  if (pathname === "/favicon.svg") {
    return new Response(FAVICON_SVG, {
      headers: {
        "content-type": "image/svg+xml;charset=UTF-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  if (pathname === "/favicon.ico") {
    return new Response(base64ToBytes(FAVICON_ICO_BASE64), {
      headers: {
        "content-type": "image/x-icon",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  return null;
}

/**
 * Returns a 405 Method Not Allowed response.
 *
 * @param {Request} request - The incoming HTTP request
 * @returns {Promise<Response>} Response indicating the method is not allowed
 */
async function MethodNotAllowed(request: Request) {
  console.log({ error: `Method ${request.method} not allowed` });
  return new Response(`Method ${request.method} not allowed.`, {
    status: 405,
    statusText: "Method Not Allowed",
    headers: {
      Allow: "GET",
    },
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // Response logic ******************************************************
    // Return a new Response based on a URL's pathname

    // Define worker URLs
    const RADAR_PROXY_URL = "/radarproxy/";
    const WORKER_URL = "/";
    const url = new URL(request.url); // URL is available in the global scope of Cloudflare Workers

    // Generate a new random nonce value for every response.
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const nonce = btoa(String.fromCharCode(...array));

    // set default security headers
    const myHeaders = new Headers({
      "content-type": "text/html;charset=UTF-8",
      /*
			  Secure your application with Content-Security-Policy headers.
			  Enabling these headers will permit content from a trusted domain and all its subdomains.
			  @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy
			  */
      "Content-Security-Policy": `script-src 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'; style-src 'nonce-${nonce}' https://unpkg.com/; worker-src blob: ; child-src blob: ; img-src data: 'self' blob: ; object-src 'none'; default-src 'self' https://unpkg.com/ https://tiles.stadiamaps.com/; base-uri 'none'; frame-ancestors 'none'; upgrade-insecure-requests;`,
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
      "Cross-Origin-Embedder-Policy": "require-corp;",
      "Cross-Origin-Opener-Policy": "same-site;",
      "Cross-Origin-Resource-Policy": "same-site",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      link: "<https://unpkg.com>; rel=preconnect, <https://tiles.stadiamaps.com>; rel=preconnect",
    });

    // Check if the request is HTTP/2 or HTTP/3
    if (
      typeof request.cf?.httpProtocol !== "string" ||
      !(
        request.cf.httpProtocol.toUpperCase().includes("HTTP/2") ||
        request.cf.httpProtocol.toUpperCase().includes("HTTP/3")
      )
    ) {
      console.log({
        error: `HTTP protocol error: "${request.cf?.httpProtocol}"`,
      });
      // return a 403 response only if httpProtocol is available and asn is not cloudflare, otherwise just ignore this check
      if (typeof request.cf?.httpProtocol == "string" && request.cf?.asn !== 13335) {
        return new Response("Please use HTTP/2 or HTTP/3.", {
          status: 403,
          statusText: "Forbidden",
        });
      }
    }

    // Check if the request is secure (HTTPS) and TLS version is 1.3 or higher
    if (
      typeof request.cf?.tlsVersion !== "string" ||
      !request.cf.tlsVersion.toUpperCase().includes("TLSV1.3")
    ) {
      console.log({
        error: `TLS version error: "${request.cf?.tlsVersion}"`,
      });
      // return a 403 response only if tlsVersion is available and asn is not cloudflare, otherwise just ignore this check
      if (typeof request.cf?.tlsVersion == "string" && request.cf?.asn !== 13335) {
        return new Response("Please use TLS version 1.3 or higher.", {
          status: 403,
          statusText: "Forbidden",
        });
      }
    }

    // Only GET requests work with this proxy.
    if (request.method !== "GET") {
      return MethodNotAllowed(request);
    }

    const staticAsset = staticResponse(url.pathname);
    if (staticAsset !== null) {
      return staticAsset;
    }

    // return radar proxy if the request matches a valid radar proxy URL
    if (
      RADAR_PROXY_URL == url.pathname &&
      url.searchParams.get("id") &&
      url.searchParams.get("refreshed") &&
      url.searchParams.get("id")?.length == 4
    ) {
      const radarId = url.searchParams.get("id")?.toUpperCase() || "";
      const cacheKey = url.searchParams.get("refreshed"); // cache feature not enabled for free users

      const radarGifUrl = `https://radar.weather.gov/ridge/standard/${radarId}_loop.gif`;

      // Rewrite request to point to radar URL. This also makes the request mutable
      // so you can add the correct Origin header to make the API server think
      // that this request is not cross-site.
      request = new Request(radarGifUrl, request);
      request.headers.set("Origin", new URL(radarGifUrl).origin);
      imgProxyLog.radarId = radarId;

      let response = await fetch(request, {
        cf: {
          // Image transform object
          image: {
            anim: true, // Enable animation for GIFs
            format: "webp", // Convert the image to WebP format
            quality: 70, // Set the quality for the WebP image
          },
        },
        cache: "no-store", // Do not cache the response
      });
      imgProxyLog.cf_resized = response.headers.get("cf-resized") || "";

      if (response.ok || response.redirected) {
        // Log successful image transform
        imgProxyLog.message = `Radar image for "${radarId}" transformed successfully.`;
      } else {
        // If the image transform fails, log the error. Fetch the original image
        imgProxyLog.message = `Radar image transform for "${radarId}" failed. Falling back to original image.`;
        response = await fetch(request, { cache: "no-store" });
      }

      // Recreate the response so you can modify the headers
      response = new Response(response.body, response);
      // Set CORS headers
      response.headers.set("Access-Control-Allow-Origin", url.origin);
      // Set Cache-Control headers, okay to cache for 1 year because URL refreshes every 2 minutes
      response.headers.set(
        "Cache-Control",
        "public, max-age=31536000, immutable",
      );
      // Append to/Add Vary header so browser will cache response correctly
      response.headers.append("Vary", "Origin");

      imgProxyLog.contentType = response.headers.get("content-type") || "";
      imgProxyLog.contentLength = parseInt(
        response.headers.get("content-length") || "0",
      );
      console.log(imgProxyLog);
      return response;
    }

    // else do IP geolocation
    if (WORKER_URL == url.pathname) {
      let { readable, writable } = new IdentityTransformStream();

      const writer = writable.getWriter();
      ctx.waitUntil(renderPage(writer, request, env, nonce));

      return new Response(readable, {
        headers: myHeaders,
      });
    }

    // if the request does not match any of the above, return a 404 response
    console.log({ error: `"${url.pathname}" not found` });
    return new Response("Not found", {
      status: 404,
      statusText: "Not Found",
    });
  },
} satisfies ExportedHandler<Env>;
