/** UI messages of contact-list-app — every value verified against the live app */
export enum Messages {
    INCORRECT_CREDENTIALS = 'Incorrect username or password',
    USER_VALIDATION_FAILED = 'User validation failed',
}

/** Page headings of contact-list-app — verified against the live app */
export enum Headings {
    ADD_USER = 'Add User',
}

/** UI routes of contact-list-app, relative to APP_URL */
export enum AppRoutes {
    LOGIN = '/',
    CONTACT_LIST = '/contactList',
}

/** API endpoint paths of contact-list-app, relative to API_URL */
export enum ApiEndpoints {
    USERS = '/users',
    CURRENT_USER = '/users/me',
    LOGIN = '/users/login',
    CONTACTS = '/contacts',
}

/** Name of the cookie that holds the session token */
export enum CookieNames {
    TOKEN = 'token',
}
