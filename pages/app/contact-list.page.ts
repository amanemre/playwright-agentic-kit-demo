import { Locator, Page } from '@playwright/test';
import { ApiEndpoints, AppRoutes } from '../../enums/app/app';

export class ContactListPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get logoutButton(): Locator {
        return this.page.getByRole('button', { name: 'Logout' });
    }

    contactName(fullName: string): Locator {
        return this.page.getByRole('cell', { name: fullName, exact: true });
    }

    // ==================== Actions ====================

    /**
     * Opens the contact list page and waits until the page has received the
     * session's contacts (or their rejection) from `GET /contacts`.
     *
     * @returns {Promise<void>}
     */
    async open(): Promise<void> {
        const contactsResponse = this.page.waitForResponse((response) =>
            response.url().endsWith(ApiEndpoints.CONTACTS)
        );
        await this.page.goto(AppRoutes.CONTACT_LIST);
        await (await contactsResponse).finished();
    }

    /**
     * Logs out with the header's Logout button.
     *
     * @returns {Promise<void>}
     */
    async logout(): Promise<void> {
        await this.logoutButton.click();
    }
}
