import assert from "node:assert/strict";
import http from "node:http";
const modules = {
  portal: "Centralni portal",
  studomat: "Studomat",
  merlin: "E-učenje",
  webmail: "Webmail",
  isvu: "Administracija studija",
  referada: "Studentska referada",
  raspored: "Raspored",
  auth: "Prijava u sustav",
  admin: "Administracija sustava",
};
const request = (host, path = "/") =>
  new Promise((resolve, reject) => {
    http
      .get(
        {
          hostname: "127.0.0.1",
          port: Number(process.env.SMOKE_PORT || 3000),
          path,
          headers: { host },
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (s) => (body += s));
          res.on("end", () => resolve({ status: res.statusCode, body }));
        },
      )
      .on("error", reject);
  });
let count = 0;
for (const base of ["localhost:3000", "domena.hr"]) {
  for (const host of [base, `www.${base}`]) {
    const r = await request(host);
    assert.equal(r.status, 200, host);
    assert.match(r.body, /Vaš akademski svijet/);
    count++;
  }
  for (const [slug, title] of Object.entries(modules)) {
    const r = await request(`${slug}.${base}`);
    assert.equal(r.status, 200, slug);
    assert.ok(r.body.includes(title), slug);
    assert.ok(!r.body.includes("Vaš akademski svijet"), slug);
    assert.ok(
      r.body.includes(
        `${base.startsWith("localhost") ? "http" : "https"}://portal.${base}`,
      ) || slug === "portal",
    );
    count++;
  }
}
for (const slug of Object.keys(modules)) {
  const r = await request("localhost:3000", `/?module=${slug}`);
  assert.equal(r.status, 200);
  assert.ok(
    r.body.includes(`module=${slug === "portal" ? "studomat" : "portal"}`),
  );
  count++;
}
for (const [host, path] of [
  ["unknown.localhost:3000", "/"],
  ["evil.test", "/"],
  ["studomat.domena.hr.evil.test", "/"],
  ["localhost:3000", "/sites/admin"],
  ["localhost:3000", "/?module=unknown"],
  ["localhost:3000", "/missing"],
  ["studomat.localhost:3000", "/missing"],
]) {
  const r = await request(host, path);
  assert.equal(r.status, 404, `${host}${path}`);
  count++;
}
console.log(
  `${count} HTTP provjera prošlo: domene, svi moduli, poveznice, fallback, 404 i zaštita internih ruta.`,
);

if (process.env.SMOKE_VERCEL_HOST) {
  const host = process.env.SMOKE_VERCEL_HOST;
  const home = await request(host);
  assert.equal(home.status, 200);
  assert.ok(home.body.includes(`https://${host}/?module=studomat`));
  for (const [slug, title] of Object.entries(modules)) {
    const result = await request(host, `/?module=${slug}`);
    assert.equal(result.status, 200);
    assert.ok(result.body.includes(title));
    assert.ok(
      result.body.includes(
        `https://${host}/?module=${slug === "portal" ? "studomat" : "portal"}`,
      ),
    );
  }
  assert.equal((await request("untrusted.vercel.app")).status, 404);
  assert.equal((await request(host, "/?module=invalid")).status, 404);
  console.log("12 dodatnih Vercel HTTP provjera prošlo.");
}
