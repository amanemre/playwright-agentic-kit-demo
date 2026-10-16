import { z } from 'zod';

/** Request body of `POST /users` — fields as documented in the Postman collection */
export const CreateUserRequestSchema = z.strictObject({
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
    password: z.string(),
});

export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
