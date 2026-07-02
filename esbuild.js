// Builds two bundles:
//  1) host    -> dist/extension.js  (Node/CommonJS, vscode external)
//  2) webview -> dist/webview.js    (browser/IIFE, runs inside the WebviewPanel)
const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");
const production = process.argv.includes("--production");

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  sourcemap: !production,
  minify: production,
  logLevel: "info",
};

const hostConfig = {
  ...common,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["vscode"],
};

const webviewConfig = {
  ...common,
  entryPoints: ["webview/main.ts"],
  outfile: "dist/webview.js",
  platform: "browser",
  format: "iife",
  target: "es2021",
};

async function run() {
  if (watch) {
    const ctxHost = await esbuild.context(hostConfig);
    const ctxWeb = await esbuild.context(webviewConfig);
    await Promise.all([ctxHost.watch(), ctxWeb.watch()]);
    console.log("[esbuild] watching...");
  } else {
    await Promise.all([esbuild.build(hostConfig), esbuild.build(webviewConfig)]);
    console.log("[esbuild] build complete");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
