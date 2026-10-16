import { Page } from '@playwright/test';
import { AddUserPage } from './app/add-user.page';
import { ContactListPage } from './app/contact-list.page';
import { ExamplePage } from './app/example.page';
import { LoginPage } from './app/login.page';

/**
 * Every page object of contact-list-app, created on first access and reached
 * through the `pageManager` fixture: `pageManager.examplePage.open()`.
 * Add each new page object as a getter here — never `new` it in a test.
 */
export class PageManager {
    private examplePageInstance?: ExamplePage;
    private loginPageInstance?: LoginPage;
    private contactListPageInstance?: ContactListPage;
    private addUserPageInstance?: AddUserPage;

    constructor(private readonly page: Page) {}

    get examplePage(): ExamplePage {
        return (this.examplePageInstance ??= new ExamplePage(this.page));
    }

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
}
