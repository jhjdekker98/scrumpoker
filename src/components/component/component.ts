export abstract class Component {
    private static readonly MOUNT_EVENT_NAME = "mounted";
    public element: HTMLElement | null = null;
    private templateLoaded: boolean = false;
    private childComponents: Component[] = [];

    constructor(protected parent: HTMLElement) {}

    static template: string;

    protected async loadTemplate(): Promise<void> {
        if (this.templateLoaded) return;
        const html = (this.constructor as typeof Component).template;
        if (!html) {
            console.error(`Template not found on static property for ${this.constructor.name}`);
            return;
        }
        const template = document.createElement("template");
        template.innerHTML = html.trim();
        this.element = template.content.firstElementChild as HTMLElement;
        this.templateLoaded = true;
    }

    public async mount(): Promise<void> {
        await this.loadTemplate();

        if (this.element) {
            this.parent.appendChild(this.element);

            this.element.addEventListener(Component.MOUNT_EVENT_NAME, (e: Event) => {
                const customEvent = e as CustomEvent<Component>;
                if (customEvent.detail === this) return;
                e.stopPropagation();
                this.childComponents.push(customEvent.detail);
            });

            this.element.dispatchEvent(new CustomEvent(Component.MOUNT_EVENT_NAME, {
                detail: this,
                bubbles: true
            }));
        }

        await this.onMount();
    }

    public async unmount(): Promise<void> {
        for (const child of this.childComponents) {
            await child.unmount();
        }
        this.childComponents = []; // Clean up references

        if (this.element && this.element.parentElement) {
            this.element.parentElement.removeChild(this.element);
            this.element = null;
        }

        await this.onUnmount();
    }

    protected onMount(): void {}

    protected onUnmount(): void {}

    private getFilenameForClassname(classname: string): string {
        return classname.replace(/(?!^)([A-Z]{1}.+?)/g, '-$1').toLowerCase();
    }
}