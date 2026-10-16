import { expect, test as base } from '@playwright/test';
import { ApiEndpoints } from '../../enums/app/app';
import { generateNewUser } from '../../test-data/factories/app/user.factory';
import { apiRequest } from '../api/plain-function';
import {
    AddUserRequest,
    UserResponseSchema,
} from '../api/schemas/app/userSchema';

/**
 * Helper fixtures for important, recurring API-driven setup and teardown.
 *
 * IMPORTANT: Most API calls should be made directly with the `apiRequest` fixture
 * inside tests, `beforeEach`, or `afterEach`. Do NOT create a helper fixture for
 * every endpoint. Helper fixtures are reserved for critical, multi-step operations
 * that are reused across many test files and benefit from automatic lifecycle management.
 *
 * WORKFLOW:
 * Playwright's fixture lifecycle guarantees:
 *   1. Setup code (before `use()`) runs BEFORE the test
 *   2. Data passed to `use()` is available in the test via destructuring
 *   3. Teardown code (after `use()`) runs AFTER the test, even on failure
 *
 * WHEN TO CREATE A HELPER FIXTURE:
 * - The same multi-step setup/teardown is copy-pasted across 3+ test files
 * - Complex preconditions require multiple API calls in sequence
 * - Guaranteed teardown is critical (e.g., deleting test users, revoking tokens)
 *
 * WHEN TO USE `apiRequest` FIXTURE DIRECTLY INSTEAD:
 * - One-off API calls in a single test or test file
 * - API assertions (status codes, response validation)
 * - Simple setup in `beforeEach` / teardown in `afterEach`
 * - Calls specific to a single test describe block
 *
 * HOW TO ADD A NEW HELPER FIXTURE:
 * 1. Define the return type (or use a Zod schema's inferred type)
 * 2. Add the type to `HelperFixtures` below
 * 3. Implement the fixture with the setup → use() → teardown pattern
 * 4. It is automatically available in tests (already merged in test-options.ts)
 *
 * NOTE: Helper fixtures use `plain-function.ts` internally (not the `apiRequest`
 * fixture) because fixture-level code needs the raw `request` context. Tests
 * themselves should always use the `apiRequest` fixture from `test-options.ts`.
 *
 * @example
 * ```ts
 * import { expect, test } from '../../../fixtures/pom/test-options';
 *
 * test('should log in', async ({ registeredUser, loginPage }) => {
 *     // registeredUser was created before this test runs
 *     await loginPage.login(registeredUser.email, registeredUser.password);
 *     // registeredUser is deleted automatically after this test
 * });
 * ```
 */

// ==================== Types ====================

/** Name and credentials of a user registered for a single test. */
export type RegisteredUser = AddUserRequest;

/**
 * Helper fixture type definitions.
 * Add new setup/teardown fixtures here as you create them.
 */
export type HelperFixtures = {
    /**
     * A user registered via `POST /users` before the test and deleted via
     * `DELETE /users/me` after it. Use it for any test that needs a
     * successful login: the app rejects simultaneous logins to one account
     * (only one of N parallel `POST /users/login` calls returns 200), so
     * parallel tests must not share the APP_EMAIL account.
     */
    registeredUser: RegisteredUser;
};

// ==================== Fixtures ====================

export const test = base.extend<HelperFixtures>({
    /**
     * Registers a fresh user before the test and deletes it afterwards.
     * Teardown logs in again for a fresh token: a UI logout during the test
     * also revokes the token returned at registration.
     *
     * @param {APIRequestContext} request - Playwright request context (injected automatically).
     * @param {function} use - Playwright fixture lifecycle callback.
     */
    registeredUser: async ({ request }, use) => {
        // ── SETUP: Runs before the test ──────────────────────────────
        const newUser = generateNewUser();
        const { status, body } = await apiRequest({
            request,
            method: 'POST',
            url: ApiEndpoints.REGISTER,
            baseUrl: process.env.API_URL,
            body: newUser,
        });
        expect(status).toBe(201);
        expect(UserResponseSchema.parse(body)).toBeTruthy();

        // ── YIELD: Passes data to the test ───────────────────────────
        await use(newUser);

        // ── TEARDOWN: Runs after the test (even on failure) ──────────
        const login = await apiRequest({
            request,
            method: 'POST',
            url: ApiEndpoints.LOGIN,
            baseUrl: process.env.API_URL,
            body: { email: newUser.email, password: newUser.password },
        });
        expect(login.status).toBe(200);
        const { token } = UserResponseSchema.parse(login.body);

        const deleted = await apiRequest({
            request,
            method: 'DELETE',
            url: ApiEndpoints.CURRENT_USER,
            baseUrl: process.env.API_URL,
            headers: token,
        });
        expect(deleted.status).toBe(200);
    },
});
