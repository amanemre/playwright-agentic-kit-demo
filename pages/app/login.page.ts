import { Locator, Page } from '@playwright/test';
import { AppRoutes, Messages } from '../../enums/app/app';

export class LoginPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get emailInput(): Locator {
        return this.page.getByRole('textbox', { name: 'Email' });
    }

    get passwordInput(): Locator {
        return this.page.getByRole('textbox', { name: 'Password' });
    }

    get submitButton(): Locator {
        return this.page.getByRole('button', { name: 'Submit' });
    }

    get signUpButton(): Locator {
        return this.page.getByRole('button', { name: 'Sign up' });
    }

    // ==================== Feedback Locators ====================

    get incorrectCredentialsError(): Locator {
        return this.page.getByText(Messages.INCORRECT_CREDENTIALS);
    }

    // ==================== Actions ====================

    /**
     * Opens the login page.
     *
     * @returns {Promise<void>}
     */
    async open(): Promise<void> {
        await this.page.goto(AppRoutes.LOGIN);
    }

    /**
     * Fills in the credentials and clicks Submit.
     *
     * @param {string} email - The email to log in with ('' for none).
     * @param {string} password - The password to log in with ('' for none).
     * @returns {Promise<void>}
     */
    async login(email: string, password: string): Promise<void> {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.submitButton.click();
    }

    /**
     * Fills in the credentials and submits the form with the Enter key.
     *
     * @param {string} email - The email to log in with.
     * @param {string} password - The password to log in with.
     * @returns {Promise<void>}
     */
    async loginWithEnterKey(email: string, password: string): Promise<void> {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.passwordInput.press('Enter');
    }
}
