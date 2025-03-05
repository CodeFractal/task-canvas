import { App } from "./Application/App";
import { QueryStringHandler } from "./Application/QueryStringHandler";
import { AppController } from "./Controller/MouseAndKeyboard/AppController";
import { AppPresenter } from "./Presenter/AppPresenter";
import { GoogleDriveStorageConnectionProvider } from "./Storage/GoogleDrive/GoogleDriveStorageConnectionProvider";
import { IStorageLocation } from "./Storage/IStorageLocation";
import { IStorageProvider } from "./Storage/IStorageProvider";

document.addEventListener('DOMContentLoaded', (): void => {
    const presenter = new AppPresenter();
    const stgConnProvider = new GoogleDriveStorageConnectionProvider();
    const queryStringHandler = new QueryStringHandler();
    const app = new App(
        presenter,
        [stgConnProvider],
        queryStringHandler
    );
    const controller = new AppController(app, presenter);
    
    app.pauseCanvas();
    getStorageProvider().then(() =>
        app.load()
    );

    async function getStorageProvider(): Promise<void> {
        let storageProvider: IStorageProvider | null = null;
        const storageLocation = queryStringHandler.getStorageLocation();
        if (storageLocation) {
            storageProvider = await app.requestConnectionToStorageLocation(storageLocation);
        }            
        while (!storageProvider) {
            storageProvider = await app.requestConnectionToStorage(false);
        }
    }
});
