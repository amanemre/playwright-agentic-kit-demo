import { faker } from '@faker-js/faker';
import {
    CreateContactRequest,
    CreateContactRequestSchema,
} from '../../../fixtures/api/schemas/app/contactSchema';

/**
 * Generates a valid contact payload for `POST /contacts`.
 * @param {Partial<CreateContactRequest>} overrides - Optional overrides for specific fields.
 * @returns {CreateContactRequest} A payload validated against the schema.
 */
export const generateContact = (
    overrides?: Partial<CreateContactRequest>
): CreateContactRequest =>
    CreateContactRequestSchema.parse({
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        ...overrides,
    });

/**
 * Generates a contact payload for `POST /contacts` with every field filled.
 * @param {Partial<CreateContactRequest>} overrides - Optional overrides for specific fields.
 * @returns {CreateContactRequest} A payload validated against the schema.
 */
export const generateFullContact = (
    overrides?: Partial<CreateContactRequest>
): CreateContactRequest => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    return CreateContactRequestSchema.parse({
        firstName,
        lastName,
        // yyyy-MM-dd, the format of the form's placeholder
        birthdate: faker.date.birthdate().toISOString().slice(0, 10),
        // lower case, as the API stores it
        email: faker.internet
            .exampleEmail({ firstName, lastName })
            .toLowerCase(),
        phone: faker.string.numeric(10),
        street1: faker.location.streetAddress(),
        street2: faker.location.secondaryAddress(),
        city: faker.location.city(),
        stateProvince: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode('#####'),
        country: faker.location.country(),
        ...overrides,
    });
};
