import "./password-input.scss";
import {Component} from "../../component/component";

export class PasswordInput extends Component {
    private readonly inputName: string;
    constructor(parent: HTMLElement, inputName: string) {
        super(parent);
        this.inputName = inputName || "password";
    }

    protected onMount() {
        super.onMount();

        // noinspection TypeScriptValidateTypes
        const passShowBtn = this.element!.querySelector<HTMLElement>(".passwordShowBtn");
        const passInput = this.element!.querySelector<HTMLInputElement>(`input[name="password"]`);
        passInput.setAttribute("name", this.inputName);
        const passInputCallback = () => {
            passShowBtn.style.display = (!!passInput.value) ? "block" : "none";
        };
        passInput.addEventListener("keydown", passInputCallback);
        passInput.addEventListener("keyup", passInputCallback);
        passInput.addEventListener("keypress", passInputCallback);
        // noinspection TypeScriptValidateTypes
        passShowBtn.querySelector(".innerBtn").addEventListener("mousedown", () => {
            passInput.setAttribute("type", "text");
        });
        // noinspection TypeScriptValidateTypes
        passShowBtn.querySelector(".innerBtn").addEventListener("mouseup", () => {
            passInput.setAttribute("type", "password");
        })
    }
}
