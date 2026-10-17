/**
 * HTTP status codes used in assertions — both transport statuses and
 * status codes an API reports inside its response body.
 */
export enum HttpStatusCodes {
    OK = 200,
    CREATED = 201,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    NOT_FOUND = 404,
    METHOD_NOT_ALLOWED = 405,
}
