import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Same rules as the apps; this package has no pages directory and its own React version.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { settings: { react: { version: "19" } }, rules: { "@next/next/no-html-link-for-pages": "off" } },
]);
