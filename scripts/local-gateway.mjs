import http from "node:http";
http
  .createServer((request, response) => {
    const prefix = request.url.startsWith("/auth/v1/")
      ? "/auth/v1"
      : request.url.startsWith("/rest/v1/")
        ? "/rest/v1"
        : request.url.startsWith("/storage/v1/")
          ? "/storage/v1"
          : null;
    if (!prefix) {
      response.writeHead(404);
      response.end();
      return;
    }
    // The full Supabase stack supplies Storage CORS through its API gateway.
    // Keep this lightweight equivalent limited to local browser test origins.
    const origin = request.headers.origin;
    if (
      prefix === "/storage/v1" &&
      origin &&
      /^http:\/\/(?:localhost|127\.0\.0\.1)(?::[0-9]+)?$/.test(origin)
    ) {
      response.setHeader("access-control-allow-origin", origin);
      response.setHeader("vary", "Origin");
      response.setHeader(
        "access-control-allow-methods",
        "GET,HEAD,POST,PUT,DELETE,OPTIONS",
      );
      response.setHeader(
        "access-control-allow-headers",
        "authorization,apikey,x-client-info,content-type,cache-control,x-upsert,range",
      );
      response.setHeader(
        "access-control-expose-headers",
        "content-length,content-range,accept-ranges",
      );
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }
    }
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port:
          prefix === "/auth/v1"
            ? 54325
            : prefix === "/storage/v1"
              ? 54327
              : 54326,
        path: request.url.slice(prefix.length),
        method: request.method,
        headers: { ...request.headers, host: "127.0.0.1" },
      },
      (result) => {
        response.writeHead(result.statusCode, result.headers);
        result.pipe(response);
      },
    );
    upstream.on("error", () => {
      response.writeHead(503);
      response.end("Local service unavailable");
    });
    request.pipe(upstream);
  })
  .listen(54321, "127.0.0.1", () => console.log("Local test gateway ready."));
