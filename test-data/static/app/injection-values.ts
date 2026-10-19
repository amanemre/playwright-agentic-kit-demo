/**
 * A MongoDB query operator sent in place of a string field — the NoSQL
 * injection representative for string fields (`test-plans/app/login-api.md`, `test-plans/app/add-user-api.md`, CL-1).
 */
export const NOSQL_OPERATOR_OBJECT = { $ne: null } as const;
