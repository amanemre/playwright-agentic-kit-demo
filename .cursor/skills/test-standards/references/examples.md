# Test Standards — Worked Examples

Four end-to-end spec patterns, one per test type the scaffold supports. Phase numbers refer to `test-standards/SKILL.md`; every example follows the Phase 4 report structure (one step per line, one soft check per THEN / AND step, later parts skipped after a failed check). The `// plan:` line and imports are left out after Example 1.

## Example 1: Functional smoke test

```typescript
// plan: test-plans/{area}/account.md
import { expect, test } from '../../../fixtures/fixtures';
import { Messages } from '../../../enums/{area}/{area}';

// Every test logs in as its own throwaway account — start logged out
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('account', () => {
    test(
        'registered user can log in with their email and password',
        { tag: '@smoke' },
        async ({ createdUser, pageManager }) => {
            await test.step('GIVEN the user is on the Signup / Login page', async () => {
                await pageManager.loginPage.openLoginPage();
            });

            await test.step('WHEN they log in with their email and password', async () => {
                await pageManager.loginPage.login(
                    createdUser.email,
                    createdUser.password
                );
            });

            await test.step(`THEN the header shows "${Messages.LOGGED_IN_AS} ${createdUser.name}"`, async () => {
                await expect
                    .soft(pageManager.loginPage.nav.loggedInAs)
                    .toContainText(createdUser.name);
            });
        }
    );
});
```

## Example 2: Data-driven regression (TS static data)

```typescript
// Illustrative — create this file with the first negative login spec (data-strategy skill)
import { INVALID_LOGIN_ATTEMPTS } from '../../../test-data/static/{area}/invalidCredentials';

test.describe('login - invalid credentials', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    for (const { description, email, password } of INVALID_LOGIN_ATTEMPTS) {
        test(
            `login with ${description} shows an error message`,
            { tag: '@regression' },
            async ({ pageManager }) => {
                await test.step('GIVEN the user is on the Signup / Login page', async () => {
                    await pageManager.loginPage.openLoginPage();
                });

                await test.step(`WHEN they log in with ${description}`, async () => {
                    await pageManager.loginPage.login(email, password);
                });

                await test.step('THEN the error message is shown', async () => {
                    await expect
                        .soft(pageManager.loginPage.loginErrorMessage)
                        .toBeVisible();
                });
            }
        );
    }
});
```

## Example 3: Destructive test with cleanup

```typescript
test.describe('admin - data management', () => {
    test.afterEach(async ({ apiRequest }) => {
        await apiRequest({
            method: 'POST',
            url: ApiEndpoints.RESET_DATA, // illustrative
            baseUrl: process.env.API_URL,
        });
    });

    test(
        'admin deletes all inactive users',
        { tag: '@destructive' },
        async ({ apiRequest }) => {
            const { status } =
                await test.step('WHEN DELETE /api/admin/inactive-users is sent', () =>
                    apiRequest({
                        method: 'DELETE',
                        url: '/api/admin/inactive-users', // illustrative — use an ApiEndpoints enum
                        baseUrl: process.env.API_URL,
                    }));

            // illustrative — add NO_CONTENT = 204 to enums/util/http-status-codes.ts when first used
            await test.step('THEN HTTP status is 204', () => {
                expect.soft(status).toBe(HttpStatusCodes.NO_CONTENT);
            });
        }
    );
});
```

Run with: `npm run test:destructive` (single worker, excluded from `npm test`).

## Example 4: E2E multi-feature journey

Each action starts a new part. Its checks all run; the next action runs only when they passed, otherwise it and its checks are shown as "Not run".

```typescript
import {
    skipIfChecksFailed,
    skipIfEarlierStepSkipped,
} from '../../../helpers/util/softChecks';

test.describe('todo - full journey', () => {
    test.beforeEach(async ({ resetStorageState, pageManager }) => {
        await resetStorageState();
        await pageManager.appPage.openHomePage();
    });

    test(
        'user adds three todos, completes one, filters to active and clears the completed one',
        { tag: '@e2e' },
        async ({ pageManager }) => {
            const todos = generateTodos(3); // factory — never hardcode test content

            await test.step('GIVEN the user has added three todos', async () => {
                for (const todo of todos)
                    await pageManager.todoPage.addTodo(todo);
            });

            await test.step('WHEN they complete the first todo and filter to active', async () => {
                await pageManager.todoPage.completeTodo(todos[0]);
                await pageManager.todoPage.filterByActive();
            });

            await test.step('THEN only the two active todos are shown', async () => {
                await expect
                    .soft(pageManager.todoPage.todoItems)
                    .toHaveCount(2);
            });

            await test.step('WHEN they clear the completed todos', async (step) => {
                skipIfChecksFailed(step);
                await pageManager.todoPage.clearCompleted();
            });

            await test.step('THEN the completed count is zero', async (step) => {
                skipIfEarlierStepSkipped(step);
                await expect
                    .soft(pageManager.todoPage.completedCount)
                    .toHaveText('0');
            });
        }
    );
});
```
