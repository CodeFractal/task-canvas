export class ModalDialog {
    private readonly onClose?: () => void;

    public static makeHtmlElement() : HTMLElement {
        const dialog = document.createElement("div");
        dialog.className = "modal-dialog";
        dialog.style.display = "none";

        const dialogContent = document.createElement("div");
        dialogContent.className = "modal-content";
        dialog.appendChild(dialogContent);

        const dialogHeader = document.createElement("div");
        dialogHeader.className = "modal-header";
        dialogContent.appendChild(dialogHeader);

        const dialogTitle = document.createElement("div");
        dialogTitle.className = "modal-title";
        dialogHeader.appendChild(dialogTitle);

        const dialogClose = document.createElement("div");
        dialogClose.className = "modal-close";
        dialogClose.innerHTML = "&times;";
        dialogHeader.appendChild(dialogClose);

        const dialogBody = document.createElement("div");
        dialogBody.className = "modal-body";
        dialogContent.appendChild(dialogBody);

        const dialogFooter = document.createElement("div");
        dialogFooter.className = "modal-footer";
        dialogContent.appendChild(dialogFooter);

        return dialog;
    }

    constructor(
        private element: HTMLElement,
        options?: {
            title?: string;
            message?: string;
            options?: [string, string][];
            allowClose?: boolean;
            onClose?: () => void;
            onSelection?: (button: string) => void;
        }
    ) {
        this.onClose = options?.onClose;

        const title = this.element.querySelector(".modal-title") as HTMLElement;
        title.textContent = options?.title || "";
        if (!options?.title) title.style.display = "none";
        else title.style.removeProperty("display");

        const body = this.element.querySelector(".modal-body") as HTMLElement;
        body.innerHTML = options?.message || "";
        if (!options?.message) body.style.display = "none";
        else body.style.removeProperty("display");

        const footer = this.element.querySelector(".modal-footer") as HTMLElement;
        footer.innerHTML = "";
        const buttons = options?.options || [];
        for (const [key, label] of buttons) {
            const button = document.createElement("div");
            button.className = "modal-button";
            button.textContent = label;
            button.onclick = () => {
                try {
                    if (options?.onSelection) {
                        options.onSelection(key);
                    }
                }
                finally {
                    this.close();
                }
            };
            footer.appendChild(button);
        }
        if (buttons.length === 0) footer.style.display = "none";
        else footer.style.removeProperty("display");

        const close = this.element.querySelector(".modal-close") as HTMLElement;
        close.onclick = () => this.close();
        if (options?.allowClose) close.style.removeProperty("display");
        else close.style.display = "none";
    }

    show() { this.element.style.removeProperty("display"); }
    hide() { this.element.style.display = "none"; }

    private close() {
        this.hide();
        if (this.onClose) {
            this.onClose();
        }
    }
}