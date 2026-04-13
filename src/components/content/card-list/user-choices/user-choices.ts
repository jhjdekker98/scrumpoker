import "./user-choices.scss";
import UserChoicesTemplate from "./user-choices.html?raw";
import {Component} from "../../../component/component";
import {CardList} from "../card-list";

export class UserChoices extends Component {
    private readonly userChoices: Map<string, string> = new Map<string, string>(); // username -> choice
    private readonly users: string[] = [];
    private cardList?: CardList;
    private mounted: boolean = false;

    // noinspection JSAnnotator
    static template = UserChoicesTemplate;

    constructor(parent: HTMLElement, users: string[]) {
        super(parent);
        this.users = users;
    }

    protected async onMount() {
        super.onMount();

        const cardHolderTemplate = this.element!;
        this.cardList = new CardList(this.element!.parentElement!, [], { modify: false, add: false });
        cardHolderTemplate.remove();
        await this.cardList.mount();
        this.element = this.cardList.element;
        this.mounted = true;
    }

    public isMounted(): boolean {
        return this.mounted;
    }

    public onUserChoseCard(username: string, card: string): void {
        this.userChoices.set(username, card);
        this.cardList!.highlightCardByIndex(this.users.indexOf(username), CardList.HIGHLIGHT.PENDING);
        if (this.arraysEqual(Array.from(this.userChoices.keys()), this.users)) {
            this.onAllUsersChoseCards();
        }
    }

    public onUserJoined(username: string): void {
        this.users.push(username);
        const usernameTag = document.createElement("span");
        usernameTag.className = "userTag";
        usernameTag.textContent = username;
        this.cardList!.createNewCard("?").appendChild(usernameTag);
    }

    public onUserLeft(username: string): void {
        if (!this.users.includes(username)) {
            throw new Error(`Tried to remove user ${username} who is not in this Room`);
        }
        const userIndex = this.users.indexOf(username);
        this.users.splice(userIndex, 1);
        this.userChoices.delete(username);
        this.cardList!.removeCard(userIndex);
    }

    public reset(): void {
        this.cardList!.removeHighlights();
        this.cardList?.modifyCards("?");
        this.userChoices.clear();
    }

    private onAllUsersChoseCards(): void {
        this.userChoices.forEach((choice, username) => {
            const cardIndex = this.users.indexOf(username);
            this.cardList!.modifyCard(cardIndex, choice);
            this.cardList!.highlightCardByIndex(cardIndex, CardList.HIGHLIGHT.OK);
        });
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
