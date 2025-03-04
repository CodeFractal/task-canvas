import { App } from "./Application/App";
import { AppController } from "./Controller/MouseAndKeyboard/AppController";
import { AppPresenter } from "./Presenter/AppPresenter";
import { GoogleDriveStorageConnectionProvider } from "./Storage/GoogleDrive/GoogleDriveStorageConnectionProvider";
import { IStorageProvider } from "./Storage/IStorageProvider";

document.addEventListener('DOMContentLoaded', (): void => {
    const presenter = new AppPresenter();
    const stgConnProvider = new GoogleDriveStorageConnectionProvider();
    const app = new App(presenter, [stgConnProvider]);
    const controller = new AppController(app, presenter);
    
    app.pauseCanvas();
    getStorageProvider().then(() =>
        app.load()
    );

    async function getStorageProvider(): Promise<void> {
        let storageProvider: IStorageProvider | null = null;
        while (!storageProvider) {
            storageProvider = await app.requestConnectionToStorage(false);
        }
    }
});
