import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["out", "dist", "**/*.d.ts", "node_modules"],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      curly: "warn",
      eqeqeq: "warn",
      "no-throw-literal": "warn",
      semi: ["warn", "always"],
    },
  },
  // Bridge browser scripts: ES modules running in the browser.
  // Catches missing imports (no-undef) and dead imports / vars
  // (no-unused-vars) — exactly the class of bug that shipped 2.1.7
  // with `bufferIfPaused` referenced but not imported.
  {
    files: ["bridge/public/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        // Socket.IO client is loaded via a <script> tag in index.html.
        io: "readonly",
        // xterm.js + addons are loaded the same way.
        Terminal: "readonly",
        FitAddon: "readonly",
        WebLinksAddon: "readonly",
        WebglAddon: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          // Imported-but-unused is the other half of the bug class.
          ignoreRestSiblings: true,
        },
      ],
      "no-undef-init": "error",
      "no-redeclare": "error",
    },
  },
);
