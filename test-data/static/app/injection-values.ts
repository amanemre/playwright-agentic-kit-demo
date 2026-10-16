/**
 * A MongoDB query operator sent in place of a string field — the NoSQL
 * injection representative for the login fields (`test-plans/app/login-api.md`, CL-1).
 */
export const NOSQL_OPERATOR_OBJECT = { $ne: null } as const;
