import "./view-server.scss";
import {Component} from "../../component/component";
import {newWebSocketRpcSession, RpcStub} from "capnweb";
import {ScrumPokerApi} from "../../../../ws-server/interfaces";
import {PORT_NUMBER} from "../../../../ws-server/model/constants";
import {ListenerImpl} from "../../../model/ListenerImpl";
import {UserChoices} from "../card-list/user-choices/user-choices";

export class ViewServer extends Component {
    private readonly roomName: string;
    private readonly cards: string[];
    private readonly roomPass?: string;
    private authToken?: string
    private roomId?: number;
    private api?: RpcStub<ScrumPokerApi>;
    private userChoices?: UserChoices;

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
    private async init() {
        // TODO: Make URL configurable
        this.api = newWebSocketRpcSession<ScrumPokerApi>(`http://localhost:${PORT_NUMBER}/api`);
        const listener = new ListenerImpl({
            onUserChoseCard: this.handleUserChoseCard.bind(this),
            onUserJoined: this.handleUserJoined.bind(this),
            onUserLeft: this.handleUserLeft.bind(this),
            onIssueChanged: (issue: string) => { /* no-op */ }
        });

        const createResponse: {roomId: number, token: string} = await this.api.createRoom(this.roomName, this.cards, listener, this.roomPass);
        this.roomId = createResponse.roomId;
        this.authToken = createResponse.token;

        const roomUsers = await this.api.getRoomUsers(this.roomId, this.authToken);
        const cardHolderTemplate = this.element!.querySelector("div#cardHolder");
        this.userChoices = new UserChoices(cardHolderTemplate.parentElement!, roomUsers);
        cardHolderTemplate.remove();
        this.userChoices.mount();
    }

    protected async onMount() {
        super.onMount();
        await this.init();

        this.element!.querySelector<HTMLSpanElement>("span#roomId").innerText = this.roomId.toString().padStart(4, "0");
        this.element!.querySelector<HTMLSpanElement>("span#roomName").innerText = this.roomName;
        this.element!.querySelector<HTMLButtonElement>(".issueInput .inputBox button").addEventListener("click", () => {
            const issueInput = this.element!.querySelector<HTMLInputElement>(`.issueInput .inputBox input[name="issue"]`);
            const newIssueText = issueInput.value;
            if (!newIssueText) {
                issueInput.setAttribute("invalid", "");
                return;
            }
            this.element!.querySelector<HTMLSpanElement>(".issueInput span#issueText").innerText = newIssueText;
            issueInput.value = "";
            this.api!.setRoomIssue(this.roomId!, newIssueText, this.authToken!);
            this.userChoices!.reset();
        });
    }

    protected onUnmount() {
        super.onUnmount();
        this.api?.leaveRoom(this.roomId!, this.authToken!);
    }
}
