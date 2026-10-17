// plan: test-plans/app/login-api.md
import { expect, test } from '../../../fixtures/fixtures';
import { ApiEndpoints } from '../../../enums/app/app';
import { HttpStatusCodes } from '../../../enums/util/http-status-codes';
import {
    LoginResponse,
    LoginResponseSchema,
} from '../../../fixtures/api/schemas/app/loginSchema';
import { generateUser } from '../../../test-data/factories/app/user.factory';
import { NOSQL_OPERATOR_OBJECT } from '../../../test-data/static/app/injection-values';
import { INVALID_STRING_VALUES } from '../../../test-data/static/util/invalid-values';
import {
    skipIfChecksFailed,
    skipIfEarlierStepSkipped,
} from '../../../helpers/util/softChecks';

type Credentials = { email: string; password: string };

/** One representative per invalid value partition, built from the test's own account */
const rejectedCredentials: {
    partition: string;
    credentials: (account: Credentials) => Credentials;
}[] = [
    {
        partition: 'a wrong password',
        credentials: ({ email }) => ({
            email,
            password: generateUser().password,
        }),
    },
    {
        partition: 'an unregistered email',
        credentials: ({ password }) => ({
            email: generateUser().email,
            password,
        }),
    },
    {
        partition: 'an empty email',
        credentials: ({ password }) => ({ email: '', password }),
    },
    {
        partition: 'an empty password',
        credentials: ({ email }) => ({ email, password: '' }),
    },
];

const fields = ['email', 'password'] as const;

/**
 * Checks that a login request was rejected: 401 with an empty body.
 *
 * @param {{ status: number; body: unknown }} response - The login response.
 * @returns {Promise<void>}
 */
async function verifyRejected(response: {
    status: number;
    body: unknown;
}): Promise<void> {
    await test.step(`THEN HTTP status is ${HttpStatusCodes.UNAUTHORIZED}`, () => {
        expect.soft(response.status).toBe(HttpStatusCodes.UNAUTHORIZED);
    });

    await test.step('AND the response body is empty', () => {
        expect.soft(response.body).toBeNull();
    });
}

