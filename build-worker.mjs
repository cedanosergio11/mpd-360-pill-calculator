import fs from "node:fs/promises";

const textAssets = [
  ["/index.html", "index.html", "text/html; charset=utf-8"],
  ["/app.js", "app.js", "text/javascript; charset=utf-8"],
  ["/styles.css", "styles.css", "text/css; charset=utf-8"],
];

const assets = {};
for (const [route, file, contentType] of textAssets) {
  assets[route] = {
    body: await fs.readFile(new URL(`./${file}`, import.meta.url), "utf8"),
    contentType,
    encoding: "text",
  };
}

try {
  const og = await fs.readFile(new URL("./og.png", import.meta.url));
  assets["/og.png"] = {
    body: og.toString("base64"),
    contentType: "image/png",
    encoding: "base64",
  };
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const workerSource = `
const assets = ${JSON.stringify(assets)};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function responseHeaders(asset, path) {
  const headers = new Headers({
    "Content-Type": asset.contentType,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  if (path === "/index.html") {
    headers.set("Cache-Control", "no-cache");
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'",
    );
  } else {
    headers.set("Cache-Control", "public, max-age=3600");
  }
  return headers;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const asset = assets[path];
    if (!asset) {
      return new Response("Not found", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const body = request.method === "HEAD"
      ? null
      : asset.encoding === "base64"
        ? decodeBase64(asset.body)
        : asset.body;
    return new Response(body, {
      status: 200,
      headers: responseHeaders(asset, path),
    });
  },
};
`;

const output = new URL("./dist/server/", import.meta.url);
await fs.rm(new URL("./dist/", import.meta.url), { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
await fs.writeFile(new URL("./index.js", output), workerSource.trimStart(), "utf8");
console.log(`Built ${Object.keys(assets).length} hosted assets.`);
