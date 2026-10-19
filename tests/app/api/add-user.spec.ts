// plan: test-plans/app/add-user-api.md
import { z } from 'zod';
import { expect, test } from '../../../fixtures/fixtures';
import { ApiEndpoints, Messages } from '../../../enums/app/app';
import { HttpStatusCodes } from '../../../enums/util/http-status-codes';
import {
    ApiRequestFn,
    ApiRequestResponse,
} from '../../../fixtures/api/api-types';
import {
    CreateUserRequest,
    CreateUserResponse,
    CreateUserResponseSchema,
    EmailInUseResponseSchema,
    ValidationErrorResponseSchema,
} from '../../../fixtures/api/schemas/app/userSchema';
import {
    generateUser,
    generateUserWithLength,
} from '../../../test-data/factories/app/user.factory';
import {
    CONVERTED_VALUES,
    EMPTY_VALUE_KINDS,
    INVALID_EMAIL_PARTITIONS,
    INVALID_LENGTHS,
    REASON_KINDS,
    VALID_LENGTHS,
    WRONG_VALUES,
} from '../../../test-data/static/app/add-user-values';
import {
    skipIfChecksFailed,
    skipIfEarlierStepSkipped,
} from '../../../helpers/util/softChecks';

type Credentials = { email: string; password: string };
type ReportedErrors = Record<string, { kind: string; message?: string }>;

const fields = ['firstName', 'lastName', 'email', 'password'] as const;

/** Tokens of the accounts a test received a 201 for — each account is deleted after the test */
const created: string[] = [];

/** Only the field cleanup relies on (INV-07) */
const TokenSchema = z.looseObject({ token: z.string() });
const ErrorEntriesSchema = z.looseObject({
    errors: z.record(
        z.string(),
        z.looseObject({ kind: z.string(), message: z.string().optional() })
    ),
});

/**
 * Sends `POST /users`; every account it creates is deleted after the test.
 *
 * @param {ApiRequestFn} apiRequest - The API request fixture.
 * @param {Record<string, unknown>} details - The request payload.
 * @param {boolean} [asForm] - Send the payload form-encoded instead of JSON.
 * @returns {Promise<ApiRequestResponse<T>>} The response.
 */
async function signUp<T = unknown>(
    apiRequest: ApiRequestFn,
    details: Record<string, unknown>,
    asForm = false
): Promise<ApiRequestResponse<T>> {
    const payload = asForm
        ? {
              form: Object.fromEntries(
                  Object.entries(details).map(([key, value]) => [
                      key,
                      String(value),
                  ])
              ),
          }
        : { body: details };
    const response = await apiRequest<T>({
        method: 'POST',
        url: ApiEndpoints.USERS,
        baseUrl: process.env.API_URL,
        ...payload,
    });

    if (response.status === HttpStatusCodes.CREATED) {
        created.push(TokenSchema.parse(response.body).token);
    }

    return response;
}

/**
 * Sends `POST /users/login`.
 *
 * @param {ApiRequestFn} apiRequest - The API request fixture.
 * @param {Credentials} credentials - The email and password to log in with.
 * @returns {Promise<ApiRequestResponse>} The response.
 */
function logIn(
    apiRequest: ApiRequestFn,
    credentials: Credentials
): Promise<ApiRequestResponse> {
    return apiRequest({
        method: 'POST',
        url: ApiEndpoints.LOGIN,
        baseUrl: process.env.API_URL,
        body: credentials,
    });
}

/**
 * Reads the `errors` of a validation error response.
 *
 * @param {unknown} body - The response body.
 * @returns {ReportedErrors} The error entries by field, empty when there are none.
 */
function reportedErrors(body: unknown): ReportedErrors {
    const parsed = ErrorEntriesSchema.safeParse(body);

    return parsed.success ? parsed.data.errors : {};
}

async function checkStored(
    apiRequest: ApiRequestFn,
    field: keyof CreateUserRequest,
    response: ApiRequestResponse<CreateUserResponse>,
    user: Credentials,
    stored: string
): Promise<void> {
    if (field === 'password') {
        const login = await logIn(apiRequest, {
            email: user.email,
            password: stored,
        });
        expect.soft(login.status).toBe(HttpStatusCodes.OK);
    } else {
        expect.soft(response.body).toMatchObject({ user: { [field]: stored } });
    }
}

