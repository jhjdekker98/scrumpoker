import "/index.scss";
import { Header } from "/components/header/header"
import {THEME_KEY, Theme, applyTheme, getQueryProps, showError, showPrompt} from "/constants";
import {Content} from "./components/content/content";
import {Footer} from "./components/footer/footer";
import {ViewClient} from "./components/content/view-client/view-client";

const app = document.getElementById("app")!;
if (!app) {
    throw new Error("No app element defined in index.html");
}

const savedTheme = (localStorage.getItem(THEME_KEY) as Theme) || "dark";
applyTheme(savedTheme).then(() => {
    requestAnimationFrame(() => document.body.classList.remove("disable-transitions"));
}).catch(err => {
    console.error(err);
});

const header = new Header(app);
await header.mount();

const footer = new Footer(app);
await footer.mount();

await (async () => {
    const props = getQueryProps();
    if (!Object.hasOwn(props, 'room')) {
        const content = new Content(app);
        await content.mount();
        return;
    }

    for (let i = 0; i < 3; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    const roomId: number = parseInt(props.room);
    const roomPass: string | undefined = props['pass'];
    const username = await showPrompt(app,
        "Please enter your username.",
        `Entering room ${roomId}`);
    if (!username) {
        showError(app, "You cannot join this room without a username", "Username required")
            .then(() => window.location.assign(window.location.origin));
    }

    const viewClient = new ViewClient(app, roomId, username, roomPass);
    await viewClient.init()
        .then(async () => {
            await viewClient.mount();
        }).catch(async (err) => {
            showError(app, err).then(() => window.location.assign(window.location.origin));
        });
})();