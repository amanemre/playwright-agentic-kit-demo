import { z } from 'zod';

/**
 * Request body of `POST /contacts` — fields as documented in the Postman
 * collection. The collection does not say which fields are required, so only
 * the name fields every contact row shows are required here.
 */
export const CreateContactRequestSchema = z.strictObject({
    firstName: z.string(),
    lastName: z.string(),
    birthdate: z.string().optional(),
    email: z.email().optional(),
    phone: z.string().optional(),
    street1: z.string().optional(),
    street2: z.string().optional(),
    city: z.string().optional(),
    stateProvince: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
});

export type CreateContactRequest = z.infer<typeof CreateContactRequestSchema>;
