const templates = import.meta.glob("/components/**/*.html", { as: "raw" });


export abstract class Component {
    public element: HTMLElement | null = null;

    constructor(protected parent: HTMLElement) {}

    protected async loadTemplate(): Promise<void> {
        const classname = this.getFilenameForClassname(this.constructor.name);

        const match = Object.entries(templates).find(([path, _]) =>
            path.endsWith(`/${classname}.html`)
        );

        if (!match) {
            console.warn(`Template not found for ${classname}`);
            return;
        }

        const html = await match[1]();
        const template = document.createElement("template");
        template.innerHTML = html.trim();
        this.element = template.content.firstElementChild as HTMLElement;
    }

    public async mount(): Promise<void> {
        await this.loadTemplate();
        if (this.element) this.parent.appendChild(this.element);
        this.onMount();
    }

    public unmount(): void {
        if (this.element && this.element.parentElement) {
            this.element.parentElement.removeChild(this.element);
            this.element = null;
        }

        this.onUnmount();
    }

    protected onMount(): void {}

    protected onUnmount(): void {}

    private getFilenameForClassname(classname: string): string {
        return classname.replace(/(?!^)([A-Z]{1}.+?)/g, '-$1').toLowerCase();
    }
}
