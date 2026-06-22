import "./share-room-button.scss";
import ShareRoomButtonTemplate from "./share-room-button.html?raw"
import {Component} from "@slyce.dev/ridr";
import {showPrompt} from "../../../constants";

export class ShareRoomButton extends Component {
    // noinspection JSAnnotator
    static template = ShareRoomButtonTemplate;

    private readonly roomId: number;
    private readonly roomPass?: string;

    constructor(parent: HTMLElement, roomId: number, roomPass?: string) {
        super(parent);
        this.roomId = roomId;
        this.roomPass = roomPass;
    }

    protected onMount() {
        super.onMount();
        this.element!.addEventListener("click", () => {
            showPrompt(this.parent,
                "Copy the URL below to share this room with others",
                "Share room",
                this.roomShareUrl);
        });
    }

    private get roomShareUrl(): string {
        let baseUrl = `${window.location.origin}?room=${encodeURIComponent(this.roomId)}`;
        if (this.roomPass) {
            baseUrl += `&pass=${encodeURIComponent(this.roomPass)}`;
        }
        return baseUrl;
    }
}
