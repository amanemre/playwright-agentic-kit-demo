/**
 * Third-party ad / consent hosts blocked in every browser context.
 * A request is blocked when its hostname equals a value or is a subdomain of it.
 *
 * Keep in sync with `network.blockedOrigins` in `.playwright/cli.config.json`
 * (JSON cannot import this enum), so exploration and test runs see the same page.
 */
export enum AdHosts {
    GOOGLE_SYNDICATION = 'googlesyndication.com',
    DOUBLECLICK = 'doubleclick.net',
    GOOGLE_AD_SERVICES = 'googleadservices.com',
    GOOGLE_TAG_SERVICES = 'googletagservices.com',
    GOOGLE_AD_SERVICE = 'adservice.google.com',
    GOOGLE_FUNDING_CHOICES = 'fundingchoicesmessages.google.com',
    GOOGLE_AD_TRAFFIC_QUALITY = 'adtrafficquality.google',
}
