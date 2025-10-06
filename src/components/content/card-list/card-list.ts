import "./card-list.scss";
import {Component} from "../../component/component";
import {ModifyCard} from "../create-server/modify-card/modify-card";

interface Coord {
    x: number,
    y: number
}

interface DragPosition {
    mousePos: Coord,
    offset: Coord
}

interface CardListOptions {
    modify: boolean,
    add: boolean
}

type SelectSignature = (card: string) => void;

export class CardList extends Component {
    public static readonly HIGHLIGHT = {
        PENDING: "pending",
        OK: "ok"
    };
    private static readonly HIGHLIGHT_ATTRIBUTE = "highlight";
    private static readonly DEFAULT_CARDS = ["1", "2", "3", "5", "8", "13", "20"];
    private static readonly GHOST_CSS_PROPS = [
        "width",
        "height",
        "background-color",
        "border",
        "border-radius",
        "color",
        "font-size",
        "display",
        "flex-direction",
        "flex-wrap",
        "justify-content",
        "align-items"];
    private static readonly DRAG_DIST_MIN = 6;
    private readonly options: CardListOptions;
    private readonly cards: string[];
    private cardTemplate: HTMLDivElement;
    private dragStart: DragPosition|null = null;
    private dragTarget: HTMLElement|null = null;
    private cardGap: string = "100px";
    private onSelect: SelectSignature;
    private abortController: AbortController = new AbortController();

    constructor(parent: HTMLElement, cards?: string[], options?: CardListOptions) {
        super(parent);
        this.options = options || {
            modify: true,
            add: true
        };
        this.cards = cards || CardList.DEFAULT_CARDS;
    }

    public setOnSelect(onSelect: SelectSignature): void {
        this.onSelect = onSelect;
    }

    public removeHighlights(): void {
        Array.from(this.element!.querySelectorAll<HTMLDivElement>(".card"))
            .forEach(card => card.removeAttribute(CardList.HIGHLIGHT_ATTRIBUTE));
    }

    // TODO: Figure out value-safety for highlight param
    public highlightCardByIndex(index: number, highlight: string): void {
        const allCards = this.element!.querySelectorAll<HTMLDivElement>(".card");
        if (index < 0 || index >= allCards.length) {
            throw new Error(`Tried to access non-existent card with index ${index}`);
        }
        allCards[index].setAttribute(CardList.HIGHLIGHT_ATTRIBUTE, highlight);
    }

    public highlightCardByValue(card: string, highlight: string): void {
        const cardIndex = Array.from(this.element!.querySelectorAll<HTMLDivElement>(".card"))
            .findIndex(elem => elem.querySelector("h1").innerText === card);
        if (cardIndex === -1) {
            throw new Error(`Could not highlight non-existent card: ${card}`);
        }
        this.highlightCardByIndex(cardIndex, highlight);
    }

    public cardsInactive(): void {
        Array.from(this.element!.querySelectorAll<HTMLDivElement>(".card")).forEach(elem => {
            elem.style.pointerEvents = "none";
            elem.style.opacity = "0.8";
            elem.querySelector("h1").style.opacity = "0.5";
        });
    }

    public cardsActive(): void {
        Array.from(this.element!.querySelectorAll<HTMLDivElement>(".card")).forEach(elem => {
            elem.style.pointerEvents = "auto";
            elem.style.opacity = "1";
            elem.querySelector("h1").style.opacity = "1";
        });
    }

    protected onMount() {
        super.onMount();
        const cardHolderComputedStyle = window.getComputedStyle(this.element!);
        const cardHolderGap = parseFloat(cardHolderComputedStyle.columnGap || cardHolderComputedStyle.gap || '0');

        // Init cards
        const cardTemplate = this.element!.querySelector(".card");
        this.cardTemplate = (cardTemplate.cloneNode(true) as HTMLDivElement);
        this.cardGap = Math.round(cardTemplate.getBoundingClientRect().width + cardHolderGap) + "px";
        const addCard = this.element!.querySelector(".card.addCard");
        this.cards.forEach(text => this.createNewCard(text, addCard));
        cardTemplate.remove();

        if (this.options.modify) {
            this.addDragHandlers();
        } else {
            document.querySelectorAll<HTMLDivElement>(".card .buttonHolder")
                .forEach(elem => elem.remove());
        }

        if (this.options.add) {
            addCard.addEventListener("click", () => {
                const modifyCard = new ModifyCard(document.body, "Add card", (val) => {
                    this.createNewCard(val, addCard);
                })
                modifyCard.mount();
            });
        } else {
            addCard.remove();
        }
    }

    protected onUnmount() {
        super.onUnmount();
        this.abortController.abort();
    }

    public createNewCard(text: string, beforeElement?: Node): HTMLDivElement {
        const newCard = (this.cardTemplate.cloneNode(true) as HTMLDivElement);
        newCard.querySelector("h1").innerText = text;

        if (this.options.modify) {
            newCard.addEventListener("click", () => {
                const modifyCard = new ModifyCard(document.body, "Modify card", (val) => {
                    newCard.querySelector("h1").innerText = val;
                });
                modifyCard.mount();
            });
            newCard.querySelector(".removeBtn").addEventListener("click", (e) => {
                newCard.remove();
                e.stopPropagation();
            });
        } else {
            newCard.addEventListener("click", () => {
                if (!this.onSelect) {
                    throw new Error("Callback for CardList::onSelect not set");
                }
                this.onSelect(newCard.querySelector("h1").innerText);
            })
        }

        if (beforeElement) {
            this.element!.insertBefore(newCard, beforeElement);
        } else {
            this.element!.appendChild(newCard);
        }

        return newCard;
    }

