import "./join-server.scss";
import {Component} from "../../component/component";
import {PasswordInput} from "../../shared/password-input/password-input";

type SubmitSignature = (roomId: number, username: string, roomPass?: string) => void;

export class JoinServer extends Component {

    private roomId: HTMLInputElement|null = null;
    private roomPass: HTMLInputElement|null = null;
    private username: HTMLInputElement|null = null;
    private onSubmit: SubmitSignature;

    constructor(parent: HTMLElement) {
        super(parent);
    }

    protected onMount() {
        super.onMount();

        this.element!.querySelectorAll(".inputBox input").forEach(input => {
            input.addEventListener("change", () => input.removeAttribute("invalid"));
        });

        this.roomId = this.element!.querySelector(`input[name="roomId"]`);
        this.username = this.element!.querySelector(`input[name="username"]`);

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

    public setOnSubmit(onSubmit: SubmitSignature): void {
        this.onSubmit = onSubmit;
    }

    private async submit(): Promise<void> {
        if (!this.roomId || !this.roomPass || !this.username) {
            return;
        }
        if (!this.roomId.value || !this.isPositiveIntString(this.roomId.value)) {
            this.roomId.setAttribute("invalid", "");
            return;
        }
        if (!this.username.value) {
            this.username.setAttribute("invalid", "");
            return;
        }

        if (!this.onSubmit) {
            console.error("Callback for JoinServer::onSubmit not set");
            return;
        }
        this.onSubmit(parseInt(this.roomId.value), this.username.value, this.roomPass.value);
    }

    private isPositiveIntString(test: string): boolean {
        return /^-?\d+$/.test(test);
    }
}
