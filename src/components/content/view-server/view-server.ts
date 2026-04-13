import "./view-server.scss";
import ViewServerTemplate from "./view-server.html?raw";
import {Component} from "../../component/component";
import {RpcStub} from "capnweb";
import {ScrumPokerApi} from "../../../../ws-server/interfaces";
import {ListenerImpl} from "../../../model/ListenerImpl";
import {UserChoices} from "../card-list/user-choices/user-choices";
import { v4 as uuid } from "uuid";
import {createApiConn} from "../../../constants";

export class ViewServer extends Component {
    private readonly roomName: string;
    private readonly cards: string[];
    private readonly roomPass?: string;
    private authToken?: string
    private roomId?: number;
    private api?: RpcStub<ScrumPokerApi>;
    private userChoices?: UserChoices;
    private didInit: boolean = false;

    // noinspection JSAnnotator
    static template = ViewServerTemplate;

    constructor(parent: HTMLElement, roomName: string, cards: string[], roomPass?: string) {
        super(parent);
        this.roomName = roomName;
        this.cards = cards;
        this.roomPass = roomPass;
    }

    // --- Delegation handlers ---
    private handleUserChoseCard(username: string, card: string): void {
        this.userChoices?.onUserChoseCard(username, card);
    }

    private handleUserJoined(username: string): void {
        this.userChoices?.onUserJoined(username);
    }

    private handleUserLeft(username: string): void {
        this.userChoices?.onUserLeft(username);
    }

    // --- Local methods ---
    public async init() {
        await this.loadTemplate();
        const sessionId = uuid().replaceAll("-", "");
        this.api = await createApiConn(sessionId);
        const listener = new ListenerImpl({
            onUserChoseCard: this.handleUserChoseCard.bind(this),
            onUserJoined: this.handleUserJoined.bind(this),
            onUserLeft: this.handleUserLeft.bind(this),
            onIssueChanged: (issue: string) => { /* no-op */ }
        });

        const createResponse: {roomId: number, token: string} = await this.api.createRoom(this.roomName, this.cards, listener, sessionId, this.roomPass);
        this.roomId = createResponse.roomId;
        this.authToken = createResponse.token;

        const roomUsers = await this.api.getRoomUsers(this.roomId, this.authToken);
        const cardHolderTemplate = this.element!.querySelector("div#cardHolder");
        this.userChoices = new UserChoices(cardHolderTemplate.parentElement!, roomUsers);
        cardHolderTemplate.remove();
        await this.userChoices.mount();
        this.didInit = true;
    }

    protected async onMount() {
        if (!this.didInit) {
            throw new Error("Tried to mount ViewClient before initialization");
        }
        super.onMount();

        this.element!.querySelector<HTMLSpanElement>("span#roomId").textContent = this.roomId.toString().padStart(4, "0");
        this.element!.querySelector<HTMLSpanElement>("span#roomName").textContent = this.roomName;
        this.element!.querySelector<HTMLButtonElement>(".issueInput .inputBox button").addEventListener("click", () => {
            const issueInput = this.element!.querySelector<HTMLInputElement>(`.issueInput .inputBox input[name="issue"]`);
            const newIssueText = issueInput.value;
            if (!newIssueText) {
                issueInput.setAttribute("invalid", "");
                return;
            }
            this.element!.querySelector<HTMLSpanElement>(".issueInput span#issueText").textContent = newIssueText;
            issueInput.value = "";
            this.api!.setRoomIssue(this.roomId!, newIssueText, this.authToken!);
            this.userChoices!.reset();
        });
    }

    protected onUnmount() {
        super.onUnmount();
        this.api?.leaveRoom(this.roomId!, this.authToken!);
        if ((this.api as any)?.disconnect) {
            (this.api as any).disconnect();
        }
    }
}
