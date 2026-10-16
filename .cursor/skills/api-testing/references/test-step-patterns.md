# test.step Patterns and Empty-Body Anti-Pattern

> **Example Shop:** these examples use the fictional Example Shop — a JSON API with bearer tokens and meaningful HTTP status codes. Apply your project's API conventions from `PROJECT-PROFILE.md` (request encoding, authentication, where the outcome is reported); see `SKILL.md` → Project Specifics.

Long-form contrast examples extracted from `api-testing/SKILL.md` Phase 4 and Phase 6. The Critical rules and the canonical "correct" patterns stay inline in `SKILL.md`; this file holds the verbose forbidden examples for cases where reading them helps.

## Phase 4 — Forbidden: multiple API calls without `test.step`

```typescript
// FORBIDDEN: Multiple API calls without test.step
test(
    'POST /api/users creates a user that GET /api/users/{id} returns',
    { tag: '@api' },
    async ({ apiRequest }) => {
        const userData = generateUser();

        const { status: createStatus, body: createBody } =
            await apiRequest<UserResponse>({
                method: 'POST',
                url: '/api/users',
                baseUrl: process.env.API_URL,
                headers: process.env.ACCESS_TOKEN,
                body: userData,
            });
        expect(createStatus).toBe(201);
        expect(UserResponseSchema.parse(createBody)).toBeTruthy();
        const userId = createBody.id;

        const { status: getStatus, body: getBody } =
            await apiRequest<UserResponse>({
                method: 'GET',
                url: `/api/users/${userId}`,
                baseUrl: process.env.API_URL,
                headers: process.env.ACCESS_TOKEN,
            });
        expect(getStatus).toBe(200);
        expect(UserResponseSchema.parse(getBody)).toBeTruthy();
        expect(getBody.id).toBe(userId);
        expect(getBody.email).toBe(userData.email);
    }
);
```

Why it's forbidden: the trace shows one big test with no per-call breakdown. Debugging which call failed requires reading the assertions; reporting can't surface the create-vs-get-vs-delete structure.

**Fix:** Make each call its own WHEN step and each check its own THEN / AND step with one soft check; the second call starts a new part (`skipIfChecksFailed`). See `SKILL.md` Phase 4 for the canonical correct pattern.

## Phase 6 — Forbidden: empty-body-only validation

```typescript
// FORBIDDEN: Testing 400 with only an empty body
test.describe('POST /api/products - validation', () => {
    test(
        'POST /api/products with an empty body returns status 400',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const { status } = await apiRequest<BadRequestResponse>({
                method: 'POST',
                url: ApiEndpoints.PRODUCTS,
                baseUrl: process.env.API_URL,
                headers: process.env.ACCESS_TOKEN,
                body: {},
            });

            expect(status).toBe(400);
        }
    );
    // Missing: per-field omission tests, per-field invalid-type tests
});
```

An empty-body test is one of many — not a substitute for per-field coverage.

**Fix:** Add two more loops: per-field omission (destructure + rest) and per-field invalid-type (`for...of` over `INVALID_*` from `test-data/static/util/invalid-values.ts`). See `SKILL.md` Phase 6 for the canonical patterns.
