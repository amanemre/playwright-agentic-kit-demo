import { test as base } from '@playwright/test';
import { AdHosts } from '../../enums/util/ad-hosts';

const adHosts = Object.values(AdHosts);

/**
 * Returns true when the URL's hostname is an ad host or one of its subdomains.
 *
 * @param {URL} url - The request URL.
 * @returns {boolean} Whether the request should be blocked.
 */
const isAdRequest = (url: URL): boolean =>
    adHosts.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
    );

/**
 * Network fixtures.
 *
 * Overrides the built-in `context` fixture so every browser context aborts
 * ad / consent requests before any page is created. Ads and interstitials on the
 * app under test otherwise inject iframes that can overlap and intercept clicks.
 *
 * Overriding `context` (instead of an auto fixture) keeps API-only tests
 * browser-free: the route is registered only when a test actually uses a browser.
 */
export const test = base.extend({
    context: async ({ context }, use) => {
        await context.route(isAdRequest, (route) =>
            route.abort('blockedbyclient')
        );
        await use(context);
    },
});
