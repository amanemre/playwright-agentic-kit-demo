/** UI messages of contact-list-app — every value verified against the live app */
export enum Messages {
    INCORRECT_CREDENTIALS = 'Incorrect username or password',
    USER_VALIDATION_FAILED = 'User validation failed',
    CONTACT_VALIDATION_FAILED = 'Contact validation failed',
    EMAIL_ALREADY_IN_USE = 'Email address is already in use',
    EMAIL_INVALID = 'Email is invalid',
}

/** Page headings of contact-list-app — verified against the live app */
export enum Headings {
    ADD_USER = 'Add User',
    ADD_CONTACT = 'Add Contact',
}

/** Column headings of the contact list table, in their order — verified against the live app */
export enum ContactTableColumns {
    NAME = 'Name',
    BIRTHDATE = 'Birthdate',
    EMAIL = 'Email',
    PHONE = 'Phone',
    ADDRESS = 'Address',
    CITY_STATE_POSTAL_CODE = 'City, State/Province, Postal Code',
    COUNTRY = 'Country',
}

/** Field labels of the contact details page — verified against the live app */
export enum ContactDetailsLabels {
    FIRST_NAME = 'First Name:',
    LAST_NAME = 'Last Name:',
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
