// Runs the Next dev server AND the Tailscale HTTPS tunnel together.
// Ctrl+C (or the dev server exiting) tears down BOTH — the tunnel config is
// removed from the Tailscale daemon so it doesn't linger in the background.
//
// Used by `npm run tunnel`. Port can be overridden: PORT=3001 npm run tunnel
import { spawn, spawnSync } from "node:child_process";

const PORT = process.env.PORT || "3000";
const TS = "tailscale"; // on PATH (C:\Program Files\Tailscale\tailscale.exe)

// 1. Bring the HTTPS tunnel up (registers with the Tailscale daemon).
spawnSync(TS, ["serve", "--bg", "--https=443", `http://127.0.0.1:${PORT}`], {
  stdio: "inherit",
  shell: true,
});

// 2. Start the dev server in the foreground.
const dev = spawn("next", ["dev", "--turbopack"], { stdio: "inherit", shell: true });

// 3. Tear the tunnel down exactly once, whatever ends the session.
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  console.log("\n[tunnel] stopping Tailscale HTTPS proxy…");
  spawnSync(TS, ["serve", "--https=443", "off"], { stdio: "inherit", shell: true });
}

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    cleanup();
    dev.kill(sig);
    process.exit(0);
  });
}

dev.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 0);
});
