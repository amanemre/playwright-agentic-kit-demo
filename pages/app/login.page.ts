import { Locator, Page } from '@playwright/test';
import { AppRoutes, Messages } from '../../enums/app/app';

/**
 * Page Object for the Contact List App login page (the app's root route).
 *
 * The form has no client-side validation: every submission is sent to
 * `POST /users/login`, and any rejection shows the single
 * `Messages.LOGIN_ERROR` banner.
 */
export class LoginPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get emailInput(): Locator {
        return this.page.getByRole('textbox', { name: 'Email', exact: true });
    }

    get passwordInput(): Locator {
        return this.page.getByRole('textbox', {
            name: 'Password',
            exact: true,
        });
    }

    get submitButton(): Locator {
        return this.page.getByRole('button', { name: 'Submit' });
    }

    get signUpButton(): Locator {
        return this.page.getByRole('button', { name: 'Sign up' });
    }

    // ==================== Feedback ====================

    get errorMessage(): Locator {
        return this.page.getByText(Messages.LOGIN_ERROR);
    }

    // ==================== Actions ====================

    /**
     * Navigates to the login page using the configured APP_URL.
     *
     * @returns {Promise<void>} Resolves when navigation is complete.
     */
    async open(): Promise<void> {
        await this.page.goto(`${process.env.APP_URL!}${AppRoutes.LOGIN}`, {
            waitUntil: 'domcontentloaded',
        });
    }

    /**
     * Fills in the credentials and submits the form with the Submit button.
     *
     * No response wait here — callers assert the outcome (contact list or
     * error banner) with web-first assertions, which wait automatically.
     *
     * @param {string} email - The email to enter.
     * @param {string} password - The password to enter.
     * @returns {Promise<void>} Resolves when the form has been submitted.
     */
    async login(email: string, password: string): Promise<void> {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.submitButton.click();
    }

    /**
     * Fills in the credentials and submits the form by pressing Enter in the
     * password field.
     *
     * @param {string} email - The email to enter.
     * @param {string} password - The password to enter.
     * @returns {Promise<void>} Resolves when the form has been submitted.
     */
    async loginWithEnterKey(email: string, password: string): Promise<void> {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.passwordInput.press('Enter');
    }

    /**
     * Opens the sign-up page via the Sign up button.
     *
     * @returns {Promise<void>} Resolves when the button has been clicked.
     */
    async clickSignUp(): Promise<void> {
        await this.signUpButton.click();
    }
}
