import globals from "globals";

/* One rule matters here and it is no-undef.
 *
 * Two separate runs of the evaluation completed every model call, printed every
 * result, and then threw on a variable that was used but never declared. Both
 * were spelled correctly, both typechecked, and both cost real money before
 * failing. TypeScript does not see these files and a test that does not execute
 * the branch cannot catch them. A linter reads every branch without running any
 * of it. */
export default [
  {
    files: ["test/**/*.mjs", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-undef": "error",
      /* Three evaluation runs completed every model call and then died on a
         variable. Two were undeclared, which no-undef caught once it existed.
         The third was declared ten lines further down, which no-undef cannot
         see because the name does exist: it is the order that is wrong. */
      "no-use-before-define": ["error", { functions: false, classes: true, variables: true }],
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-const-assign": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
    },
  },
];
