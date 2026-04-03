import "./content.scss";
import ContentTemplate from "./content.html?raw";
import {Component} from "../component/component";
import {CreateServer} from "./create-server/create-server";
import {JoinServer} from "./join-server/join-server";
import {ViewServer} from "./view-server/view-server";
import {ViewClient} from "./view-client/view-client";

export class Content extends Component {
    // noinspection JSAnnotator
    static template = ContentTemplate;

    constructor(parent: HTMLElement) {
        super(parent);
    }

    protected async onMount() {
        super.onMount();

        const createServer = new CreateServer(this.element!);
        const joinServer = new JoinServer(this.element!);

        createServer.setOnSubmit(async (roomName: string, cards: string[], roomPass?: string) => {
            const viewServer = new ViewServer(this.element!, roomName, cards, roomPass);
            await viewServer.init()
                .then(() => viewServer.mount())
                .then(() => {
                    createServer.unmount();
                    joinServer.unmount();
                    this.afterMount();
                })
                .catch((err) => {
                    this.showErrorPopup(err);
                });
        });
        joinServer.setOnSubmit(async (roomId: number, username: string, roomPass?: string) => {
            const viewClient = new ViewClient(this.element!, roomId, username, roomPass);
            await viewClient.init()
                .then(() => viewClient.mount())
                .then(() => {
                    createServer.unmount();
                    joinServer.unmount();
                    this.afterMount();
                }).catch((err) => {
                    this.showErrorPopup(err);
                });
        });

        await createServer.mount();
        await joinServer.mount();
        this.afterMount();
    }

    private showErrorPopup(error: string): void {
        alert(error); // TODO: Implement a custom, styled dialog box
    }

    private afterMount(): void {
        document.querySelectorAll<HTMLDivElement>(".inputBox div.resizer[for]").forEach(resizer => {
            const forElem = document.querySelector<HTMLInputElement>(`input[name="${resizer.getAttribute("for")}"]`);
            if (!forElem) return;
            forElem.addEventListener("input", () => {
                resizer.innerHTML = forElem.value + `&#xFEFF;`; // Abuse a non-whitespace zero-width character to count spaces too
                const computedStyle = window.getComputedStyle(forElem);
                const paddingLeft = parseFloat(computedStyle.paddingLeft || '0');
                const paddingRight = parseFloat(computedStyle.paddingLeft || '0');
                const minWidth = resizer.getBoundingClientRect().width - paddingLeft - paddingRight;
                forElem.style.minWidth = Math.ceil(minWidth) + "px";
            })
        });
    }
}
