import "./content.scss";
import {Component} from "../component/component";
import {CreateServer} from "./create-server/create-server";
import {JoinServer} from "./join-server/join-server";

export class Content extends Component {
    constructor(parent: HTMLElement) {
        super(parent);
    }

    protected async onMount() {
        super.onMount();

        const createServer = new CreateServer(this.element!);
        await createServer.mount();

        const joinServer = new JoinServer(this.element!);
        await joinServer.mount();
    }
}
