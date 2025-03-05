import { ICanvasDataModel } from "../DataModel";
import { IStorageConnectionProvider } from "../IStorageConnectionProvider";
import { IStorageProvider } from "../IStorageProvider";
import { GoogleDriveService } from "./GoogleDriveService";
import { GoogleDriveStorageProvider } from "./GoogleDriveStorageProvider";

const MIME_TYPE = 'application/vnd.taskcanvas+json';

export class GoogleDriveStorageConnectionProvider implements IStorageConnectionProvider {
    private static _service: GoogleDriveService;
    private _service: GoogleDriveService;
    private signedIn = false;

    constructor() {
        GoogleDriveStorageConnectionProvider._service ??= new GoogleDriveService();
        this._service = GoogleDriveStorageConnectionProvider._service;
    }

    get uniqueName(): string { return 'g'; } // Unique name for Google Drive

    async requestAuthentication(): Promise<boolean> {
        if (!this.signedIn) {
            this.signedIn = this._service.tryAutoSignIn();
            if (this.signedIn) return true;
        }
        this.signedIn = await this._service.signIn();
        return this.signedIn;
    }

    async requestConnection(isNew: boolean): Promise<IStorageProvider | null> {
        if (isNew) {
            // Let the user decide if they want to choose a folder.
            const useFolder = confirm(
                "Do you want to choose a folder for your new task canvas file?\n\nClick OK for folder selection, or Cancel to use the root folder."
            );
            let folderId: string | null = 'root';
            if (useFolder) {
                folderId = await this._service.pickFolder(); // This is immediately returning null
                if (!folderId) return null;
            }
            let fileName = prompt("Enter the file name for the new canvas file (e.g., mycanvas.tc):");
            if (!fileName) return null;
            // Make sure the file name ends with .tc
            if (!fileName.endsWith('.tc')) {
                fileName += '.tc';
            }
            // Our initial task canvas: an empty canvas with default values.
            const initialData = {
                version: "1.0",
                tasks: [],
                dependencies: [],
                pan: { x: 0, y: 0 },
                zoom: 1
            };
            const fileId = await this.createNewFile(fileName, folderId, initialData);
            if (!fileId) return null;
            return new GoogleDriveStorageProvider(this._service, fileId, MIME_TYPE);
        }
        else {
            // Open the file picker for existing .tc files.
            const fileIdPromise = this._service.pickFile(MIME_TYPE);
            const fileId = await fileIdPromise;
            if (!fileId) return null;
            return new GoogleDriveStorageProvider(this._service, fileId, MIME_TYPE);
        }
    }

    async requestConnectionToLocation(locationId: string): Promise<IStorageProvider | null> {
        return new GoogleDriveStorageProvider(this._service, locationId, MIME_TYPE);
    }

    /**
     * Creates a new .tc file on Google Drive with the given name, folder, and initial canvas data.
     * Returns the ID of the new file, or null if the file could not be created.
     */
    private createNewFile(fileName: string, folderId: string, initialData: ICanvasDataModel): Promise<string | null> {
        return this._service.saveAs(fileName, folderId, JSON.stringify(initialData, null, 2));
    }
}
