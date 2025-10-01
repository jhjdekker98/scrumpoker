import { Component } from "../component/component";
import {THEME_KEY, Theme, applyTheme} from "../../constants";
import "./header.scss";

export class Header extends Component {
    constructor(parent: HTMLElement) {
        super(parent);
    }

    protected onMount() {
        const button = this.element?.querySelector("#themeBtn");
        button?.addEventListener("click", () => {
            const current = (localStorage.getItem(THEME_KEY) as Theme) || "dark";
            const next: Theme = current === "light" ? "dark" : "light";
            applyTheme(next);
        });
    }
}
