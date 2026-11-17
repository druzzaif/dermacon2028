import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored / separately deployed code that is not part of this Next build.
    // venuemap is a nested project with its own package.json and `@/*` alias
    // (tsconfig.json excludes it for the same reason); google-script runs on
    // Google's Apps Script runtime, not in this bundle.
    "venuemap/**",
    "google-script/**",
    "google-script-sample/**",
  ]),
]);

export default eslintConfig;
