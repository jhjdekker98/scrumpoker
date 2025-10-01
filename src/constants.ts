export const THEME_KEY = "selected-theme";
export type Theme = "light" | "dark";
const themes = import.meta.glob("/themes/*.scss");

export function applyTheme(theme: Theme): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const themePath = `/themes/theme-${theme}.scss`;
        const loader = themes[themePath];
        if (loader) {
            await loader();
            document.documentElement.setAttribute("data-theme", theme);
            localStorage.setItem(THEME_KEY, theme);
            resolve();
        } else {
            reject(`Theme ${theme} not found`);
        }
    });
}