    public modifyCard(index: number, value: string): void {
        const allCards = this.element!.querySelectorAll<HTMLDivElement>(".card");
        if (index < 0 || index >= allCards.length) {
            throw new Error(`Tried to access non-existant card with index" ${index}`);
        }
        allCards[index].querySelector("h1").innerText = value;
    }

    public removeCard(index: number): void {
        const allCards = this.element!.querySelectorAll<HTMLDivElement>(".card");
        if (index < 0 || index >= allCards.length) {
            throw new Error(`Tried to remove non-existant card with index" ${index}`);
        }
        allCards[index].remove();
    }

    public modifyCards(value: string): void {
        this.element!.querySelectorAll<HTMLDivElement>(".card").forEach(elem =>
            elem.querySelector("h1").innerText = value);
    }

    public cardCount(): number {
        return this.element!.querySelectorAll<HTMLDivElement>(".card").length;
    }

    private addDragHandlers() {
        document.body.addEventListener("mouseup", (e) => {
            this.dragEnd();
        }, { signal: this.abortController.signal });

        document.body.addEventListener("mousedown", (e) => {
            if (!(e.target instanceof HTMLElement)) return;
            const cardElem = e.target.closest(".card");
            if (!cardElem) return;
            this.dragTarget = (cardElem as HTMLElement);
            this.dragStart = {
                mousePos: {
                    x: e.clientX,
                    y: e.clientY
                },
                offset: {
                    x: e.clientX - cardElem.getBoundingClientRect().left,
                    y: e.clientY - cardElem.getBoundingClientRect().top
                }
            };
        }, { signal: this.abortController.signal });

        document.body.addEventListener("mousemove", (e) => {
            if (e.buttons === 0) {
                this.dragEnd();
                return;
            }
            if (this.dragStart === null || this.dragTarget === null) return;
            const dist = this.distance({x: e.x, y: e.y}, this.dragStart.mousePos);
            if(dist < CardList.DRAG_DIST_MIN) return;

            const elemPos = this.dragElemPosition({x: e.x, y: e.y});
            if (elemPos === null) return;

            this.getDragGhost(this.dragTarget!).then(moveHolder => {
                this.dragTarget!.style.display = "none";
                moveHolder.style.opacity = "0.5";
                moveHolder.style.left = elemPos.x + "px";
                moveHolder.style.top = elemPos.y + "px";
            });

            const cards = Array.from(this.element!.querySelectorAll<HTMLElement>(".card"))
                .filter(c => c !== this.dragTarget)
                .sort((a, b) => {
                    const centerA = this.getElementCenter(a);
                    const centerB = this.getElementCenter(b);
                    if (centerA.y === centerB.y) {
                        return centerB.x - centerA.x;
                    }
                    return centerB.y - centerA.y;
                });
            let gapCardIndex = 0;
            for (let i = 0; i < cards.length; i++) {
                const cardCenter = this.getElementCenter(cards[i]);
                if (e.x >= cardCenter.x && e.y >= cardCenter.y) {
                    break;
                }
                gapCardIndex = i;
            }
            cards.forEach(card => card.style.marginLeft = "");
            cards[gapCardIndex].style.marginLeft = this.cardGap;
        }, { signal: this.abortController.signal });
    }

    private dragEnd(): void {
        if (this.dragStart === null && this.dragTarget === null) {
            return;
        }
        this.dragStart = null;
        const cards = Array.from(this.element!.querySelectorAll<HTMLElement>(".card"));
        for (const card of cards) {
            if (card.style.marginLeft === this.cardGap) {
                card.style.marginLeft = "";
                card.parentElement.insertBefore(this.dragTarget!, card);
            }
        }
        this.dragTarget!.style.display = "";
        this.dragTarget = null;
        document.querySelector("#mover")?.remove();
    }

    private distance(a: Coord, b: Coord): number {
        return Math.sqrt(Math.pow(Math.abs(a.x - b.x), 2) + Math.pow(Math.abs(a.y - b.y), 2))
    }

    private dragElemPosition(mousePos: Coord): Coord | null {
        if (!this.dragStart || !this.dragTarget) return null;
        return {
            x: Math.round(mousePos.x - this.dragStart.offset.x),
            y: Math.round(mousePos.y - this.dragStart.offset.y)
        };
    }

    private getDragGhost(sourceElement: HTMLElement): Promise<HTMLElement> {
        const moverElement = document.querySelector<HTMLElement>("#mover");
        if (moverElement) {
            return Promise.resolve(moverElement);
        }

        return new Promise(resolve => {
            const clone = sourceElement.cloneNode(true) as HTMLElement;
            clone.id = "mover";

            clone.querySelector(".removeBtn").remove();

            clone.style.position = "absolute";
            clone.style.pointerEvents = "none";
            clone.style.opacity = "0.5";
            clone.style.zIndex = "9999";

            const computedStyle = window.getComputedStyle(sourceElement);
            for (const prop of CardList.GHOST_CSS_PROPS) {
                clone.style.setProperty(prop, computedStyle.getPropertyValue(prop));
            }

            clone.style.justifyContent = "center"; // Override

            document.body.appendChild(clone);
            resolve(clone);
        })
    }

    private getElementCenter(element: HTMLElement): Coord {
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + rect.width/2,
            y: rect.top + rect.height/2
        };
    }
}
