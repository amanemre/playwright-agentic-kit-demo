import { test as base } from '@playwright/test';
import { apiRequest as apiRequestOriginal } from './plain-function';
import {
    ApiRequestFn,
    ApiRequestMethods,
    ApiRequestParams,
    ApiRequestResponse,
} from './api-types';

/** Placeholder written into report attachments instead of a secret value */
const REDACTED = '[redacted]';

/**
 * Returns a copy of `value` that is safe to put in a report: every key that
 * contains "password" is masked, and the registered account's email
 * (`APP_EMAIL`, a repository secret on CI) is replaced wherever it appears.
 *
 * @param {unknown} value - Request or response data.
 * @returns {unknown} The redacted copy.
 */
function redact(value: unknown): unknown {
    const secretEmail = process.env.APP_EMAIL;

    return JSON.parse(
        JSON.stringify(value ?? null, (key, entry: unknown) => {
            if (/password/i.test(key)) return REDACTED;
            if (secretEmail && entry === secretEmail) return REDACTED;
            return entry;
        })
    );
}

export const test = base.extend<ApiRequestMethods>({
    /**
     * Provides a function to make API requests.
     * Uses the Playwright request context for HTTP calls. Every call attaches
     * its request and response (secrets redacted) to the test report, so a
     * failed check can be compared with what the API actually returned.
     *
     * @param {object} request - The request object.
     * @param {function} use - The use function to provide the API request function.
     * @param {TestInfo} testInfo - The running test's info, used for attachments.
     */
    apiRequest: async ({ request }, use, testInfo) => {
        const apiRequestFn: ApiRequestFn = async <T = unknown>({
            method,
            url,
            baseUrl,
            body = null,
            form,
            params,
            headers,
            authType,
        }: ApiRequestParams): Promise<ApiRequestResponse<T>> => {
            const response = await apiRequestOriginal({
                request,
                method,
                url,
                baseUrl,
                body,
                form,
                params,
                headers,
                authType,
            });

            await testInfo.attach(`${method} ${url} → ${response.status}`, {
                contentType: 'application/json',
                body: JSON.stringify(
                    redact({
                        request: {
                            method,
                            url: `${baseUrl ?? ''}${url}`,
                            params,
                            form,
                            body,
                        },
                        response: {
                            status: response.status,
                            body: response.body,
                        },
                    }),
                    null,
                    2
                ),
            });

            return {
                status: response.status,
                body: response.body as T,
            };
        };

        await use(apiRequestFn);
    },
});
