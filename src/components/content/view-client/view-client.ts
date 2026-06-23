import "./view-client.scss";
import ViewClientTemplate from "./view-client.html?raw";
import {Component} from "@slyce.dev/ridr";
import {RpcStub} from "capnweb";
import {ScrumPokerApi, ScrumPokerApiImpl} from "../../../../ws-server/interfaces";
import {IRoomState} from "../../../../ws-server/model/room";
import {CardList} from "../card-list/card-list";
import {ListenerImpl} from "../../../model/ListenerImpl";
import {UserChoices} from "../card-list/user-choices/user-choices";
import { v4 as uuid } from "uuid";
import {createApiConn, LSK_SESSION_ID} from "../../../constants";
import {ShareRoomButton} from "../../shared/share-room-button/share-room-button";

interface ISessionTuple {
    sessionId: string,
    roomId: number
}

export class ViewClient extends Component {

    private readonly roomId: number;
    private readonly username: string;
    private readonly roomPass?: string;
    private readonly showCards: boolean
    private roomName?: string;
    private authToken?: string
    private roomUsers?: string[];
    private api?: RpcStub<ScrumPokerApi>;
    private cardList?: CardList;
    private userList?: HTMLUListElement;
    private userChoices?: UserChoices;
    private didInit: boolean = false;
    private shareBtn: ShareRoomButton | undefined;

    // noinspection JSAnnotator
    static template = ViewClientTemplate;

    constructor(parent: HTMLElement, roomId: number, username: string, roomPass?: string, showCards: boolean = true) {
        super(parent);
        this.roomId = roomId;
        this.username = username;
        this.roomPass = roomPass;
        this.showCards = showCards;
    }

    // --- Delegation handlers ---
    private handleIssueChanged(issue: string): void {
        document.querySelector<HTMLHeadingElement>("h2#issue")!.textContent = issue;
        this.userChoices!.reset();
        this.cardList!.removeHighlights();
        this.cardList!.cardsActive();
    }

    private handleUserJoined(username: string): void {
        if (!this.userList || !(this.userChoices?.isMounted())) {
            return;
        }
        const newUserListItem = document.createElement("li");
        newUserListItem.textContent = username;
        this.userList.appendChild(newUserListItem);
        this.userChoices!.onUserJoined(username);
    }

    private handleUserLeft(username: string): void {
        if (username === ScrumPokerApiImpl.ADMIN_NAME) {
            this.unmount().then(() => window.location.reload());
            return;
        }
        if (!this.userList) {
            // Early init, return without modifying anything and rely on retrieving up-to-date data from server
            return;
        }

        const removeChild = Array.from(this.userList!.children)
            .find((e: Element) => e.textContent === username);
        if (!removeChild) {
            throw new Error(`Tried to remove non-existant user ${username}`);
        }
        this.userList!.removeChild(removeChild);
        this.userChoices!.onUserLeft(username);
    }

    private handleUserPurged(username: string): void {
        this.userChoices!.onUserPurged(username);
    }

    private handleUserChoseCard(username: string, card: string): void {
        this.userChoices?.onUserChoseCard(username, card);
    }

    // --- Local methods ---
    public async init() {
        await this.loadTemplate();
        const sessionId = this.sessionIdFromLocalStorage(this.roomId) || uuid().replaceAll("-", "");
        this.setSessionIdInLocalStorage(sessionId, this.roomId);
        this.api = await createApiConn(sessionId);
        const listener = new ListenerImpl({
            onUserChoseCard: this.handleUserChoseCard.bind(this),
            onUserJoined: this.handleUserJoined.bind(this),
            onUserLeft: this.handleUserLeft.bind(this),
            onUserPurged: this.handleUserPurged.bind(this),
            onIssueChanged: this.handleIssueChanged.bind(this)
        });

        this.authToken = await this.api.joinRoom(this.roomId, this.username, listener, sessionId, this.roomPass);
        this.roomName = await this.api.getRoomName(this.roomId, this.authToken);
        this.roomUsers = await this.api.getRoomUsers(this.roomId, this.authToken);
        this.didInit = true;
    }

    private async onCardSelected(card: string) {
        this.cardList!.removeHighlights();
        this.cardList!.highlightCardByValue(card, CardList.HIGHLIGHT.PENDING);
        await this.api?.chooseCard(this.roomId, card, this.authToken!)
            .then(() => {
                this.cardList!.highlightCardByValue(card, CardList.HIGHLIGHT.OK);
            })
            .catch((err) => {
                throw new Error(`Unable to select card: ${err}`);
            });
    }

    protected async onMount() {
        if (!this.didInit) {
            throw new Error("Tried to mount ViewClient before initialization");
        }
        super.onMount();

        const cards = await this.api!.getRoomCards(this.roomId, this.authToken!);
        const cardHolderTemplate = this.element!.querySelector("div#cardHolder")!;
        if (!this.showCards) {
            cardHolderTemplate.remove();
        } else {
            this.cardList = new CardList(cardHolderTemplate.parentElement!, cards, { modify: false, add: false });
            cardHolderTemplate.remove();
            this.cardList.setOnSelect((card) => this.onCardSelected(card));
            await this.cardList.mount();
            this.cardList.cardsInactive();
        }

        this.element!.querySelector<HTMLSpanElement>("span#roomId")!.textContent = this.roomId.toString().padStart(4, "0");
        this.element!.querySelector<HTMLSpanElement>("span#roomName")!.textContent = this.roomName || "undefined";
        this.shareBtn = new ShareRoomButton(this.element!.querySelector<HTMLHeadingElement>("h1")!, this.roomId, this.roomPass);
        await this.shareBtn.mount();

        this.userList = this.element!.querySelector<HTMLUListElement>("div.userList ul")!;
        const userChoicesCardHolderTemplate = this.element!.querySelector("div#userHolder")!;
        this.userChoices = new UserChoices(userChoicesCardHolderTemplate.parentElement!, []);
        userChoicesCardHolderTemplate.remove();
        await this.userChoices.mount();
        this.roomUsers!.forEach(user => this.handleUserJoined(user));
        // TODO: If room does not support 'late joiners', return
        const roomState: IRoomState = await this.api!.getRoomState(this.roomId, this.authToken!);
        if (roomState.issue) {
            this.handleIssueChanged(roomState.issue);
        }
        Object.entries(roomState.choices).forEach(e => {
            if (e[0] === this.username) {
                this.onCardSelected(e[1]);
            }
            this.handleUserChoseCard(e[0], e[1]);
        });
    }

    protected onUnmount() {
        super.onUnmount();
        this.shareBtn?.unmount();
        this.api?.leaveRoom(this.roomId!, this.authToken!);
        if ((this.api as any)?.disconnect) {
            (this.api as any).disconnect();
        }
    }

    private sessionIdFromLocalStorage(roomId: number): string|null {
        const localStorageValue = localStorage.getItem(LSK_SESSION_ID);
        if (!localStorageValue) return null;
        const parsed: ISessionTuple = JSON.parse(localStorageValue);
        if (parsed.roomId !== roomId) return null;
        return parsed.sessionId;
    }

    private setSessionIdInLocalStorage(sessionId: string, roomId: number): void {
        const parsed: ISessionTuple = { sessionId, roomId };
        localStorage.setItem(LSK_SESSION_ID, JSON.stringify(parsed));
    }
}
