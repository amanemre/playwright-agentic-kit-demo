import { APIRequestContext, test as base, expect } from '@playwright/test';
import { z } from 'zod';
import { ApiEndpoints } from '../../enums/app/app';
import { HttpStatusCodes } from '../../enums/util/http-status-codes';
import { CreateContactRequest } from '../api/schemas/app/contactSchema';
import { CreateUserRequest } from '../api/schemas/app/userSchema';
import { apiRequest } from '../api/plain-function';
import { generateContact } from '../../test-data/factories/app/contact.factory';
import { generateUser } from '../../test-data/factories/app/user.factory';

/** An account created for one test, with the token `POST /users` returned */
export type CreatedUser = CreateUserRequest & { token: string };

/** A contact created for one test in the `createdUser` account */
export type CreatedContact = CreateContactRequest & { id: string };

/**
 * Helper fixtures for important, recurring setup and teardown — data created
 * before a test (preferably through the API) and removed after it, even when
 * the test fails. Add one when the same setup is needed in 3+ spec files.
 */
export type HelperFixtures = {
    /** A new account, deleted after the test */
    createdUser: CreatedUser;
    /** One contact in `createdUser`'s account, deleted after the test */
    createdContact: CreatedContact;
};

/**
 * Logs in through the API and returns a fresh token — teardown cannot reuse
 * the setup token, because a test may have logged out and invalidated it.
 *
 * @param {APIRequestContext} request - The Playwright request context.
 * @param {CreatedUser} user - The account to log in with.
 * @returns {Promise<string>} A valid session token.
 */
async function loginViaApi(
    request: APIRequestContext,
    user: CreatedUser
): Promise<string> {
    const { status, body } = await apiRequest({
        request,
        method: 'POST',
        url: ApiEndpoints.LOGIN,
        baseUrl: process.env.API_URL,
        body: { email: user.email, password: user.password },
    });
    expect(status).toBe(HttpStatusCodes.OK);

    return z.looseObject({ token: z.string() }).parse(body).token;
}

export const test = base.extend<HelperFixtures>({
    createdUser: async ({ request }, use) => {
        const user = generateUser();
        const { status, body } = await apiRequest({
            request,
            method: 'POST',
            url: ApiEndpoints.USERS,
            baseUrl: process.env.API_URL,
            body: user,
        });
        expect(status).toBe(HttpStatusCodes.CREATED);
        const { token } = z.looseObject({ token: z.string() }).parse(body);

        const createdUser = { ...user, token };
        await use(createdUser);

        const deletion = await apiRequest({
            request,
            method: 'DELETE',
            url: ApiEndpoints.CURRENT_USER,
            baseUrl: process.env.API_URL,
            headers: await loginViaApi(request, createdUser),
        });
        expect(deletion.status).toBe(HttpStatusCodes.OK);
    },

    createdContact: async ({ request, createdUser }, use) => {
        const contact = generateContact();
        const { status, body } = await apiRequest({
            request,
            method: 'POST',
            url: ApiEndpoints.CONTACTS,
            baseUrl: process.env.API_URL,
            body: contact,
            headers: createdUser.token,
        });
        expect(status).toBe(HttpStatusCodes.CREATED);
        const { _id: id } = z.looseObject({ _id: z.string() }).parse(body);

        await use({ ...contact, id });

        const deletion = await apiRequest({
            request,
            method: 'DELETE',
            url: `${ApiEndpoints.CONTACTS}/${id}`,
            baseUrl: process.env.API_URL,
            headers: await loginViaApi(request, createdUser),
        });
        expect(deletion.status).toBe(HttpStatusCodes.OK);
    },
});
