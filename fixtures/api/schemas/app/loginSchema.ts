import { z } from 'zod';

/** 200 response of `POST /users/login` — as documented in the Postman collection ("Log In User") */
export const LoginResponseSchema = z.strictObject({
    user: z.strictObject({
        _id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        email: z.email(),
        __v: z.int(),
    }),
    token: z.string(),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
