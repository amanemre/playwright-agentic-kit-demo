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

/**
 * Generates a valid user payload in which one field has exactly `length`
 * characters (an email's length is its local part); the content is generated.
 * @param {keyof CreateUserRequest} field - The field to size.
 * @param {number} length - The number of characters.
 * @returns {CreateUserRequest} A payload validated against the schema.
 */
export const generateUserWithLength = (
    field: keyof CreateUserRequest,
    length: number
): CreateUserRequest =>
    generateUser({
        [field]:
            field === 'email'
                ? `${faker.string.alpha({ length, casing: 'lower' })}@example.com`
                : faker.string.alpha(length),
    });
