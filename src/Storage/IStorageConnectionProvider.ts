import { IStorageProvider } from "./IStorageProvider";

export interface IStorageConnectionProvider {

    /** Requests any required authentication from the user, such as signing into Googl
     * @returns true if the user successfully authenticated, false if the user cancelled the request
     */
    requestAuthentication(): Promise<boolean>;

    /** Requests a connection to a storage provider
     * @param isNew Whether the connection is for a new canvas
     * @returns The storage provider, if one was selected, or null if the user cancelled the request
     */
    requestConnection(isNew: boolean): Promise<IStorageProvider | null>;

}