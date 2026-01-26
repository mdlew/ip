/**
 * Entry point for the Cloudflare Worker application.
 *
 * Handles incoming HTTP requests and routes them based on URL paths:
 * - Serves static assets (favicon, fonts, robots.txt)
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
  /** Fetcher binding for serving static assets */
  ASSETS: Fetcher;
}

const imgProxyLog = {
  message: "",
  radarId: "",
  cf_resized: "",
  contentType: "",
  contentLength: 0,
};

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

    // Define static URLs and worker URLs
    const STATIC_URLS = [
      "/favicon.ico",
      "/favicon.svg",
      "/robots.txt",
      "/SourceSans3-Regular.otf.woff2",
      "/SourceSans3-Bold.otf.woff2",
    ];
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
      "Content-Security-Policy": `script-src 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'; style-src 'nonce-${nonce}' https://unpkg.com/; worker-src blob: ; child-src blob: ; img-src data: 'self' blob: ; object-src 'none'; default-src 'self' https://unpkg.com/ https://tiles.stadiamaps.com/; base-uri 'none'`,
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
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-site",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      link: "<https://unpkg.com>; rel=preconnect, <https://tiles.stadiamaps.com>; rel=preconnect",
    });

    // Check if the request is secure (HTTPS) and TLS version is 1.2 or higher, return 403 if not
    if (
      typeof request.cf?.tlsVersion !== "string" ||
      !(
        request.cf.tlsVersion.toUpperCase().includes("TLSV1.2") ||
        request.cf.tlsVersion.toUpperCase().includes("TLSV1.3")
      )
    ) {
      console.log({
        error: `TLS version error: "${request.cf?.tlsVersion}"`,
      });
      return new Response("Please use TLS version 1.2 or higher.", {
        status: 403,
        statusText: "Forbidden",
      });
    }

    // Only GET requests work with this proxy.
    if (request.method !== "GET") {
      return MethodNotAllowed(request);
    }

    // return static asset if the request matches a valid static URL
    if (STATIC_URLS.includes(url.pathname)) {
      // If the request is for a static asset, fetch it from the ASSETS binding
      // and return the response.
      try {
        return env.ASSETS.fetch(request);
      } catch (e) {
        const pathname = url.pathname;
        console.log({
          error: `"${pathname}" not found`,
          error_stack: (e as Error).stack,
        });
        return new Response(`"${pathname}" not found`, {
          status: 404,
          statusText: "Not Found",
        });
      }
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