test.describe(`POST ${ApiEndpoints.LOGIN}`, () => {
    test(
        'POST /users/login with a registered email and password returns 200 and a token for that user',
        { tag: '@api' },
        async ({ apiRequest, createdUser }) => {
            const login =
                await test.step(`WHEN POST ${ApiEndpoints.LOGIN} is sent with their email and password`, () =>
                    apiRequest<LoginResponse>({
                        method: 'POST',
                        url: ApiEndpoints.LOGIN,
                        baseUrl: process.env.API_URL,
                        body: {
                            email: createdUser.email,
                            password: createdUser.password,
                        },
                    }));

            await test.step(`THEN HTTP status is ${HttpStatusCodes.OK}`, () => {
                expect.soft(login.status).toBe(HttpStatusCodes.OK);
            });

            await test.step("AND the returned user has the account's name and email", () => {
                expect.soft(login.body.user).toMatchObject({
                    firstName: createdUser.firstName,
                    lastName: createdUser.lastName,
                    email: createdUser.email,
                });
            });

            await test.step('AND the response body has the expected schema', () => {
                expect(LoginResponseSchema.parse(login.body)).toBeTruthy();
            });

            const me =
                await test.step(`WHEN GET ${ApiEndpoints.CURRENT_USER} is sent with the returned token`, async (step) => {
                    skipIfChecksFailed(step);
                    return apiRequest({
                        method: 'GET',
                        url: ApiEndpoints.CURRENT_USER,
                        baseUrl: process.env.API_URL,
                        headers: login.body.token,
                    });
                });

            await test.step(`THEN HTTP status is ${HttpStatusCodes.OK}`, (step) => {
                skipIfEarlierStepSkipped(step);
                expect.soft(me.status).toBe(HttpStatusCodes.OK);
            });

            await test.step('AND it returns the same user', (step) => {
                skipIfEarlierStepSkipped(step);
                expect.soft(me.body).toMatchObject({
                    _id: login.body.user._id,
                    email: login.body.user.email,
                });
            });
        }
    );

    for (const { partition, credentials } of rejectedCredentials) {
        test(
            `POST /users/login with ${partition} returns 401 and an empty body`,
            { tag: '@api' },
            async ({ apiRequest, createdUser }) => {
                const response =
                    await test.step(`WHEN POST ${ApiEndpoints.LOGIN} is sent with ${partition} and the other field valid`, () =>
                        apiRequest({
                            method: 'POST',
                            url: ApiEndpoints.LOGIN,
                            baseUrl: process.env.API_URL,
                            body: credentials(createdUser),
                        }));

                await verifyRejected(response);
            }
        );
    }

    test(
        'POST /users/login with an empty body returns 401 and an empty body',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const response =
                await test.step(`WHEN POST ${ApiEndpoints.LOGIN} is sent with {}`, () =>
                    apiRequest({
                        method: 'POST',
                        url: ApiEndpoints.LOGIN,
                        baseUrl: process.env.API_URL,
                        body: {},
                    }));

            await verifyRejected(response);
        }
    );

    for (const field of fields) {
        for (const value of [...INVALID_STRING_VALUES, NOSQL_OPERATOR_OBJECT]) {
            const type = JSON.stringify(value) ?? 'undefined';

            test(
                `POST /users/login with "${field}" as ${type} returns 401 and an empty body`,
                { tag: '@api' },
                async ({ apiRequest, createdUser }) => {
                    const response =
                        await test.step(`WHEN POST ${ApiEndpoints.LOGIN} is sent with "${field}" as ${type} and the other field valid`, () =>
                            apiRequest({
                                method: 'POST',
                                url: ApiEndpoints.LOGIN,
                                baseUrl: process.env.API_URL,
                                body: {
                                    email: createdUser.email,
                                    password: createdUser.password,
                                    [field]: value,
                                },
                            }));

                    await verifyRejected(response);
                }
            );
        }

        test(
            `POST /users/login with "${field}" as an array holding the account's value returns 401 and an empty body`,
            { tag: '@api' },
            async ({ apiRequest, createdUser }) => {
                const response =
                    await test.step(`WHEN POST ${ApiEndpoints.LOGIN} is sent with "${field}" as an array holding the account's value`, () =>
                        apiRequest({
                            method: 'POST',
                            url: ApiEndpoints.LOGIN,
                            baseUrl: process.env.API_URL,
                            body: {
                                email: createdUser.email,
                                password: createdUser.password,
                                [field]: [createdUser[field]],
                            },
                        }));

                await verifyRejected(response);
            }
        );
    }

    test(
        'POST /users/login with a form-encoded body returns 401 and an empty body',
        { tag: '@api' },
        async ({ apiRequest, createdUser }) => {
            const response =
                await test.step(`WHEN POST ${ApiEndpoints.LOGIN} is sent with their email and password form-encoded`, () =>
                    apiRequest({
                        method: 'POST',
                        url: ApiEndpoints.LOGIN,
                        baseUrl: process.env.API_URL,
                        form: {
                            email: createdUser.email,
                            password: createdUser.password,
                        },
                    }));

            await verifyRejected(response);
        }
    );
});

test.describe(`PUT ${ApiEndpoints.LOGIN}`, () => {
    test(
        'PUT /users/login returns 405',
        { tag: '@api' },
        async ({ apiRequest }) => {
            // the live app hangs ~30 s before answering (plan: "Why tests currently fail")
            test.slow();

            const response =
                await test.step(`WHEN PUT ${ApiEndpoints.LOGIN} is sent`, () =>
                    apiRequest({
                        method: 'PUT',
                        url: ApiEndpoints.LOGIN,
                        baseUrl: process.env.API_URL,
                    }));

            await test.step(`THEN HTTP status is ${HttpStatusCodes.METHOD_NOT_ALLOWED}`, () => {
                expect
                    .soft(response.status)
                    .toBe(HttpStatusCodes.METHOD_NOT_ALLOWED);
            });
        }
    );
});
