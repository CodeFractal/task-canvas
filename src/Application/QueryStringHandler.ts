import { IStorageLocation } from "../Storage/IStorageLocation";

export class QueryStringHandler {
    private readonly initialPath: string;
    private readonly initialQueryString: string;
    private readonly params: Map<string, string> = new Map();

    constructor() {
        const url = new URL(window.location.href);
        this.initialPath = url.pathname;
        this.initialQueryString = url.search;
        this.params = QueryStringHandler.parseQueryString(this.initialQueryString);
    }

    public getStorageLocation(): IStorageLocation | null {
        const source = this.params.get('s');
        if (!source) return null;

        const locationId = this.params.get('l');
        if (!locationId) return null;

        return { source, id: locationId };
    }

    public setStorageLocation(location: IStorageLocation): void {
        this.params.set('s', location.source);
        this.params.set('l', location.id);

        const newQueryString = QueryStringHandler.stringifyQueryString(this.params);
        const newUrl = this.initialPath + newQueryString;

        window.history.replaceState({}, '', newUrl);
    }

    /**
     * Parses a query string into a Map of key/value pairs.
     * @param queryString - The query string (e.g., "?name=John&age=30")
     * @returns A Map where each key/value pair is a parameter from the query string.
     */
    public static parseQueryString(queryString: string): Map<string, string> {
        const params = new Map<string, string>();

        // Remove the leading '?' if it's there.
        if (queryString.startsWith('?')) {
            queryString = queryString.substring(1);
        }

        // Split the string by '&' to get each key-value pair.
        queryString.split('&').forEach(pair => {
            if (!pair) return; // Skip any empty strings.

            // Split the pair by '='. Default value is empty string if undefined.
            const [rawKey, rawValue = ''] = pair.split('=');

            // Decode URI components to handle encoded characters.
            const key = decodeURIComponent(rawKey);
            const value = decodeURIComponent(rawValue);

            params.set(key, value);
        });

        return params;
    }

    /**
     * Converts a Map of key/value pairs into a query string.
     * @param params - A Map containing query parameters.
     * @returns A query string starting with '?' if there are any parameters, or an empty string.
     */
    public static stringifyQueryString(params: Map<string, string>): string {
        const queryArray: string[] = [];

        // Iterate over the Map and encode each key/value pair.
        params.forEach((value, key) => {
            const encodedKey = encodeURIComponent(key);
            const encodedValue = encodeURIComponent(value);
            queryArray.push(`${encodedKey}=${encodedValue}`);
        });

        // Join pairs with '&' and prepend '?' if there are any parameters.
        return queryArray.length ? '?' + queryArray.join('&') : '';
    }
}