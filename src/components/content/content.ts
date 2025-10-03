import "./content.scss";
import {Component} from "../component/component";
import {CreateServer} from "./create-server/create-server";
import {JoinServer} from "./join-server/join-server";
import {ViewServer} from "./view-server/view-server";
import {ViewClient} from "./view-client/view-client";

export class Content extends Component {
    constructor(parent: HTMLElement) {
        super(parent);
    }

    protected async onMount() {
        super.onMount();

        const createServer = new CreateServer(this.element!);
        const joinServer = new JoinServer(this.element!);

        createServer.setOnSubmit(async (roomName: string, cards: string[], roomPass?: string) => {
            const viewServer = new ViewServer(this.element!, roomName, cards, roomPass);
            viewServer.init().then(() => {
                createServer.unmount();
                joinServer.unmount();

                viewServer.mount();
            });
        });
        joinServer.setOnSubmit(async (roomId: number, username: string, roomPass?: string) => {
            const viewClient = new ViewClient(this.element!, roomId, username, roomPass);
            viewClient.init().then(() => {
                createServer.unmount();
                joinServer.unmount();

                viewClient.mount();
            });
        });

        await createServer.mount();
        await joinServer.mount();
    }
}
