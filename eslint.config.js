// @ts-check
import neostandard, { resolveIgnoresFromGitignore } from "neostandard";

export default [
  ...neostandard({
    ignores: resolveIgnoresFromGitignore(),
    ts: true,
    noStyle: true,
  }),
  {
    files: ["**/*.{ts,mts,cts,tsx,mtsx,ctsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          disallowTypeAnnotations: false,
          fixStyle: "separate-type-imports",
          prefer: "type-imports",
        },
      ],
    },
  },
];
