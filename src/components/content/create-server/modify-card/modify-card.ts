import "./modify-card.scss";
import {Component} from "../../../component/component";

export class ModifyCard extends Component {
    private readonly onSubmit?: (val) => void;
    private readonly title: string;
    constructor(parent: HTMLElement, title: string = "Modify card", onSubmit?: (val) => void) {
        super(parent);
        this.onSubmit = onSubmit;
        this.title = title;
    }

    protected onMount() {
        super.onMount();
        this.element!.querySelector("h3").innerText = this.title;
        this.element!.querySelector(".modify-card").addEventListener("click", (e) => e.stopPropagation());
        this.element!.addEventListener("click", () => this.unmount());
        this.element!.querySelector("button").addEventListener("click", () => {
            const val = this.element!.querySelector("input").value;
            if (!!val && !!this.onSubmit) {
                this.onSubmit(val);
            }
            this.unmount();
        })
    }
}
