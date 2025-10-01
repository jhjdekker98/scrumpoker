import "/index.scss";
import { Header } from "/components/header/header"
import {THEME_KEY, Theme, applyTheme} from "/constants";
import {Content} from "./components/content/content";

const app = document.getElementById("app")!;
if (!app) {
    throw new Error("No app element defined in index.html");
}

const savedTheme = (localStorage.getItem(THEME_KEY) as Theme) || "dark";
applyTheme(savedTheme).then(() => {
    document.body.classList.remove("disable-transitions");
}).catch(err => {
    console.error(err);
});

const header = new Header(app);
await header.mount();

const content = new Content(app);
await content.mount();
