import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  getChangedFiles,
  getGitRefs,
  isPullRequestContext,
} from "./git-operations";

const originalCi = process.env.CI;
const originalGithubActions = process.env.GITHUB_ACTIONS;
const originalGithubBaseRef = process.env.GITHUB_BASE_REF;
const originalGithubHeadRef = process.env.GITHUB_HEAD_REF;
const originalGithubSha = process.env.GITHUB_SHA;
const originalGithubEventName = process.env.GITHUB_EVENT_NAME;
const originalGithubPrNumber = process.env.GITHUB_PR_NUMBER;
const originalForcePrValidation = process.env.CI_FORCE_PR_VALIDATION;

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

  if (originalGithubHeadRef === undefined) {
    delete process.env.GITHUB_HEAD_REF;
  } else {
    process.env.GITHUB_HEAD_REF = originalGithubHeadRef;
  }

  if (originalGithubSha === undefined) {
    delete process.env.GITHUB_SHA;
  } else {
    process.env.GITHUB_SHA = originalGithubSha;
  }

  if (originalGithubEventName === undefined) {
    delete process.env.GITHUB_EVENT_NAME;
  } else {
    process.env.GITHUB_EVENT_NAME = originalGithubEventName;
  }

  if (originalGithubPrNumber === undefined) {
    delete process.env.GITHUB_PR_NUMBER;
  } else {
    process.env.GITHUB_PR_NUMBER = originalGithubPrNumber;
  }

  if (originalForcePrValidation === undefined) {
    delete process.env.CI_FORCE_PR_VALIDATION;
  } else {
    process.env.CI_FORCE_PR_VALIDATION = originalForcePrValidation;
  }
});

describe("getGitRefs", () => {
  it("prefers GITHUB_HEAD_REF over GITHUB_SHA", () => {
    process.env.CI = "true";
    process.env.GITHUB_ACTIONS = "true";
    delete process.env.GITHUB_BASE_REF;
    process.env.GITHUB_HEAD_REF = "feature/localization";
    process.env.GITHUB_SHA = "abc123";

    assert.deepEqual(getGitRefs(), {
      baseRef: undefined,
      headRef: "feature/localization",
    });
  });

  it("uses GITHUB_SHA when GITHUB_HEAD_REF is missing", () => {
    process.env.CI = "true";
    process.env.GITHUB_ACTIONS = "true";
    delete process.env.GITHUB_BASE_REF;
    delete process.env.GITHUB_HEAD_REF;
    process.env.GITHUB_SHA = "deadbeef";

    assert.deepEqual(getGitRefs(), {
      baseRef: undefined,
      headRef: "deadbeef",
    });
  });

  it("throws when base ref is unsafe", () => {
    process.env.CI = "true";
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_BASE_REF = "-invalid-ref";
    process.env.GITHUB_HEAD_REF = "feature/test";

    assert.throws(() => getGitRefs(), /Unsafe base ref/);
  });
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

describe("isPullRequestContext", () => {
  it("detects pull_request event", () => {
    process.env.GITHUB_EVENT_NAME = "pull_request";

    assert.equal(isPullRequestContext(), true);
  });

  it("detects PR number fallback", () => {
    delete process.env.GITHUB_EVENT_NAME;
    process.env.GITHUB_PR_NUMBER = "42";

    assert.equal(isPullRequestContext(), true);
  });

  it("detects manual override", () => {
    delete process.env.GITHUB_EVENT_NAME;
    delete process.env.GITHUB_PR_NUMBER;
    process.env.CI_FORCE_PR_VALIDATION = "true";

    assert.equal(isPullRequestContext(), true);
  });

  it("returns false without PR signals", () => {
    delete process.env.GITHUB_EVENT_NAME;
    delete process.env.GITHUB_PR_NUMBER;
    delete process.env.CI_FORCE_PR_VALIDATION;

    assert.equal(isPullRequestContext(), false);
  });
});
