import neostandard, { resolveIgnoresFromGitignore } from "neostandard";
import packageJson from "eslint-plugin-package-json";

export default [
  ...neostandard({
    ignores: [...resolveIgnoresFromGitignore(), "package-lock.json"],
    noStyle: true,
    ts: true,
  }),
  packageJson.configs.recommended,
  {
    plugins: {
      "package-json": packageJson,
    },
    rules: {
      "package-json/require-description": "off",
      "package-json/require-version": "off",
      "package-json/sort-collections": [
        "error",
        [
          "config",
          "dependencies",
          "devDependencies",
          "exports",
          "lint-staged",
          "overrides",
          "peerDependencies",
          "scripts",
          "wireit",
        ],
      ],
    },
  },
];
