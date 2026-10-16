import { test as base } from '@playwright/test';
import { ContactListPage } from '../../pages/app/contact-list.page';
import { LoginPage } from '../../pages/app/login.page';

/**
 * Framework fixtures for page objects.
 * Add new page object types here as you create them.
 */
export type FrameworkFixtures = {
    /** Login page (the app's root route) */
    loginPage: LoginPage;
    /** Contact list page shown after login */
    contactListPage: ContactListPage;
    resetStorageState: () => Promise<void>;
};

/**
 * Extended test with page object fixtures.
 * Import this in your test files to access page objects.
 *
 * @example
 * ```ts
 * import { test, expect } from '../fixtures/pom/test-options';
 *
 * test('example test', async ({ loginPage }) => {
 *   await loginPage.open();
 *   await expect(loginPage.emailInput).toBeVisible();
 * });
 * ```
 */
export const test = base.extend<FrameworkFixtures>({
    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },

    contactListPage: async ({ page }, use) => {
        await use(new ContactListPage(page));
    },

    resetStorageState: async ({ context }, use) => {
        await use(async () => {
            await context.clearCookies();
            await context.clearPermissions();
        });
    },
});
