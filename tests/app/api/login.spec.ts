import { ApiEndpoints } from '../../../enums/app/app';
import {
    User,
    UserResponse,
    UserResponseSchema,
    UserSchema,
} from '../../../fixtures/api/schemas/app/userSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import { generateLoginCredentials } from '../../../test-data/factories/app/user.factory';
import {
    INVALID_EMAILS,
    INVALID_LOGIN_ATTEMPTS,
} from '../../../test-data/static/app/invalidCredentials';
import { INVALID_STRING_VALUES } from '../../../test-data/static/util/invalid-values';

/*
 * Contract source: "Log In User" in the Contact List API docs
 * (https://documenter.getpostman.com/view/4012288/TzK2bEa8), which documents
 * only the 200 response. No error responses are documented — every rejection
 * captured live is a 401 with an empty body, so 401 tests assert
 * `expect(body).toBeNull()` (there is no error schema to validate).
 *
 * Successful logins use the per-test `registeredUser`: the app rejects
 * simultaneous logins to one account. Rejected logins write nothing, so the
 * 401 tests can safely use the shared APP_EMAIL account.
 */
test.describe('api/login - POST /users/login', () => {
    // ==================== 200 ====================

    test(
        'should return 200 with the user and a token for valid credentials',
        { tag: '@api' },
        async ({ apiRequest, registeredUser }) => {
            const { status, body } = await apiRequest<UserResponse>({
                method: 'POST',
                url: ApiEndpoints.LOGIN,
                baseUrl: process.env.API_URL,
                body: {
                    email: registeredUser.email,
                    password: registeredUser.password,
                },
            });

            expect(status).toBe(200);
            expect(UserResponseSchema.parse(body)).toBeTruthy();
            expect(body.user.email).toBe(registeredUser.email);
            expect(body.user.firstName).toBe(registeredUser.firstName);
            expect(body.user.lastName).toBe(registeredUser.lastName);
        }
    );

    test(
        'should return a token that authenticates GET /users/me',
        { tag: '@api' },
        async ({ apiRequest, registeredUser }) => {
            let token = '';
            let userId = '';

            await test.step('Log in via POST /users/login', async () => {
                const { status, body } = await apiRequest<UserResponse>({
                    method: 'POST',
                    url: ApiEndpoints.LOGIN,
                    baseUrl: process.env.API_URL,
                    body: {
                        email: registeredUser.email,
                        password: registeredUser.password,
                    },
                });

                expect(status).toBe(200);
                expect(UserResponseSchema.parse(body)).toBeTruthy();
                token = body.token;
                userId = body.user._id;
            });

            await test.step('Get the profile via GET /users/me with the token', async () => {
                const { status, body } = await apiRequest<User>({
                    method: 'GET',
                    url: ApiEndpoints.CURRENT_USER,
                    baseUrl: process.env.API_URL,
                    headers: token,
                });

                expect(status).toBe(200);
                expect(UserSchema.parse(body)).toBeTruthy();
                expect(body._id).toBe(userId);
                expect(body.email).toBe(registeredUser.email);
            });
        }
    );

    test(
        'should return 200 when the email is sent in upper case',
        { tag: '@api' },
        async ({ apiRequest, registeredUser }) => {
            const { status, body } = await apiRequest<UserResponse>({
                method: 'POST',
                url: ApiEndpoints.LOGIN,
                baseUrl: process.env.API_URL,
                body: {
                    email: registeredUser.email.toUpperCase(),
                    password: registeredUser.password,
                },
            });

            expect(status).toBe(200);
            expect(UserResponseSchema.parse(body)).toBeTruthy();
            expect(body.user.email).toBe(registeredUser.email);
        }
    );

    test(
        'should return 200 when the email has surrounding whitespace',
        { tag: '@api' },
        async ({ apiRequest, registeredUser }) => {
            const { status, body } = await apiRequest<UserResponse>({
                method: 'POST',
                url: ApiEndpoints.LOGIN,
                baseUrl: process.env.API_URL,
                body: {
                    email: `  ${registeredUser.email}  `,
                    password: registeredUser.password,
                },
            });

            expect(status).toBe(200);
            expect(UserResponseSchema.parse(body)).toBeTruthy();
            expect(body.user.email).toBe(registeredUser.email);
        }
    );

    test(
        'should return 200 and ignore an unknown field in the body',
        { tag: '@api' },
        async ({ apiRequest, registeredUser }) => {
            const { status, body } = await apiRequest<UserResponse>({
                method: 'POST',
                url: ApiEndpoints.LOGIN,
                baseUrl: process.env.API_URL,
                body: {
                    email: registeredUser.email,
                    password: registeredUser.password,
                    unknownField: true,
                },
            });

            expect(status).toBe(200);
            expect(UserResponseSchema.parse(body)).toBeTruthy();
        }
    );

    // ==================== 401 — credentials ====================

    test(
        'should return 401 for a registered email with a wrong password',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const { password } = generateLoginCredentials();

            const { status, body } = await apiRequest<null>({
                method: 'POST',
                url: ApiEndpoints.LOGIN,
                baseUrl: process.env.API_URL,
                body: { email: process.env.APP_EMAIL!, password },
            });

            expect(status).toBe(401);
            expect(body).toBeNull();
        }
    );

    test(
        'should return 401 when the password differs only in letter case',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const password = process.env.APP_PASSWORD!;
            const swappedCase = [...password]
                .map((char) =>
                    char === char.toLowerCase()
                        ? char.toUpperCase()
                        : char.toLowerCase()
                )
                .join('');
            expect(swappedCase).not.toBe(password);

            const { status, body } = await apiRequest<null>({
                method: 'POST',
                url: ApiEndpoints.LOGIN,
                baseUrl: process.env.API_URL,
                body: { email: process.env.APP_EMAIL!, password: swappedCase },
            });

            expect(status).toBe(401);
            expect(body).toBeNull();
        }
    );

    test(
        'should return 401 when the password has trailing whitespace',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const { status, body } = await apiRequest<null>({
                method: 'POST',
                url: ApiEndpoints.LOGIN,
                baseUrl: process.env.API_URL,
                body: {
                    email: process.env.APP_EMAIL!,
                    password: `${process.env.APP_PASSWORD!} `,
                },
            });

            expect(status).toBe(401);
            expect(body).toBeNull();
        }
    );

    test(
        'should return 401 for an unregistered email',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const { status, body } = await apiRequest<null>({
                method: 'POST',
                url: ApiEndpoints.LOGIN,
                baseUrl: process.env.API_URL,
                body: generateLoginCredentials(),
            });

            expect(status).toBe(401);
            expect(body).toBeNull();
        }
    );

    for (const { description, email, password } of INVALID_LOGIN_ATTEMPTS) {
        test(
            `should return 401 for an invalid login attempt - ${description}`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const { status, body } = await apiRequest<null>({
                    method: 'POST',
                    url: ApiEndpoints.LOGIN,
                    baseUrl: process.env.API_URL,
                    body: { email, password },
                });

                expect(status).toBe(401);
                expect(body).toBeNull();
            }
        );
    }

    // ==================== 401 — body validation ====================
    // The docs define no validation error; the API answers every malformed
    // body with the same 401 as wrong credentials.

    test(
        'should return 401 for an empty body',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const { status, body } = await apiRequest<null>({
                method: 'POST',
                url: ApiEndpoints.LOGIN,
                baseUrl: process.env.API_URL,
                body: {},
            });

            expect(status).toBe(401);
            expect(body).toBeNull();
        }
    );

    const requiredFields = ['email', 'password'] as const;
    for (const field of requiredFields) {
        test(
            `should return 401 when ${field} is missing`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const validPayload = {
                    email: process.env.APP_EMAIL!,
                    password: process.env.APP_PASSWORD!,
                };
                const { [field]: _omitted, ...payloadWithoutField } =
                    validPayload;

                const { status, body } = await apiRequest<null>({
                    method: 'POST',
                    url: ApiEndpoints.LOGIN,
                    baseUrl: process.env.API_URL,
                    body: payloadWithoutField,
                });

                expect(status).toBe(401);
                expect(body).toBeNull();
            }
        );
    }

    for (const field of requiredFields) {
        for (const invalidValue of INVALID_STRING_VALUES) {
            test(
                `should return 401 when ${field} is ${JSON.stringify(invalidValue)}`,
                { tag: '@api' },
                async ({ apiRequest }) => {
                    const { status, body } = await apiRequest<null>({
                        method: 'POST',
                        url: ApiEndpoints.LOGIN,
                        baseUrl: process.env.API_URL,
                        body: {
                            email: process.env.APP_EMAIL!,
                            password: process.env.APP_PASSWORD!,
                            [field]: invalidValue,
                        },
                    });

                    expect(status).toBe(401);
                    expect(body).toBeNull();
                }
            );
        }
    }

    for (const invalidEmail of INVALID_EMAILS) {
        test(
            `should return 401 for a malformed email ${JSON.stringify(invalidEmail)}`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const { status, body } = await apiRequest<null>({
                    method: 'POST',
                    url: ApiEndpoints.LOGIN,
                    baseUrl: process.env.API_URL,
                    body: {
                        email: invalidEmail,
                        password: process.env.APP_PASSWORD!,
                    },
                });

                expect(status).toBe(401);
                expect(body).toBeNull();
            }
        );
    }

    // ==================== Known API bugs ====================

    // FIXME: no ticket yet — an array containing a registered email
    // (`{ "email": ["user@example.com"] }`) logs in with 200 instead of being
    // rejected; the email is not type-checked before the user lookup.
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
        'should return 401 when email is an array containing a registered email',
        { tag: '@api' },
        async ({ apiRequest, registeredUser }) => {
            const { status, body } = await apiRequest<null>({
                method: 'POST',
                url: ApiEndpoints.LOGIN,
                baseUrl: process.env.API_URL,
                body: {
                    email: [registeredUser.email],
                    password: registeredUser.password,
                },
            });

            expect(status).toBe(401);
            expect(body).toBeNull();
        }
    );

    // FIXME: no ticket yet — /users/login only supports POST, but GET answers
    // 200 with an HTML "404" page, and PUT / PATCH / DELETE answer 503
    // "Application Error" (the request crashes the server). Skipped so the
    // suite does not keep crashing the shared demo server.
    const unsupportedMethods = ['GET', 'PUT', 'PATCH', 'DELETE'] as const;
    for (const method of unsupportedMethods) {
        // eslint-disable-next-line playwright/no-skipped-test
        test.skip(
            `should return 404 or 405 for ${method} /users/login`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const { status } = await apiRequest<unknown>({
                    method,
                    url: ApiEndpoints.LOGIN,
                    baseUrl: process.env.API_URL,
                });

                expect([404, 405]).toContain(status);
            }
        );
    }

    // FIXME: no ticket yet — simultaneous logins to one account fail: only one
    // of N parallel requests returns 200, the rest return 401 (each login
    // rewrites the user document, so concurrent writes conflict).
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
        'should return 200 for every one of several simultaneous logins',
        { tag: '@api' },
        async ({ apiRequest, registeredUser }) => {
            const simultaneousLogins = 5;

            await test.step(`Send ${simultaneousLogins} simultaneous POST /users/login requests`, async () => {
                const responses = await Promise.all(
                    Array.from({ length: simultaneousLogins }, () =>
                        apiRequest<UserResponse>({
                            method: 'POST',
                            url: ApiEndpoints.LOGIN,
                            baseUrl: process.env.API_URL,
                            body: {
                                email: registeredUser.email,
                                password: registeredUser.password,
                            },
                        })
                    )
                );

                for (const { status, body } of responses) {
                    expect(status).toBe(200);
                    expect(UserResponseSchema.parse(body)).toBeTruthy();
                }
            });
        }
    );
});
