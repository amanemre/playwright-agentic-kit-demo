import { Page } from '@playwright/test';
import { AddContactPage } from './app/add-contact.page';
import { AddUserPage } from './app/add-user.page';
import { ContactDetailsPage } from './app/contact-details.page';
import { ContactListPage } from './app/contact-list.page';
import { LoginPage } from './app/login.page';

/**
 * Every page object of contact-list-app, created on first access and reached
 * through the `pageManager` fixture: `pageManager.loginPage.open()`.
 * Add each new page object as a getter here — never `new` it in a test.
 */
export class PageManager {
    private loginPageInstance?: LoginPage;
    private contactListPageInstance?: ContactListPage;
    private addUserPageInstance?: AddUserPage;
    private addContactPageInstance?: AddContactPage;
    private contactDetailsPageInstance?: ContactDetailsPage;

    constructor(private readonly page: Page) {}

    /** / — the login form */
    get loginPage(): LoginPage {
        return (this.loginPageInstance ??= new LoginPage(this.page));
    }

    /** /contactList — the logged-in user's contacts */
    get contactListPage(): ContactListPage {
        return (this.contactListPageInstance ??= new ContactListPage(
            this.page
        ));
    }

    /** /addUser — the sign-up form */
    get addUserPage(): AddUserPage {
        return (this.addUserPageInstance ??= new AddUserPage(this.page));
    }

    /** /addContact — the add contact form */
    get addContactPage(): AddContactPage {
        return (this.addContactPageInstance ??= new AddContactPage(this.page));
    }

    /** /contactDetails — the contact opened from the contact list */
    get contactDetailsPage(): ContactDetailsPage {
        return (this.contactDetailsPageInstance ??= new ContactDetailsPage(
            this.page
        ));
    }
}
