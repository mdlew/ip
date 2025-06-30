import { renderPage } from "./ssr.js";

export interface Env {
  WAQI_TOKEN: string;
  NWS_AGENT: string;
  AIRNOW_KEY: string;
  ASSETS: Fetcher; // Add ASSETS property to the Env interface
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Response logic ******************************************************

    // Return a new Response based on a URL's pathname
    const STATIC_URLS = ["/favicon.ico", "/favicon.svg", "/robots.txt"];
    const WORKER_URLS = ["/"];
    const url = new URL(request.url); // URL is available in the global scope of Cloudflare Workers

    // Generate a new random nonce value for every response.
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const nonce = btoa(String.fromCharCode(...array));

    // return static asset
    if (STATIC_URLS.includes(url.pathname)) {
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
      // Only GET requests work with this proxy.
      if (request.method !== "GET") {
        return MethodNotAllowed(request);
      }
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

    // else do IP geolocation
    else {
      // set default security headers
      const myHeaders = new Headers({
        "content-type": "text/html;charset=UTF-8",
        /*
			  Secure your application with Content-Security-Policy headers.
			  Enabling these headers will permit content from a trusted domain and all its subdomains.
			  @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy
			  */
			  "Content-Security-Policy": `script-src 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none';`,
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
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Opener-Policy": "same-site",
        "Cross-Origin-Resource-Policy": "same-site",
        link: "<https://unpkg.com>; rel=preconnect, <https://tiles.stadiamaps.com>; rel=preconnect, <https://radar.weather.gov>; rel=preconnect, <https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,700;1,400;1,700&display=swap>; rel=preload; as=style",
      });

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
      } else if (WORKER_URLS.includes(url.pathname)) {
        let { readable, writable } = new IdentityTransformStream();

        const writer = writable.getWriter();
        ctx.waitUntil(renderPage(writer, request, env, nonce));

        return new Response(readable, {
          headers: myHeaders,
        });
      } else {
        const pathname = url.pathname;
        console.log({ error: `"${pathname}" not found` });
        return new Response("Not found", {
          status: 404,
          statusText: "Not Found",
        });
      }
    }
  },
} satisfies ExportedHandler<Env>;
