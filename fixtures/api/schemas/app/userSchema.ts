import { z } from 'zod';
import { Messages } from '../../../../enums/app/app';

/** Request body of `POST /users` — fields as documented in the Postman collection */
export const CreateUserRequestSchema = z.strictObject({
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
    password: z.string(),
});

export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

/** 201 response of `POST /users` — as documented in the Postman collection ("Add User") */
export const CreateUserResponseSchema = z.strictObject({
    user: z.strictObject({
        _id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        email: z.email(),
        __v: z.int(),
    }),
    token: z.string(),
});

export type CreateUserResponse = z.infer<typeof CreateUserResponseSchema>;

/** An error entry of a failed validator (required, length, email format) — characterization of the live app's answer */
const ValidatorErrorSchema = z.strictObject({
    name: z.literal('ValidatorError'),
    message: z.string(),
    properties: z.strictObject({
        message: z.string(),
        type: z.string(),
        path: z.string(),
        value: z.unknown().optional(),
        reason: z.unknown().optional(),
        minlength: z.int().optional(),
        maxlength: z.int().optional(),
    }),
    kind: z.string(),
    path: z.string(),
    value: z.unknown().optional(),
    reason: z.unknown().optional(),
});

/** An error entry of a value that cannot be cast to a string (array, object) — characterization of the live app's answer */
const CastErrorSchema = z.strictObject({
    stringValue: z.string(),
    kind: z.literal('string'),
    value: z.unknown(),
    path: z.string(),
    reason: z.null(),
});

/** 400 response of `POST /users` for an invalid field — characterization of the live app's answer (no documented error response; characterization) */
export const ValidationErrorResponseSchema = z.strictObject({
    errors: z.record(
        z.string(),
        z.union([ValidatorErrorSchema, CastErrorSchema])
    ),
    _message: z.literal(Messages.USER_VALIDATION_FAILED),
    message: z.string(),
});

/** 400 response of `POST /users` for an email that is already registered — characterization of the live app's answer */
export const EmailInUseResponseSchema = z.strictObject({
    message: z.literal(Messages.EMAIL_ALREADY_IN_USE),
});
