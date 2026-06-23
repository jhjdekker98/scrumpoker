import "./dialog.scss";
import DialogTemplate from "./dialog.html?raw"
import {Component} from "@slyce.dev/ridr";

export interface IDialogConstructor {
    content: string,
    title?: string,
    hasInput: boolean,
    inputPlaceholder?: string,
    inputValue?: string,
    buttonText?: string,
    onClose?: () => void
}

export class Dialog extends Component {
    // noinspection JSAnnotator
    static template = DialogTemplate;
    readonly constr: IDialogConstructor;

    constructor(parent: HTMLElement, constructor: IDialogConstructor) {
        super(parent);
        this.constr = constructor;
    }

    protected onMount() {
        super.onMount();
        
        const titleElem = this.element!.querySelector<HTMLHeadingElement>("#dialogTitle")!;
        const contentElem = this.element!.querySelector<HTMLParagraphElement>("#dialogText")!;
        const inputElem = this.element!.querySelector<HTMLInputElement>("#dialogInput")!;
        const buttonElem = this.element!.querySelector<HTMLButtonElement>("#dialogButton")!;

        if (this.constr.title) {
            titleElem.textContent = this.constr.title;
        } else {
            titleElem.remove();
        }

        contentElem.textContent = this.constr.content;

        if (!this.constr.hasInput) {
            inputElem.remove();
        } else {
            if (this.constr.inputPlaceholder) {
                inputElem.placeholder = this.constr.inputPlaceholder;
            }
            if (this.constr.inputValue) {
                inputElem.value = this.constr.inputValue;
            }
        }

        if (this.constr.buttonText && this.constr.onClose) {
            buttonElem.textContent = this.constr.buttonText;
            buttonElem.addEventListener("click", () => {
                this.constr.onClose!();
                this.unmount();
            });
        } else {
            buttonElem.remove();
        }
    }

    public get value(): string|undefined {
        if (!this.element) return undefined;
        return this.element!.querySelector<HTMLInputElement>("#dialogInput")!.value;
    }
}
