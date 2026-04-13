import "./create-server.scss";
import CreateServerTemplate from "./create-server.html?raw";
import {Component} from "../../component/component";
import {PasswordInput} from "../../shared/password-input/password-input";
import {CardList} from "../card-list/card-list";

type SubmitSignature = (roomName: string, cards: string[], roomPass?: string) => void;

export class CreateServer extends Component {
    private roomName: HTMLInputElement|null = null;
    private roomPass: HTMLInputElement|null = null;
    private cardList?: CardList;
    private onSubmit: SubmitSignature;

    // noinspection JSAnnotator
    static template = CreateServerTemplate;

        constructor(parent: HTMLElement) {
        super(parent);
    }

    public getCardOrder() {
        const cards = this.element!.querySelectorAll("#cardHolder .card:not(.addCard)");
        return Array.from(cards).map(x => x.querySelector("h1").textContent);
    }

    protected async onMount() {
        super.onMount();
        const cardHolderTemplate = this.element!.querySelector("div#cardHolder");
        this.cardList = new CardList(cardHolderTemplate.parentElement!);
        cardHolderTemplate.remove();
        await this.cardList.mount();

        // Init form
        this.element!.querySelectorAll(".inputBox input").forEach(input => {
            input.addEventListener("change", () => input.removeAttribute("invalid"));
        });
        this.roomName = this.element!.querySelector(`input[name="roomName"]`);
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

    private submit(): void {
        if (!this.roomName || !this.roomPass) {
            return;
        }
        if (!this.roomName.value) {
            this.roomName.setAttribute("invalid", "");
            return;
        }

        if (!this.onSubmit) {
            throw new Error("Callback for CreateServer::onSubmit not set");
        }
        this.onSubmit(this.roomName.value, this.getCardOrder(), this.roomPass.value);
    }
}
