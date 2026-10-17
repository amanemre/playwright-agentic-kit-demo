# Fixtures — Worked Examples

## Example 1: Add a new page object to the page manager

User says: _"Expose the settings page to tests via a fixture."_

Actions:

1. **Phase 1** — New page object → extend `pages/page-manager.ts`.
2. **Phase 2** — Confirm the `SettingsPage` class was built after `playwright-cli` exploration and includes feedback/validation locators.
3. **Phase 4** — Add a `settingsPageInstance?: SettingsPage` cache field and a `get settingsPage(): SettingsPage` getter to `PageManager`. No fixture change.
4. No `mergeTests()` change (`pageManager` is already merged).
5. Consume in tests via `async ({ pageManager }) => { await pageManager.settingsPage.open(); }` — never `new SettingsPage(page)` inside a test, never a local `const settingsPage = pageManager.settingsPage`.

## Example 2: Do NOT create a fixture for a one-off API call

User says: _"Before this test I need to POST to `/api/flags` to enable a feature flag. Should I make a fixture?"_

Actions:

1. **Phase 1** — One-off setup, used by one test → **no fixture**. Call `apiRequest` directly inside `beforeEach` or inline in the test.
2. Promote to a helper fixture **only if** the same POST-to-`/api/flags` setup shows up in 3+ spec files with guaranteed teardown (see `api-testing` Phase 8 rule of thumb).

Result: the test stays self-contained, no fixture creep, no cross-test coupling.

## Example 3: Add a brand-new fixture category

User says: _"Add a `mailbox` fixture that exposes a test inbox for email-verification flows."_

Actions:

1. **Phase 1** — Not a page object, not API setup, not a plain helper → new category.
2. **Phase 3** — Create `fixtures/mailbox/mailbox-fixture.ts` with `export type MailboxFixtures` and `export const test = base.extend<MailboxFixtures>({ ... })`.
3. **Phase 4** — Implement the `mailbox` fixture with the `use()` callback, including teardown that purges the inbox.
4. **Phase 5** — Merge into `fixtures/fixtures.ts` via `mergeTests(pageObjectFixture, apiRequestFixture, helperFixture, mailboxFixture)`.
5. Consume in tests via `async ({ mailbox }) => { ... }` — no extra import in the spec file.
