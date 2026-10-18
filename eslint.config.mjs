import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "dist/"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, ...globals.webextensions }
    },
    rules: {
      "no-unused-vars": ["error", { ignoreRestSiblings: true }]
    }
  },
  {
    files: ["background/**/*.js", "**/*.mjs"],
    languageOptions: { sourceType: "module" }
  },
  {
    files: ["offscreen/pcm-worklet.js"],
    languageOptions: {
      globals: { ...globals.audioWorklet, module: "writable" }
    }
  },
  {
    files: ["offscreen/audio-utils.js"],
    languageOptions: { globals: { module: "writable" } }
  },
  {
    files: ["test/**/*.js", "scripts/**/*.mjs"],
    languageOptions: { globals: globals.node }
  }
];
