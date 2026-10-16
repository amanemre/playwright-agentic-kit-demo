/** Supported authentication schemes for API requests */
export type AuthType = 'Bearer' | 'Token' | 'Basic';

/** Form-encoded request body (`application/x-www-form-urlencoded`) */
export type FormBody = Record<string, string | number | boolean>;

/** URL query parameters */
export type QueryParams = Record<string, string | number | boolean>;

/**
 * Parameters for making an API request.
 * @typedef {Object} ApiRequestParams
 * @property {'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD'} method - The HTTP method to use.
 * @property {string} url - The endpoint URL for the request.
 * @property {string} [baseUrl] - The base URL to prepend to the endpoint.
 * @property {Record<string, unknown> | null} [body] - JSON request payload. Mutually exclusive with `form`.
 * @property {FormBody} [form] - Form-encoded request payload. Mutually exclusive with `body`.
 * @property {QueryParams} [params] - Query string parameters.
 * @property {string} [headers] - Authentication token for the Authorization header.
 * @property {AuthType} [authType] - Authentication scheme to use (default: 'Bearer').
 */
export type ApiRequestParams = {
    method: 'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
    url: string;
    baseUrl?: string;
    body?: Record<string, unknown> | null;
    form?: FormBody;
    params?: QueryParams;
    headers?: string;
    authType?: AuthType;
};

/**
 * Response from an API request.
 * @template T
 * @typedef {Object} ApiRequestResponse
 * @property {number} status - The HTTP status code of the response.
 * @property {T} body - The response body.
 */
/**
 * The outcome part of an answer that reports its result in a body field (the
 * profile's API conventions name the field). Prerequisite and cleanup calls
 * check only this and the HTTP status — never the full schema, which is the
 * API specs' job. Narrow it to the project's field, e.g. `{ status: string }`.
 */
export type ApiOutcome = Record<string, unknown>;

export type ApiRequestResponse<T = unknown> = {
    status: number;
    body: T;
};

// define the function signature as a type
export type ApiRequestFn = <T = unknown>(
    params: ApiRequestParams
) => Promise<ApiRequestResponse<T>>;

// grouping them all together
export type ApiRequestMethods = {
    apiRequest: ApiRequestFn;
};
