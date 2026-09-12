import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { env } from "node:process";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

function resolveBuildId(): string {
  if (env.GITHUB_SHA) return env.GITHUB_SHA.slice(0, 7);
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "local";
  }
}

export default defineConfig({
  base: "/",
  plugins: [preact()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(resolveBuildId()),
  },
  build: { target: "es2022", sourcemap: true },
});