/**
 * The AND step that checks the account holds a sent value: a name or email in
 * the returned user, the password by logging in with it. The step is skipped
 * when a check before it failed.
 *
 * @param {string} title - The step title, as the plan words it.
 * @param {ApiRequestFn} apiRequest - The API request fixture.
 * @param {keyof CreateUserRequest} field - The field that was sent.
 * @param {ApiRequestResponse<CreateUserResponse>} response - The 201 response.
 * @param {Credentials} user - The sent account, for its email.
 * @param {string} stored - The value the account should hold.
 * @returns {Promise<void>}
 */
function verifyStored(
    title: string,
    apiRequest: ApiRequestFn,
    field: keyof CreateUserRequest,
    response: ApiRequestResponse<CreateUserResponse>,
    user: Credentials,
    stored: string
): Promise<void> {
    return test.step(title, async (step) => {
        skipIfChecksFailed(step);
        await checkStored(apiRequest, field, response, user, stored);
    });
}

const kindsOf = (errors: ReportedErrors): Record<string, string> =>
    Object.fromEntries(
        Object.entries(errors).map(([path, { kind }]) => [path, kind])
    );

const fieldsOf = (errors: ReportedErrors): string[] => Object.keys(errors);

/**
 * Checks that a sign-up was rejected as a validation error: 400, the expected
 * errors and the error schema.
 *
 * @param {ApiRequestResponse} response - The `POST /users` response.
 * @param {string} reports - What the errors should report, as the plan words it.
 * @param {(errors: ReportedErrors) => unknown} view - The part of the errors to compare.
 * @param {unknown} expected - What `view` should return.
 * @returns {Promise<void>}
 */
async function verifyRejected(
    response: ApiRequestResponse,
    reports: string,
    view: (errors: ReportedErrors) => unknown,
    expected: unknown
): Promise<void> {
    await test.step(`THEN HTTP status is ${HttpStatusCodes.BAD_REQUEST}`, () => {
        expect.soft(response.status).toBe(HttpStatusCodes.BAD_REQUEST);
    });

    await test.step(`AND ${reports}`, () => {
        expect.soft(view(reportedErrors(response.body))).toEqual(expected);
    });

    await test.step('AND the response body has the expected schema', () => {
        expect(ValidationErrorResponseSchema.parse(response.body)).toBeTruthy();
    });
}

