/**
 * Commitlint config — EastPark custom format.
 * Accepts: [AhmedMuhammedElsaid][type]: subject
 * Where type is one of: feat, fix, chore, wip, docs, style, refactor, test, perf
 */
module.exports = {
  parserPreset: {
    parserOpts: {
      // Match: [AhmedMuhammedElsaid][feat]: subject or standard feat: subject
      headerPattern: /^(?:\[AhmedMuhammedElsaid\])?\[?(\w+)\]?:\s(.+)$/,
      headerCorrespondence: ["type", "subject"],
    },
  },
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "chore", "wip", "docs", "style", "refactor", "test", "perf", "revert", "ci"],
    ],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "subject-empty": [2, "never"],
    "subject-case": [0], // allow any case in subject
    "header-max-length": [2, "always", 120],
    "body-max-line-length": [2, "always", 120],
  },
};
