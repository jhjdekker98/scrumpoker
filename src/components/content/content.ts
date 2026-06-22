import "./content.scss";
import ContentTemplate from "./content.html?raw";
import {Component} from "@slyce.dev/ridr";
import {CreateServer} from "./create-server/create-server";
import {JoinServer} from "./join-server/join-server";
import {ViewServer} from "./view-server/view-server";
import {ViewClient} from "./view-client/view-client";
import {LoadingSpinner} from "../shared/loading-spinner/loading-spinner";
import {showError} from "../../constants";

export class Content extends Component {
    // noinspection JSAnnotator
    static template = ContentTemplate;

    protected async onMount() {
        super.onMount();

        const createServer = new CreateServer(this.element!);
        const joinServer = new JoinServer(this.element!);

        createServer.setOnSubmit(async (roomName: string, cards: string[], roomPass?: string) => {
            const viewServer = new ViewServer(this.element!, roomName, cards, roomPass);
            const loadingSpinner = new LoadingSpinner(this.element!);
            await Promise.all([createServer.unmount(), joinServer.unmount()]);
            await loadingSpinner.mount();
            await viewServer.init()
                .then(async () => {
                    await viewServer.mount();
                    await loadingSpinner.unmount();
                    this.afterMount();
                }).catch(async (err) => {
                    await createServer.mount();
                    await joinServer.mount();
                    await loadingSpinner.unmount();
                    this.afterMount();
                    showError(this.element!, err);
                });
        });
        joinServer.setOnSubmit(async (roomId: number, username: string, roomPass?: string) => {
            const viewClient = new ViewClient(this.element!, roomId, username, roomPass);
            const loadingSpinner = new LoadingSpinner(this.element!);
            await Promise.all([createServer.unmount(), joinServer.unmount()]);
            await loadingSpinner.mount();
            await viewClient.init()
                .then(async () => {
                    await viewClient.mount();
                    await loadingSpinner.unmount();
                    this.afterMount();
                }).catch(async (err) => {
                    await createServer.mount();
                    await joinServer.mount();
                    await loadingSpinner.unmount();
                    this.afterMount();
                    showError(this.element!, err);
                });
        });

        await createServer.mount();
        await joinServer.mount();
        this.afterMount();
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
