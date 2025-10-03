import {Component} from "../../component/component";
import "./create-server.scss";
import {ModifyCard} from "./modify-card/modify-card";
import {PasswordInput} from "../../shared/password-input/password-input";
import {ViewServer} from "../view-server/view-server";

export interface Coord {
    x: number,
    y: number
}

export interface DragPosition {
    mousePos: Coord,
    offset: Coord
}

type SubmitSignature = (roomName: string, cards: string[], roomPass?: string) => void;

export class CreateServer extends Component {
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
    private static readonly DEFAULT_CARDS = ["1", "2", "3", "5", "8", "13", "20"];
    private static readonly DRAG_DIST_MIN = 6;
    private dragStart: DragPosition|null = null;
    private dragTarget: HTMLElement|null = null;
    private cardGap: string = "100px";
    private roomName: HTMLInputElement|null = null;
    private roomPass: HTMLInputElement|null = null;
    private onSubmit: SubmitSignature;

    constructor(parent: HTMLElement) {
        super(parent);
    }

    public getCardOrder() {
        const cards = this.element!.querySelectorAll("#cardHolder .card:not(.addCard)");
        return Array.from(cards).map(x => x.querySelector("h1").innerText);
    }

    protected onMount() {
        super.onMount();
        const cardHolder = this.element!.querySelector("#cardHolder");
        const cardHolderComputedStyle = window.getComputedStyle(cardHolder);
        const cardHolderGap = parseFloat(cardHolderComputedStyle.columnGap || cardHolderComputedStyle.gap || '0');

        // Init cards
        const cardTemplate = cardHolder.querySelector(".card");
        this.cardGap = Math.round(cardTemplate.getBoundingClientRect().width + cardHolderGap) + "px";
        const addCard = cardHolder.querySelector(".card.addCard");
        CreateServer.DEFAULT_CARDS.forEach(text => this.createNewCard(text, cardTemplate, cardHolder, addCard));
        cardTemplate.remove();

        this.addDragHandlers();

        addCard.addEventListener("click", () => {
            const modifyCard = new ModifyCard(document.body, "Add card", (val) => {
                this.createNewCard(val, cardTemplate, cardHolder, addCard);
            })
            modifyCard.mount();
        });

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

    private createNewCard(text: string, cardTemplate: Node, cardHolder: Node, beforeElement: Node) {
        const newCard = (cardTemplate.cloneNode(true) as Element);
        newCard.querySelector("h1").innerText = text;

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

        cardHolder.insertBefore(newCard, beforeElement);
    }

    private addDragHandlers() {
        document.body.addEventListener("mouseup", (e) => {
            this.dragEnd();
        });

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
        });

        document.body.addEventListener("mousemove", (e) => {
            if (e.buttons === 0) {
                this.dragEnd();
                return;
            }
            if (this.dragStart === null || this.dragTarget === null) return;
            const dist = this.distance({x: e.x, y: e.y}, this.dragStart.mousePos);
            if(dist < CreateServer.DRAG_DIST_MIN) return;

            const elemPos = this.dragElemPosition({x: e.x, y: e.y});
            if (elemPos === null) return;

            this.getDragGhost(this.dragTarget!).then(moveHolder => {
                this.dragTarget!.style.display = "none";
                moveHolder.style.opacity = "0.5";
                moveHolder.style.left = elemPos.x + "px";
                moveHolder.style.top = elemPos.y + "px";
            });

            const cards = Array.from(this.element!.querySelectorAll<HTMLElement>("#cardHolder .card"))
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
            //console.warn(cards[gapCardIndex].querySelector("h1").innerText);
            cards.forEach(card => card.style.marginLeft = "");
            cards[gapCardIndex].style.marginLeft = this.cardGap;
        });
    }

    private dragEnd(): void {
        if (this.dragStart === null && this.dragTarget === null) {
            return;
        }
        this.dragStart = null;
        const cards = Array.from(this.element!.querySelectorAll<HTMLElement>("#cardHolder .card"));
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
            for (const prop of CreateServer.GHOST_CSS_PROPS) {
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
            console.error("Callback for CreateServer::onSubmit not set");
            return;
        }
        this.onSubmit(this.roomName.value, this.getCardOrder(), this.roomPass.value);
    }
}
