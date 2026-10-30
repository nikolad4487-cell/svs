import http from "node:http";
http
  .createServer((request, response) => {
    const prefix = request.url.startsWith("/auth/v1/")
      ? "/auth/v1"
      : request.url.startsWith("/rest/v1/")
        ? "/rest/v1"
        : null;
    if (!prefix) {
      response.writeHead(404);
      response.end();
      return;
    }
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: prefix === "/auth/v1" ? 54325 : 54326,
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
