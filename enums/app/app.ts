/**
 * Application-specific constants.
 * Add your application's repeated string values here.
 *
 * @example
 * ```ts
 * import { Messages, ApiEndpoints } from '../../enums/app/app';
 *
 * await expect(page.getByText(Messages.LOGIN_ERROR)).toBeVisible();
 * ```
 */

/** Common UI messages — every value verified against the live Contact List app */
export enum Messages {
    LOGIN_ERROR = 'Incorrect username or password',
}

/** UI route paths */
export enum AppRoutes {
    LOGIN = '/',
    CONTACT_LIST = '/contactList',
    ADD_USER = '/addUser',
}

/** API endpoint paths */
export enum ApiEndpoints {
    LOGIN = '/users/login',
    LOGOUT = '/users/logout',
    CURRENT_USER = '/users/me',
    REGISTER = '/users',
    CONTACTS = '/contacts',
}

/** Storage state file paths */
export enum StorageStatePaths {
    APP = '.auth/app/appStorageState.json',
}
