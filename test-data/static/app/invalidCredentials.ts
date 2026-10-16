/**
 * Domain-specific invalid credentials for login tests.
 *
 * Three curated sets used by authentication negative tests:
 * - `INVALID_EMAILS` — email strings that should be rejected as malformed.
 * - `INVALID_PASSWORDS` — password strings that should be rejected as weak / malformed.
 * - `INVALID_LOGIN_ATTEMPTS` — paired `{ description, email, password }` objects
 *   for data-driven login-rejection tests that iterate full scenarios.
 *
 * Format: `.ts` with `as const` exports.
 * Static data files in this scaffold are TypeScript only; they may export
 * only literal values (no runtime imports, no functions, no computed values).
 * See `.claude/skills/data-strategy/SKILL.md` (Phase 3, Tier 2 — domain-specific).
 */

export const INVALID_EMAILS = [
    '',
    'plaintext',
    'missing-at-sign.com',
    'missing@domain',
    '@missing-local.com',
    'double@@at.com',
    'spaces in@email.com',
    'invalid@.com',
    'invalid@domain',
    'invalid@domain..com',
    'user@domain,com',
    'user name@domain.com',
] as const;

export const INVALID_PASSWORDS = [
    '',
    '123',
    'short',
    'NoNumber!',
    'nouppercase123!',
    'NOLOWERCASE123!',
    'NoSpecialChar123',
    '   spaces123!',
    'trailing ',
    ' leading',
] as const;

/**
 * Login attempts the Contact List app must reject. The app has no client-side
 * validation: every attempt reaches `POST /users/login`, which answers 401,
 * and the UI shows the single `Messages.LOGIN_ERROR` banner. Cases that need
 * the registered account (wrong password, unregistered email) are generated
 * at runtime in the spec — static data may hold only literals.
 */
export const INVALID_LOGIN_ATTEMPTS = [
    {
        description: 'empty email and password',
        email: '',
        password: '',
    },
    {
        description: 'email without password',
        email: 'unregistered.user@example.com',
        password: '',
    },
    {
        description: 'password without email',
        email: '',
        password: 'SomePassword123!',
    },
    {
        description: 'malformed email',
        email: 'not-an-email',
        password: 'SomePassword123!',
    },
    {
        description: 'email missing local part',
        email: '@missinglocal.com',
        password: 'SomePassword123!',
    },
] as const;
