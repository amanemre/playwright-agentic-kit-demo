import { z } from 'zod/v4';
import type { output as zOutput } from 'zod/v4';

/**
 * Schema for the user object returned by the Contact List API.
 * Source: "Log In User" 200 example in the API documentation
 * (https://documenter.getpostman.com/view/4012288/TzK2bEa8).
 */
export const UserSchema = z.strictObject({
    _id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
    __v: z.int(),
});

/**
 * Schema for the `POST /users/login` 200 and `POST /users` 201 responses
 * (both documented with the same `{ user, token }` body).
 */
export const UserResponseSchema = z.strictObject({
    user: UserSchema,
    token: z.string(),
});

/**
 * Schema for user login request payload.
 */
export const LoginRequestSchema = z.strictObject({
    email: z.email(),
    password: z.string().min(1),
});

/**
 * Schema for the `POST /users` (Add User) request payload.
 */
export const AddUserRequestSchema = z.strictObject({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.email(),
    password: z.string().min(1),
});

// Type exports
export type User = zOutput<typeof UserSchema>;
export type UserResponse = zOutput<typeof UserResponseSchema>;
export type LoginRequest = zOutput<typeof LoginRequestSchema>;
export type AddUserRequest = zOutput<typeof AddUserRequestSchema>;
