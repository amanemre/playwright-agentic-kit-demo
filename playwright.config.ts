import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

/**
 * contact-list-app — Playwright configuration (playwright-house-preset).
 * Environment variables come from env/.env.<ENVIRONMENT> (default: dev);
 * env/.env.example lists their names.
 */
const environment = process.env.ENVIRONMENT ?? 'dev';
dotenv.config({ path: `./env/.env.${environment}`, quiet: true });

/** Every generated run artifact lives under one gitignored folder */
const reportsDir = './reports';

export default defineConfig({
    testDir: './tests',
    outputDir: `${reportsDir}/test-results`,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ['list'],
        [
            'html',
            { open: 'never', outputFolder: `${reportsDir}/playwright-report` },
        ],
    ],
    use: {
        baseURL: process.env.APP_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
