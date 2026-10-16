import { test as base, mergeTests, request } from '@playwright/test';
import { test as pageObjectFixture } from './pom/page-object-fixture';
import { test as apiRequestFixture } from './api/api-request-fixture';
import { test as helperFixture } from './helper/helper-fixture';
import { test as adBlockFixture } from './network/ad-block-fixture';

const test = mergeTests(
    adBlockFixture,
    pageObjectFixture,
    apiRequestFixture,
    helperFixture
);

const expect = base.expect;
export { test, expect, request };

// Types specs may need (e.g. a shared verify… helper's parameters) — specs
// import from here, never from @playwright/test
export type { BrowserContext, Locator, Page } from '@playwright/test';
