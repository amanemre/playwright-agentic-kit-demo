import { test as base } from '@playwright/test';

/**
 * Helper fixtures for important, recurring setup and teardown — data created
 * before a test (preferably through the API) and removed after it, even when
 * the test fails. Add one when the same setup is needed in 3+ spec files.
 *
 * @example
 * ```ts
 * createdUser: async ({}, use) => {
 *     const user = await createUserViaApi(generateUser());
 *     await use(user);
 *     await deleteUserViaApi(user.id);
 * },
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled as the project adds helper fixtures
export type HelperFixtures = {};

export const test = base.extend<HelperFixtures>({});
