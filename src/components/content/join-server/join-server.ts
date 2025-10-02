import "./join-server.scss";
import {Component} from "../../component/component";
import {PasswordInput} from "../../shared/password-input/password-input";

export class JoinServer extends Component {

    private roomId: HTMLInputElement|null = null;
    private roomPass: HTMLInputElement|null = null;

    constructor(parent: HTMLElement) {
        super(parent);
    }

    protected onMount() {
        super.onMount();

        this.element!.querySelectorAll(".inputBox input").forEach(input => {
            input.addEventListener("change", () => input.removeAttribute("invalid"));
        });

        this.roomId = this.element!.querySelector(`input[name="roomId"]`);

        const passwordInput = new PasswordInput(
            (this.element!.querySelector(`.inputBox[for="password"]`) as HTMLElement),
            "roomPass");
        passwordInput.mount().then(() => {
            this.roomPass = passwordInput.element!.querySelector(`input[name="roomPass"]`);
        });

        this.element!.querySelector(".inputBox:last-child button").addEventListener("click", () => {
            this.submit();
        });
    }

    private submit(): void {
        if (!this.roomId || !this.roomPass) {
            return;
        }
        if (!this.roomId.value) {
            this.roomId.setAttribute("invalid", "");
            return;
        }

        // TODO: Implement connecting to server
        console.warn("Connect:", `${this.roomId.value}:${this.roomPass.value}`);
    }
}
