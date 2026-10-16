import { ApiEndpoints } from '../../../enums/app/app';
import {
    UserResponse,
    UserResponseSchema,
} from '../../../fixtures/api/schemas/app/userSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import { INVALID_LOGIN_ATTEMPTS } from '../../../test-data/static/app/invalidCredentials';

test.describe('api/login', () => {
    test(
        'should return 200 and user data for valid credentials',
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
        }
    );

    // The API docs show no 401 example; captured live, the 401 response has
    // an empty body, so there is no error schema to validate against.
    for (const { description, email, password } of INVALID_LOGIN_ATTEMPTS) {
        test(
            `should return 401 for invalid credentials - ${description} - email: ${email} - password: ${password}`,
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
});
