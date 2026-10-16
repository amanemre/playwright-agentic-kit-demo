import { Locator, Page } from '@playwright/test';
import { ApiEndpoints, AppRoutes } from '../../enums/app/app';

/**
 * Page Object for the Contact List page shown after a successful login.
 *
 * The page frame (heading, Logout, Add a New Contact) is static HTML; the
 * contacts table is rendered only after `GET /contacts` succeeds, so the
 * table — not the heading — is the signal that the user is authenticated.
 */
export class ContactListPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get heading(): Locator {
        return this.page.getByRole('heading', {
            name: 'Contact List',
            exact: true,
        });
    }

    get logoutButton(): Locator {
        return this.page.getByRole('button', { name: 'Logout' });
    }

    get addContactButton(): Locator {
        return this.page.getByRole('button', { name: 'Add a New Contact' });
    }

    get contactsTable(): Locator {
        return this.page.getByRole('table');
    }

    // ==================== Actions ====================

    /**
     * Navigates to the contact list using the configured APP_URL and waits
     * for the page's `GET /contacts` request to complete, so assertions on
     * the contacts table reflect the server's answer.
     *
     * @returns {Promise<void>} Resolves when the contacts request has completed.
     */
    async open(): Promise<void> {
        const contactsResponse = this.page.waitForResponse(
            (response) =>
                response.url().endsWith(ApiEndpoints.CONTACTS) &&
                response.request().method() === 'GET'
        );
        await this.page.goto(
            `${process.env.APP_URL!}${AppRoutes.CONTACT_LIST}`,
            { waitUntil: 'domcontentloaded' }
        );
        await contactsResponse;
    }

    /**
     * Logs out via the Logout button.
     *
     * @returns {Promise<void>} Resolves when the button has been clicked.
     */
    async logout(): Promise<void> {
        await this.logoutButton.click();
    }
}
