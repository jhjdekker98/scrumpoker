import "./header.scss";
import HeaderTemplate from "./header.html?raw";
import {Component} from "@slyce.dev/ridr";
import {THEME_KEY, Theme, applyTheme} from "../../constants";

export class Header extends Component {
    // noinspection JSAnnotator
    static template = HeaderTemplate;

    protected onMount() {
        const button = this.element?.querySelector("#themeBtn");
        button?.addEventListener("click", () => {
            const current = (localStorage.getItem(THEME_KEY) as Theme) || "dark";
            const next: Theme = current === "light" ? "dark" : "light";
            applyTheme(next);
        });
    }
}
