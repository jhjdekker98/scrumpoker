import "./view-server.scss";
import {Component} from "../../component/component";
import {newWebSocketRpcSession, RpcStub, RpcTarget} from "capnweb";
import {Listener, ScrumPokerApi} from "../../../../ws-server/interfaces";
import {PORT_NUMBER} from "../../../../ws-server/model/constants";

class ServerListener extends RpcTarget implements Listener {
    async onMessage(msg: string): Promise<void> {
        console.log("[" + Date.now() + "]:", msg);
    }
}

export class ViewServer extends Component {
    private readonly roomName: string;
    private readonly cards: string[];
    private readonly roomPass?: string;
    private authToken?: string
    private roomId?: number;
    private api?: RpcStub<ScrumPokerApi>;

    constructor(parent: HTMLElement, roomName: string, cards: string[], roomPass?: string) {
        super(parent);
        this.roomName = roomName;
        this.cards = cards;
        this.roomPass = roomPass;
    }

    public async init() {
        // TODO: Make URL configurable
        this.api = newWebSocketRpcSession<ScrumPokerApi>(`http://localhost:${PORT_NUMBER}/api`);
        const listener = new ServerListener();

        // Error is thrown up to caller
        this.roomId = await this.api.createRoom(this.roomName, this.cards, listener, this.roomPass);
    }

    protected onMount() {
        super.onMount();

        this.element!.querySelector<HTMLSpanElement>("span#roomId").innerText = this.roomId.toString().padStart(4, "0");
        this.element!.querySelector<HTMLSpanElement>("span#roomName").innerText = this.roomName;
    }

    protected onUnmount() {
        super.onUnmount();
        this.api?.leaveRoom(this.roomId!, this.authToken!);
    }
}
