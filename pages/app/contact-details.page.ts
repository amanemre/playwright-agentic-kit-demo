import { Locator, Page } from '@playwright/test';
import { ContactDetailsLabels } from '../../enums/app/app';

export class ContactDetailsPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    firstName(value: string): Locator {
        return this.page
            .getByRole('paragraph')
            .filter({ hasText: ContactDetailsLabels.FIRST_NAME })
            .getByText(value, { exact: true });
    }

    lastName(value: string): Locator {
        return this.page
            .getByRole('paragraph')
            .filter({ hasText: ContactDetailsLabels.LAST_NAME })
            .getByText(value, { exact: true });
    }
}
