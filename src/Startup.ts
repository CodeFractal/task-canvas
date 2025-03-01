import { App } from "./Application/App";
import { AppController } from "./Controller/MouseAndKeyboard/AppController";
import { AppPresenter } from "./Presenter/AppPresenter";

document.addEventListener('DOMContentLoaded', (): void => {
    const presenter = new AppPresenter();
    const app = new App(presenter);
    const controller = new AppController(app, presenter);
});
