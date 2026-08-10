import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import react from "eslint-plugin-react";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "base/**",
    "next-env.d.ts",
  ]),
  {
    plugins: { react },
    rules: {
      // Defensa en profundidad XSS: ningún dato de usuario puede renderizarse como HTML.
      "react/no-danger": "error",
    },
  },
]);

export default eslintConfig;
