import { faker } from '@faker-js/faker';
import {
    CreateUserRequest,
    CreateUserRequestSchema,
} from '../../../fixtures/api/schemas/app/userSchema';

/**
 * Generates a valid, unique user payload for `POST /users`.
 * @param {Partial<CreateUserRequest>} overrides - Optional overrides for specific fields.
 * @returns {CreateUserRequest} A payload validated against the schema.
 */
export const generateUser = (
    overrides?: Partial<CreateUserRequest>
): CreateUserRequest => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    return CreateUserRequestSchema.parse({
        firstName,
        lastName,
        // lower case, as the API stores it, so responses echo it unchanged
        email: faker.internet
            .exampleEmail({
                firstName,
                lastName: `${lastName}${faker.string.numeric(8)}`,
            })
            .toLowerCase(),
        // lower-case letters only, so a capitalised copy is always a different password
        password: faker.internet.password({ length: 12, pattern: /[a-z]/ }),
        ...overrides,
    });
};
