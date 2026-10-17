import { test as base } from '@playwright/test';
import { PageManager } from '../../pages/page-manager';

/**
 * Framework fixtures for page objects.
 * Page objects are not fixtures of their own — add new ones as getters in
 * `pages/page-manager.ts`.
 */
export type FrameworkFixtures = {
    /** Every page object, e.g. `pageManager.loginPage` */
    pageManager: PageManager;
    resetStorageState: () => Promise<void>;
};

/**
 * Extended test with page object fixtures.
 * Import this in your test files to access page objects.
 *
 * @example
 * ```ts
 * import { test, expect } from '../fixtures/fixtures';
 *
 * test('example test', async ({ pageManager }) => {
 *   await pageManager.loginPage.openLoginPage();
 *   await expect(pageManager.loginPage.loginHeading).toBeVisible();
 * });
 * ```
 */
export const test = base.extend<FrameworkFixtures>({
    pageManager: async ({ page }, use) => {
        await use(new PageManager(page));
    },

    resetStorageState: async ({ context }, use) => {
        await use(async () => {
            await context.clearCookies();
            await context.clearPermissions();
        });
    },
});
