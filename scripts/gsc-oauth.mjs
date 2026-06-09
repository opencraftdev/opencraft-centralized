// One-time Google Search Console OAuth sign-in.
//
//   node scripts/gsc-oauth.mjs
//
// Opens a Google consent screen, captures the code on a loopback redirect, and
// writes GSC_OAUTH_REFRESH_TOKEN into .env.local. Reads the client id/secret
// from .env.local. Everything stays on this machine.
//
// Note: the app is published but unverified, so Google shows a "Google hasn't
// verified this app" screen — click "Advanced" → "Go to OpenCraft Dashboard
// (unsafe)" to continue (it's your own app).

import http from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

function upsertEnv(text, key, value) {
  const lines = text.split(/\r?\n/).filter((l) => !l.startsWith(key + "="));
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  lines.push(`${key}=${value}`);
  return lines.join("\r\n") + "\r\n";
}

const env = parseEnv(readFileSync(ENV_PATH, "utf8"));
const clientId = env.GSC_OAUTH_CLIENT_ID;
const clientSecret = env.GSC_OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Missing GSC_OAUTH_CLIENT_ID / GSC_OAUTH_CLIENT_SECRET in .env.local");
  process.exit(1);
}

let port;
let redirectUri;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, redirectUri);
    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(404);
      res.end();
      return;
    }
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok || !data.refresh_token) {
      res.writeHead(500, { "content-type": "text/html" });
      res.end(`<h2>Failed to get a refresh token</h2><pre>${JSON.stringify(data, null, 2)}</pre>`);
      console.error("Token exchange failed:", data);
      server.close();
      process.exit(1);
    }
    const updated = upsertEnv(readFileSync(ENV_PATH, "utf8"), "GSC_OAUTH_REFRESH_TOKEN", data.refresh_token);
    writeFileSync(ENV_PATH, updated);
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<h2>✅ Search Console connected — you can close this tab.</h2>");
    const t = data.refresh_token;
    console.log(`\nOK: wrote GSC_OAUTH_REFRESH_TOKEN (${t.slice(0, 6)}...${t.slice(-4)}, len=${t.length}) to .env.local`);
    server.close();
    setTimeout(() => process.exit(0), 200);
  } catch (e) {
    res.writeHead(500);
    res.end("error");
    console.error(e);
    server.close();
    process.exit(1);
  }
});

server.listen(0, "127.0.0.1", () => {
  port = server.address().port;
  redirectUri = `http://127.0.0.1:${port}`;
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
    });
  console.log("\nOpening Google sign-in in your browser…");
  console.log("If it doesn't open, paste this URL into your browser:\n\n" + authUrl + "\n");
  try {
    spawn("cmd", ["/c", "start", "", authUrl], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* user can paste the URL manually */
  }
});
