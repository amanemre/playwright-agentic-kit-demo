# Helper Fixture — Worked Example

> **Your project's helper fixtures** live in `fixtures/helper/helper-fixture.ts` (preset path; see `PROJECT-PROFILE.md` → `paths.fixtures`), and the profile lists the project's worked examples. The generic `createdResource` example below uses the fictional Example Shop (JSON bodies, bearer tokens); adapt the request encoding, authentication and cleanup outcomes to the profile's API conventions.

Full code from Phase 8 of `api-testing/SKILL.md`. The decision matrix and the rule of thumb stay inline; this file shows the lifecycle-wired helper-fixture pattern.

## Pattern

```typescript
// In helper-fixture.ts
createdResource: async ({ request }, use) => {
    const { status, body } = await apiRequest({
        request,
        method: 'POST',
        url: '/api/resources',
        baseUrl: process.env.API_URL,
        headers: process.env.ACCESS_TOKEN,
        body: generateResource(),
    });
    // Setup checks only the status and reads only the field it needs —
    // no schema check, no `as` cast (INV-07)
    expect(status).toBe(HttpStatusCodes.CREATED);
    const created = z.looseObject({ id: z.string() }).parse(body);

    await use(created);

    const deleted = await apiRequest({
        request,
        method: 'DELETE',
        url: `/api/resources/${created.id}`,
        baseUrl: process.env.API_URL,
        headers: process.env.ACCESS_TOKEN,
    });
    // A failed cleanup is reported, never ignored (INV-08)
    expect(deleted.status).toBe(HttpStatusCodes.OK);
},
```

## Lifecycle

1. **Setup** — Code before `await use(...)` runs before the test.
2. **Yield** — `await use(data)` passes the created data to the test (typed).
3. **Teardown** — Code after `await use(...)` runs after the test, even if the test fails. Its status check makes a failed cleanup visible.

## Usage in a test

```typescript
test(
    'user renames a resource and sees the new name',
    { tag: '@regression' },
    async ({ createdResource, pageManager }) => {
        const newName = generateResourceName(); // factory — never hardcode test content

        await test.step('GIVEN the user is on the resource page', async () => {
            await pageManager.appPage.navigateToResource(createdResource.id);
        });

        await test.step('WHEN they rename the resource', async () => {
            await pageManager.appPage.editResource(newName);
        });

        await test.step('THEN the new name is shown', async () => {
            await expect
                .soft(pageManager.appPage.resourceName)
                .toHaveText(newName);
        });
    }
);
```

## When to promote (decision rule)

Promote setup/teardown to a helper fixture **only** when the same multi-step setup/teardown is reused across **3+ test files**. Otherwise keep the logic in `beforeAll`/`afterAll` in the single spec file and call `apiRequest` directly.

For the full decision matrix (`apiRequest` fixture vs helper fixture vs factory function) see `SKILL.md` Phase 8.
