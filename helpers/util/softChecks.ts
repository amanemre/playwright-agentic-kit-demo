import { test, TestInfo, TestStepInfo } from '@playwright/test';

/** Reason shown on a step that was skipped because an earlier check failed */
export const NOT_RUN_REASON = 'Not run: a check above failed';

/** Tests in which a step has already been skipped by these helpers */
const testsWithSkippedSteps = new WeakSet<TestInfo>();

/**
 * Skips the current step when a check earlier in the test has failed.
 *
 * A test is split into parts: an action (WHEN) and the soft checks on its
 * result (THEN / AND). The checks of one part all run, even when one fails.
 * The action that starts the NEXT part calls this first, so it does not run
 * on top of a failed state — it still shows in the report, skipped with
 * {@link NOT_RUN_REASON}. The checks of that part then call
 * {@link skipIfEarlierStepSkipped}.
 *
 * A skipped step returns `undefined`, so read its result only in steps that
 * are skipped along with it.
 *
 * @example
 * ```ts
 * const response = await test.step('WHEN the account is requested through GET /getUserDetailByEmail', async (step) => {
 *     skipIfChecksFailed(step);
 *     return apiRequest({ … });
 * });
 * await test.step('THEN the API answers "Account not found …"', (step) => {
 *     skipIfEarlierStepSkipped(step);
 *     expect.soft(response.body.message).toBe(…);
 * });
 * ```
 *
 * @param {TestStepInfo} step - The current step, from the `test.step` callback.
 * @returns {void} Skips (ends) the step when an earlier check failed.
 */
export function skipIfChecksFailed(step: TestStepInfo): void {
    const testInfo = test.info();

    if (testInfo.errors.length > 0) testsWithSkippedSteps.add(testInfo);
    skipIfEarlierStepSkipped(step);
}

/**
 * Skips the current step when an earlier step of the test was skipped by
 * {@link skipIfChecksFailed} — for the THEN / AND checks of a part whose
 * action was not run. Failures inside the same part do not skip it.
 *
 * @param {TestStepInfo} step - The current step, from the `test.step` callback.
 * @returns {void} Skips (ends) the step when an earlier step was skipped.
 */
export function skipIfEarlierStepSkipped(step: TestStepInfo): void {
    step.skip(testsWithSkippedSteps.has(test.info()), NOT_RUN_REASON);
}
