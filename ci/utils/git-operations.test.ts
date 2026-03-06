import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getChangedFiles } from "./git-operations";

const originalCi = process.env.CI;
const originalGithubActions = process.env.GITHUB_ACTIONS;
const originalGithubBaseRef = process.env.GITHUB_BASE_REF;

afterEach(() => {
  if (originalCi === undefined) {
    delete process.env.CI;
  } else {
    process.env.CI = originalCi;
  }

  if (originalGithubActions === undefined) {
    delete process.env.GITHUB_ACTIONS;
  } else {
    process.env.GITHUB_ACTIONS = originalGithubActions;
  }

  if (originalGithubBaseRef === undefined) {
    delete process.env.GITHUB_BASE_REF;
  } else {
    process.env.GITHUB_BASE_REF = originalGithubBaseRef;
  }
});

describe("getChangedFiles", () => {
  it("throws in CI when base ref is missing", () => {
    process.env.CI = "true";
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_BASE_REF;

    assert.throws(
      () => getChangedFiles(),
      /Could not determine base ref for file changes/,
    );
  });

  it("returns null outside CI when git diff fails", () => {
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_BASE_REF;

    assert.equal(getChangedFiles({ cwd: "/" }), null);
  });
});
