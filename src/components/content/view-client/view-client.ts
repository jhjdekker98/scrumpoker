import "./view-client.scss";
import {Component} from "../../component/component";
import {newWebSocketRpcSession, RpcStub, RpcTarget} from "capnweb";
import {Listener, ScrumPokerApi} from "../../../../ws-server/interfaces";
import {PORT_NUMBER} from "../../../../ws-server/model/constants";

class ClientListener extends RpcTarget implements Listener {
    async onMessage(msg: string): Promise<void> {
        console.log("[" + Date.now() + "]:", msg);
    }
}

export class ViewClient extends Component {

    private readonly roomId: number;
    private readonly username: string;
    private readonly roomPass?: string;
    private authToken?: string
    private api?: RpcStub<ScrumPokerApi>;

    constructor(parent: HTMLElement, roomId: number, username: string, roomPass?: string) {
        super(parent);
        this.roomId = roomId;
        this.username = username;
        this.roomPass = roomPass;
    }

    public async init() {
        // TODO: Make URL configurable
        this.api = newWebSocketRpcSession<ScrumPokerApi>(`http://localhost:${PORT_NUMBER}/api`);
        const listener = new ClientListener();

        // Error is thrown up to caller
        this.authToken = await this.api.joinRoom(this.roomId, this.username, listener, this.roomPass);

        // TODO: get Room name
    }

    protected onUnmount() {
        super.onUnmount();
        this.api?.leaveRoom(this.roomId!, this.authToken!);
    }
}
