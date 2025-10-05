import "./view-server.scss";
import {Component} from "../../component/component";
import {newWebSocketRpcSession, RpcStub} from "capnweb";
import {ScrumPokerApi} from "../../../../ws-server/interfaces";
import {PORT_NUMBER} from "../../../../ws-server/model/constants";
import {ListenerImpl} from "../../../model/ListenerImpl";

export class ViewServer extends Component {
    private readonly roomName: string;
    private readonly cards: string[];
    private readonly roomPass?: string;
    private authToken?: string
    private roomId?: number;
    private api?: RpcStub<ScrumPokerApi>;
    private roomUsers: string[] = [];
    private userChoices: Map<string, string> = new Map<string, string>(); // username -> choice

    constructor(parent: HTMLElement, roomName: string, cards: string[], roomPass?: string) {
        super(parent);
        this.roomName = roomName;
        this.cards = cards;
        this.roomPass = roomPass;
    }

    // --- Delegation handlers ---
    private handleUserChoseCard(username: string, card: string): void {
        this.userChoices.set(username, card);
        console.warn(this.userChoices);
        if (this.arraysEqual(Array.from(this.userChoices.keys()), this.roomUsers)) {
            this.onAllUsersChoseCards();
        }
    }

    private handleUserJoined(username: string): void {
        this.roomUsers.push(username);
    }

    private handleUserLeft(username: string): void {
        if (!this.roomUsers.includes(username)) {
            throw new Error(`Tried to remove user ${username} who is not in this Room`);
        }
        this.roomUsers.splice(this.roomUsers.indexOf(username), 1);
        this.userChoices.delete(username);
        // TODO: Update UI
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
        this.roomUsers = await this.api.getRoomUsers(this.roomId, this.authToken);
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
        })
    }

    protected onUnmount() {
        super.onUnmount();
        this.api?.leaveRoom(this.roomId!, this.authToken!);
    }

    private onAllUsersChoseCards(): void {
        console.warn("All users have chosen cards", this.userChoices);
        // TODO: Implement
    }

    private arraysEqual<T>(a: T[], b: T[]): boolean {
        if (!a || !b || a.length !== b.length) {
            return false;
        }
        for(const value of a) {
            if (!b.includes(value)) {
                return false;
            }
        }
        return true;
    }
}
