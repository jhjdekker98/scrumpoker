import "./view-client.scss";
import {Component} from "../../component/component";
import {newWebSocketRpcSession, RpcStub} from "capnweb";
import {ScrumPokerApi} from "../../../../ws-server/interfaces";
import {PORT_NUMBER} from "../../../../ws-server/model/constants";
import {CardList} from "../card-list/card-list";
import {ListenerImpl} from "../../../model/ListenerImpl";
import {UserChoices} from "../card-list/user-choices/user-choices";

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

    constructor(parent: HTMLElement, roomId: number, username: string, roomPass?: string, showCards: boolean = true) {
        super(parent);
        this.roomId = roomId;
        this.username = username;
        this.roomPass = roomPass;
        this.showCards = showCards;
    }

    // --- Delegation handlers ---
    private handleIssueChanged(issue: string): void {
        document.querySelector<HTMLHeadingElement>("h2#issue").innerText = issue;
        this.userChoices!.reset();
        this.cardList!.removeHighlights();
        this.cardList!.cardsActive();
    }

    private handleUserJoined(username: string): void {
        if (!this.userList || !(this.userChoices?.isMounted())) {
            return;
        }
        const newUserListItem = document.createElement("li");
        newUserListItem.innerText = username;
        this.userList.appendChild(newUserListItem);
        this.userChoices!.onUserJoined(username);
    }

    private handleUserLeft(username: string): void {
        const removeChild = Array.from(this.userList!.children)
            .find((e: HTMLElement) => e.innerText === username);
        if (!removeChild) {
            throw new Error(`Tried to remove non-existant user ${username}`);
        }
        this.userList!.removeChild(removeChild);
        this.userChoices!.onUserLeft(username);
    }

    private handleUserChoseCard(username: string, card: string): void {
        this.userChoices?.onUserChoseCard(username, card);
    }

    // --- Local methods ---
    private async init() {
        // TODO: Make URL configurable
        this.api = newWebSocketRpcSession<ScrumPokerApi>(`http://localhost:${PORT_NUMBER}/api`);
        const listener = new ListenerImpl({
            onUserChoseCard: this.handleUserChoseCard.bind(this),
            onUserJoined: this.handleUserJoined.bind(this),
            onUserLeft: this.handleUserLeft.bind(this),
            onIssueChanged: this.handleIssueChanged.bind(this)
        });

        this.authToken = await this.api.joinRoom(this.roomId, this.username, listener, this.roomPass);
        this.roomName = await this.api.getRoomName(this.roomId, this.authToken);
        this.roomUsers = await this.api.getRoomUsers(this.roomId, this.authToken);
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
        super.onMount();
        await this.init();

        const cards = await this.api!.getRoomCards(this.roomId, this.authToken!);
        const cardHolderTemplate = this.element!.querySelector("div#cardHolder");
        if (!this.showCards) {
            cardHolderTemplate.remove();
        } else {
            this.cardList = new CardList(cardHolderTemplate.parentElement!, cards, { modify: false, add: false });
            cardHolderTemplate.remove();
            this.cardList.setOnSelect((card) => this.onCardSelected(card));
            await this.cardList.mount();
            this.cardList.cardsInactive();
        }

        this.element!.querySelector<HTMLSpanElement>("span#roomId").innerText = this.roomId.toString().padStart(4, "0");
        this.element!.querySelector<HTMLSpanElement>("span#roomName").innerText = this.roomName.toString();
        this.userList = this.element!.querySelector<HTMLUListElement>("div.userList ul");
        const userChoicesCardHolderTemplate = this.element!.querySelector("div#userHolder");
        this.userChoices = new UserChoices(userChoicesCardHolderTemplate.parentElement!, []);
        userChoicesCardHolderTemplate.remove();
        await this.userChoices.mount();
        this.roomUsers!.forEach(user => this.handleUserJoined(user));
    }

    protected onUnmount() {
        super.onUnmount();
        this.api?.leaveRoom(this.roomId!, this.authToken!);
    }
}
