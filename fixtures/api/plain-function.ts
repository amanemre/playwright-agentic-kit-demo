import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { AuthType, FormBody, QueryParams } from './api-types';

/**
 * Simplified helper for making API requests and returning the status and parsed body.
 * This helper automatically performs the request based on the provided method, URL, body, and headers.
 *
 * Bodies can be sent as JSON (`body`) or form-encoded (`form`), never both.
 * The response is parsed as JSON whenever it is valid JSON, regardless of the
 * `Content-Type` header (some APIs serve JSON as `text/html`); otherwise the raw
 * text is returned.
 *
 * @param {Object} params - The parameters for the request.
 * @param {APIRequestContext} params.request - The Playwright request object, used to make the HTTP request.
 * @param {string} params.method - The HTTP method to use (POST, GET, PUT, DELETE, PATCH, HEAD).
 * @param {string} params.url - The URL to send the request to.
 * @param {string} [params.baseUrl] - The base URL to prepend to the request URL.
 * @param {Record<string, unknown> | null} [params.body=null] - JSON body to send with the request.
 * @param {FormBody} [params.form] - Form-encoded body to send with the request.
 * @param {QueryParams} [params.params] - Query string parameters.
 * @param {string} [params.headers] - Authentication token for the Authorization header.
 * @param {AuthType} [params.authType='Bearer'] - Authentication scheme to use (Bearer, Token, or Basic).
 * @returns {Promise<{ status: number; body: unknown }>} - An object containing the status code and the parsed response body.
 *    - `status`: The HTTP status code returned by the server.
 *    - `body`: The parsed JSON response body, the raw text if it is not JSON, or null if empty.
 */
export async function apiRequest({
    request,
    method,
    url,
    baseUrl,
    body = null,
    form,
    params,
    headers,
    authType = 'Bearer',
}: {
    request: APIRequestContext;
    method: 'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
    url: string;
    baseUrl?: string;
    body?: Record<string, unknown> | null;
    form?: FormBody;
    params?: QueryParams;
    headers?: string;
    authType?: AuthType;
}): Promise<{ status: number; body: unknown }> {
    if (body && form) {
        throw new Error('Pass either a JSON `body` or a `form`, not both.');
    }

    let response: APIResponse;

    const options: {
        data?: Record<string, unknown>;
        form?: FormBody;
        params?: QueryParams;
        headers: Record<string, string>;
    } = { headers: {} };
    if (body) {
        options.data = body;
        options.headers['Content-Type'] = 'application/json';
    }
    // Playwright sets the form-urlencoded Content-Type itself
    if (form) options.form = form;
    if (params) options.params = params;
    if (headers) options.headers.Authorization = `${authType} ${headers}`;

    const fullUrl = baseUrl ? `${baseUrl}${url}` : url;

    switch (method.toUpperCase()) {
        case 'POST':
            response = await request.post(fullUrl, options);
            break;
        case 'GET':
            response = await request.get(fullUrl, options);
            break;
        case 'PUT':
            response = await request.put(fullUrl, options);
            break;
        case 'DELETE':
            response = await request.delete(fullUrl, options);
            break;
        case 'PATCH':
            response = await request.patch(fullUrl, options);
            break;
        case 'HEAD':
            response = await request.head(fullUrl, options);
            break;
        default:
            throw new Error(`Unsupported HTTP method: ${method}`);
    }

    const status = response.status();

    let bodyData: unknown = null;
    const text = await response.text();

    if (text) {
        try {
            bodyData = JSON.parse(text);
        } catch {
            bodyData = text;
        }
    }

    return { status, body: bodyData };
}