test.describe(`POST ${ApiEndpoints.USERS}`, () => {
    test.afterEach(async ({ apiRequest }) => {
        for (const token of created.splice(0)) {
            const deletion = await apiRequest({
                method: 'DELETE',
                url: ApiEndpoints.CURRENT_USER,
                baseUrl: process.env.API_URL,
                headers: token,
            });
            expect(deletion.status).toBe(HttpStatusCodes.OK);
        }
    });

    test(
        'POST /users with valid details returns 201 and a token for the new account',
        { tag: '@smoke' },
        async ({ apiRequest }) => {
            const user = generateUser();

            const response =
                await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with a new user's details`, () =>
                    signUp<CreateUserResponse>(apiRequest, user));

            await test.step(`THEN HTTP status is ${HttpStatusCodes.CREATED}`, () => {
                expect.soft(response.status).toBe(HttpStatusCodes.CREATED);
            });

            await test.step('AND the returned user has the sent names and email', () => {
                expect.soft(response.body.user).toMatchObject({
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                });
            });

            await test.step('AND the response body has the expected schema', () => {
                expect(
                    CreateUserResponseSchema.parse(response.body)
                ).toBeTruthy();
            });

            const me =
                await test.step(`WHEN GET ${ApiEndpoints.CURRENT_USER} is sent with the returned token`, async (step) => {
                    skipIfChecksFailed(step);
                    return apiRequest({
                        method: 'GET',
                        url: ApiEndpoints.CURRENT_USER,
                        baseUrl: process.env.API_URL,
                        headers: response.body.token,
                    });
                });

            await test.step(`THEN HTTP status is ${HttpStatusCodes.OK}`, (step) => {
                skipIfEarlierStepSkipped(step);
                expect.soft(me.status).toBe(HttpStatusCodes.OK);
            });

            await test.step('AND it returns the same user', (step) => {
                skipIfEarlierStepSkipped(step);
                expect.soft(me.body).toMatchObject({
                    _id: response.body.user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                });
            });
        }
    );

    const normalisedInputs = [
        {
            input: 'a mixed-case email',
            field: 'email',
            send: (value: string): string =>
                value.replace(/^./, (c) => c.toUpperCase()),
        },
        {
            input: 'an email with surrounding spaces',
            field: 'email',
            send: (value: string): string => `  ${value}  `,
        },
        {
            input: 'a first name with surrounding spaces',
            field: 'firstName',
            send: (value: string): string => `  ${value}  `,
        },
        {
            input: 'a last name with surrounding spaces',
            field: 'lastName',
            send: (value: string): string => `  ${value}  `,
        },
    ] as const;

    for (const { input, field, send } of normalisedInputs) {
        test(
            `POST /users with ${input} returns 201 and the normalised value`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const user = generateUser();

                const response =
                    await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with \`${input}\` and the other fields valid`, () =>
                        signUp<CreateUserResponse>(apiRequest, {
                            ...user,
                            [field]: send(user[field]),
                        }));

                await test.step(`THEN HTTP status is ${HttpStatusCodes.CREATED}`, () => {
                    expect.soft(response.status).toBe(HttpStatusCodes.CREATED);
                });

                await test.step('AND the returned user holds the value in lower case and without the spaces', () => {
                    expect
                        .soft(response.body)
                        .toMatchObject({ user: { [field]: user[field] } });
                });
            }
        );
    }

    test(
        'POST /users with a password with surrounding spaces creates an account that logs in with the password exactly as sent',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const user = generateUser();
            const password = `  ${user.password}  `;

            const response =
                await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with a password with surrounding spaces`, () =>
                    signUp(apiRequest, { ...user, password }));

            await test.step(`THEN HTTP status is ${HttpStatusCodes.CREATED}`, () => {
                expect.soft(response.status).toBe(HttpStatusCodes.CREATED);
            });

            const login =
                await test.step(`WHEN POST ${ApiEndpoints.LOGIN} is sent with the password exactly as sent`, async (step) => {
                    skipIfChecksFailed(step);
                    return logIn(apiRequest, { email: user.email, password });
                });

            await test.step(`THEN HTTP status is ${HttpStatusCodes.OK}`, (step) => {
                skipIfEarlierStepSkipped(step);
                expect.soft(login.status).toBe(HttpStatusCodes.OK);
            });
        }
    );

    const letterCases = [
        {
            letterCase: 'the same letter case',
            send: (email: string): string => email,
        },
        {
            letterCase: 'upper case',
            send: (email: string): string => email.toUpperCase(),
        },
    ] as const;

    for (const { letterCase, send } of letterCases) {
        test(
            `POST /users with a registered email in ${letterCase} returns 400 and keeps the existing account`,
            { tag: '@api' },
            async ({ apiRequest, createdUser }) => {
                await test.step('GIVEN a registered user', () => undefined);

                const response =
                    await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with their email in \`${letterCase}\` and new names and password`, () =>
                        signUp(apiRequest, {
                            ...generateUser(),
                            email: send(createdUser.email),
                        }));

                await test.step(`THEN HTTP status is ${HttpStatusCodes.BAD_REQUEST}`, () => {
                    expect
                        .soft(response.status)
                        .toBe(HttpStatusCodes.BAD_REQUEST);
                });

                await test.step(`AND the message is "${Messages.EMAIL_ALREADY_IN_USE}"`, () => {
                    expect.soft(response.body).toMatchObject({
                        message: Messages.EMAIL_ALREADY_IN_USE,
                    });
                });

                await test.step('AND the response body has the expected schema', () => {
                    expect(
                        EmailInUseResponseSchema.parse(response.body)
                    ).toBeTruthy();
                });

                const login =
                    await test.step(`WHEN POST ${ApiEndpoints.LOGIN} is sent with the registered email and password`, async (step) => {
                        skipIfChecksFailed(step);
                        return logIn(apiRequest, createdUser);
                    });

                await test.step(`THEN HTTP status is ${HttpStatusCodes.OK}`, (step) => {
                    skipIfEarlierStepSkipped(step);
                    expect.soft(login.status).toBe(HttpStatusCodes.OK);
                });

                await test.step("AND it returns the registered user's names", (step) => {
                    skipIfEarlierStepSkipped(step);
                    expect.soft(login.body).toMatchObject({
                        user: {
                            firstName: createdUser.firstName,
                            lastName: createdUser.lastName,
                        },
                    });
                });
            }
        );
    }

    for (const field of fields) {
        test(
            `POST /users without "${field}" returns 400 and an error for that field`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const response =
                    await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent without \`${field}\` and the other fields valid`, () =>
                        signUp(apiRequest, {
                            ...generateUser(),
                            [field]: undefined,
                        }));

                await verifyRejected(
                    response,
                    `the error reports \`${field}\` as required, and no other field`,
                    kindsOf,
                    { [field]: 'required' }
                );
            }
        );
    }

    for (const field of fields) {
        test(
            `POST /users with an empty "${field}" returns 400 and an error for that field`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const response =
                    await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with \`${field}\` as an empty string and the other fields valid`, () =>
                        signUp(apiRequest, { ...generateUser(), [field]: '' }));

                await verifyRejected(
                    response,
                    `the error reports \`${field}\` only: as required for a name or the password, as an invalid email for email`,
                    kindsOf,
                    { [field]: EMPTY_VALUE_KINDS[field] }
                );
            }
        );
    }

    for (const { field, value, sent, reason } of WRONG_VALUES) {
        test(
            `POST /users with "${field}" as ${value} returns 400 and an error for that field`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const user = generateUser();

                const response =
                    await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with \`${field}\` as \`${value}\` and the other fields valid`, () =>
                        signUp(apiRequest, {
                            ...user,
                            [field]: sent(user[field]),
                        }));

                await verifyRejected(
                    response,
                    `the error reports \`${field}\` only, with the API's reason for this value: \`${reason}\``,
                    kindsOf,
                    { [field]: REASON_KINDS[reason] }
                );
            }
        );
    }

    for (const { field, value, sent, stored } of CONVERTED_VALUES) {
        test(
            `POST /users with "${field}" as ${value} returns 201 and stores it as a string`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const user = generateUser();

                const response =
                    await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with \`${field}\` as \`${value}\` and the other fields valid`, () =>
                        signUp<CreateUserResponse>(apiRequest, {
                            ...user,
                            [field]: sent,
                        }));

                await test.step(`THEN HTTP status is ${HttpStatusCodes.CREATED}`, () => {
                    expect.soft(response.status).toBe(HttpStatusCodes.CREATED);
                });

                await verifyStored(
                    'AND the account holds the value as a string',
                    apiRequest,
                    field,
                    response,
                    user,
                    stored
                );
            }
        );
    }

    for (const { partition, email } of INVALID_EMAIL_PARTITIONS) {
        test(
            `POST /users with an email ${partition} returns 400 and an error for "email"`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const response =
                    await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with an email \`${partition}\` and the other fields valid`, () =>
                        signUp(apiRequest, { ...generateUser(), email }));

                await verifyRejected(
                    response,
                    `the error reports email only, as "${Messages.EMAIL_INVALID}"`,
                    ({ email: entry, ...others }) => ({
                        others: Object.keys(others),
                        email: entry && {
                            kind: entry.kind,
                            message: entry.message,
                        },
                    }),
                    {
                        others: [],
                        email: {
                            kind: 'user defined',
                            message: Messages.EMAIL_INVALID,
                        },
                    }
                );
            }
        );
    }

    for (const { field, boundary, length } of VALID_LENGTHS) {
        test(
            `POST /users with "${field}" at ${boundary} returns 201`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const user = generateUserWithLength(field, length);

                const response =
                    await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with \`${field}\` at \`${boundary}\` and the other fields valid`, () =>
                        signUp<CreateUserResponse>(apiRequest, user));

                await test.step(`THEN HTTP status is ${HttpStatusCodes.CREATED}`, () => {
                    expect.soft(response.status).toBe(HttpStatusCodes.CREATED);
                });

                await verifyStored(
                    'AND the account holds the sent value',
                    apiRequest,
                    field,
                    response,
                    user,
                    user[field]
                );
            }
        );
    }

    for (const { field, boundary, length, kind } of INVALID_LENGTHS) {
        test(
            `POST /users with "${field}" at ${boundary} returns 400 and an error for that field`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const response =
                    await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with \`${field}\` at \`${boundary}\` and the other fields valid`, () =>
                        signUp(
                            apiRequest,
                            generateUserWithLength(field, length)
                        ));

                await verifyRejected(
                    response,
                    `the error reports \`${field}\` only, as too long, too short or (for email) invalid`,
                    kindsOf,
                    { [field]: kind }
                );
            }
        );
    }

    test(
        'POST /users with a 73-character password returns 400 and an error for "password"',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const response =
                await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with a 73-character password and the other fields valid`, () =>
                    signUp(apiRequest, generateUserWithLength('password', 73)));

            await verifyRejected(
                response,
                'the error reports password only',
                fieldsOf,
                ['password']
            );
        }
    );

    test(
        'POST /users with an empty body returns 400 and an error for every field',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const response =
                await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with \`{}\``, () =>
                    signUp(apiRequest, {}));

            await verifyRejected(
                response,
                'the errors report firstName, lastName, email and password as required',
                kindsOf,
                Object.fromEntries(fields.map((field) => [field, 'required']))
            );
        }
    );

    test(
        'POST /users with a form-encoded body returns 400 and creates no account',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const user = generateUser();

            const response =
                await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with a new user's details form-encoded`, () =>
                    signUp(apiRequest, user, true));

            await test.step(`THEN HTTP status is ${HttpStatusCodes.BAD_REQUEST}`, () => {
                expect.soft(response.status).toBe(HttpStatusCodes.BAD_REQUEST);
            });

            await test.step('AND the response body has the expected schema', () => {
                expect(
                    ValidationErrorResponseSchema.parse(response.body)
                ).toBeTruthy();
            });

            const login =
                await test.step(`WHEN POST ${ApiEndpoints.LOGIN} is sent with the sent email and password`, async (step) => {
                    skipIfChecksFailed(step);
                    return logIn(apiRequest, user);
                });

            await test.step(`THEN HTTP status is ${HttpStatusCodes.UNAUTHORIZED}`, (step) => {
                skipIfEarlierStepSkipped(step);
                expect.soft(login.status).toBe(HttpStatusCodes.UNAUTHORIZED);
            });
        }
    );

    test(
        'POST /users with an unknown extra field returns 201 and leaves it out of the user',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const response =
                await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with valid details and an extra \`role\` field`, () =>
                    signUp(apiRequest, { ...generateUser(), role: 'admin' }));

            await test.step(`THEN HTTP status is ${HttpStatusCodes.CREATED}`, () => {
                expect.soft(response.status).toBe(HttpStatusCodes.CREATED);
            });

            await test.step('AND the response body has the expected schema', () => {
                expect(
                    CreateUserResponseSchema.parse(response.body)
                ).toBeTruthy();
            });
        }
    );
});

test.describe(`PUT ${ApiEndpoints.USERS}`, () => {
    test('PUT /users returns 405', { tag: '@api' }, async ({ apiRequest }) => {
        // the live app hangs ~30 s before answering (plan: "Why tests currently fail")
        test.slow();

        const response =
            await test.step(`WHEN PUT ${ApiEndpoints.USERS} is sent`, () =>
                apiRequest({
                    method: 'PUT',
                    url: ApiEndpoints.USERS,
                    baseUrl: process.env.API_URL,
                }));

        await test.step(`THEN HTTP status is ${HttpStatusCodes.METHOD_NOT_ALLOWED}`, () => {
            expect
                .soft(response.status)
                .toBe(HttpStatusCodes.METHOD_NOT_ALLOWED);
        });
    });
});
