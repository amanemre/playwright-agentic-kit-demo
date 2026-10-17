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
