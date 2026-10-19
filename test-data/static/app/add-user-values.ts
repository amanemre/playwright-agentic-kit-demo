/**
 * Curated values for `POST /users` negative and boundary tests
 * (`test-plans/app/add-user-api.md`). Kinds are the `errors.<field>.kind`
 * the live app reports.
 */
import { NOSQL_OPERATOR_OBJECT } from './injection-values';

/** EF-1 — one email per format rule it breaks */
export const INVALID_EMAIL_PARTITIONS = [
    { partition: 'without "@"', email: 'plainaddress' },
    { partition: 'without a local part', email: '@example.com' },
    { partition: 'without a domain', email: 'explore@' },
    { partition: 'without a dot in the domain', email: 'explore@example' },
    {
        partition: 'with a space in the local part',
        email: 'explore x@example.com',
    },
    { partition: 'with two "@"', email: 'a@b@example.com' },
] as const;

/** The plan's readable reasons for a rejected value, and the `kind` the API reports for each */
export const REASON_KINDS = {
    required: 'required',
    'wrong type': 'string',
    'invalid email': 'user defined',
    'too short': 'minlength',
} as const;

const blank = (): string => '   ';
const nothing = (): null => null;
const arrayOf = (valid: string): string[] => [valid];
const operator = (): typeof NOSQL_OPERATOR_OBJECT => NOSQL_OPERATOR_OBJECT;
const aNumber = (): number => 123;
const aBoolean = (): boolean => true;

/** PT-1 — wrong values the API rejects, other than a missing or empty field; `sent` gets a valid value of the field */
export const WRONG_VALUES = [
    {
        field: 'firstName',
        value: 'whitespace only',
        sent: blank,
        reason: 'required',
    },
    { field: 'firstName', value: 'null', sent: nothing, reason: 'required' },
    {
        field: 'firstName',
        value: 'an array',
        sent: arrayOf,
        reason: 'wrong type',
    },
    {
        field: 'firstName',
        value: 'an operator object',
        sent: operator,
        reason: 'wrong type',
    },
    {
        field: 'lastName',
        value: 'whitespace only',
        sent: blank,
        reason: 'required',
    },
    { field: 'lastName', value: 'null', sent: nothing, reason: 'required' },
    {
        field: 'lastName',
        value: 'an array',
        sent: arrayOf,
        reason: 'wrong type',
    },
    {
        field: 'lastName',
        value: 'an operator object',
        sent: operator,
        reason: 'wrong type',
    },
    {
        field: 'email',
        value: 'a number',
        sent: aNumber,
        reason: 'invalid email',
    },
    {
        field: 'email',
        value: 'a boolean',
        sent: aBoolean,
        reason: 'invalid email',
    },
    { field: 'email', value: 'null', sent: nothing, reason: 'invalid email' },
    { field: 'email', value: 'an array', sent: arrayOf, reason: 'wrong type' },
    {
        field: 'email',
        value: 'an operator object',
        sent: operator,
        reason: 'wrong type',
    },
    {
        field: 'password',
        value: 'a boolean',
        sent: aBoolean,
        reason: 'too short',
    },
    { field: 'password', value: 'null', sent: nothing, reason: 'required' },
    {
        field: 'password',
        value: 'an array',
        sent: arrayOf,
        reason: 'wrong type',
    },
    {
        field: 'password',
        value: 'an operator object',
        sent: operator,
        reason: 'wrong type',
    },
] as const;

/** The API's reason for an empty string, per field */
export const EMPTY_VALUE_KINDS = {
    firstName: 'required',
    lastName: 'required',
    email: 'user defined',
    password: 'required',
} as const;

/** PT-1 — numbers and booleans the API converts to strings (kept as observed) */
export const CONVERTED_VALUES = [
    { field: 'firstName', value: 'a number', sent: 123, stored: '123' },
    { field: 'firstName', value: 'a boolean', sent: true, stored: 'true' },
    { field: 'lastName', value: 'a number', sent: 123, stored: '123' },
    { field: 'lastName', value: 'a boolean', sent: true, stored: 'true' },
    {
        field: 'password',
        value: 'an 8-digit number',
        sent: 12345678,
        stored: '12345678',
    },
] as const;

/** BT-1 — the valid side of every length border */
export const VALID_LENGTHS = [
    { field: 'firstName', boundary: '1 character', length: 1 },
    { field: 'firstName', boundary: '20 characters', length: 20 },
    { field: 'lastName', boundary: '1 character', length: 1 },
    { field: 'lastName', boundary: '20 characters', length: 20 },
    { field: 'password', boundary: '7 characters', length: 7 },
    { field: 'password', boundary: '72 characters', length: 72 },
    { field: 'email', boundary: 'a 64-character local part', length: 64 },
] as const;

/** BT-1 — the invalid side of the observed length borders */
export const INVALID_LENGTHS = [
    {
        field: 'firstName',
        boundary: '21 characters',
        length: 21,
        kind: 'maxlength',
    },
    {
        field: 'lastName',
        boundary: '21 characters',
        length: 21,
        kind: 'maxlength',
    },
    {
        field: 'password',
        boundary: '6 characters',
        length: 6,
        kind: 'minlength',
    },
    {
        field: 'email',
        boundary: 'a 65-character local part',
        length: 65,
        kind: 'user defined',
    },
] as const;
