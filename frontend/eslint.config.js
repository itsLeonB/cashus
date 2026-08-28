import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

export default tseslint.config(
  { ignores: ["dist", ".remember"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, sonarjs.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    ignores: ['scripts/**'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "sonarjs/prefer-read-only-props": "error",
      "no-restricted-syntax": [
        "error",
        {
          "selector": "ImportDeclaration[source.value='react'] ImportNamespaceSpecifier",
          "message": "Do not use 'import * as React from \"react\"'. Use named imports instead (e.g., import { useState } from \"react\").",
        },
      ],
    },
  },
);
