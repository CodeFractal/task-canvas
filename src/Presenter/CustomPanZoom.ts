import { Rectangle, Vector2D } from "../Abstract/Math";

export class CustomPanZoom {
    private static readonly minScale = 0.25;
    private static readonly maxScale = 2;

    private static canvas: HTMLElement | null = null;
    private static scale = 1;
    private static translation: Vector2D = Vector2D.zero;

    public static init(el: HTMLElement): void {
        this.canvas = el;
        this.canvas.style.transformOrigin = "0 0";
        this.canvas.style.cursor = "default";
        this.updateTransform();
        (this.canvas.parentElement || this.canvas).addEventListener("wheel", e => this.onWheel(e), { passive: false });
    }

    private static updateTransform(): void {
        if (this.canvas) {
            this.canvas.style.transform = `translate(${this.translation.x}px, ${this.translation.y}px) scale(${this.scale})`;
        }
    }

    private static onWheel(e: WheelEvent): void {
        e.preventDefault();

        // Zoom in/out with ctrl + scrollwheel
        if (e.ctrlKey) {
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            const mousePos = new Vector2D(e.clientX, e.clientY);
            this.setScale(this.scale + delta, mousePos);
        }

        // Pan with scrollwheel
        else {
            const delta = new Vector2D(e.deltaX, e.deltaY);
            this.translation = this.translation.sub(delta);
            this.updateTransform();
        }
    }

    public static setScale(newScale: number, eigenpoint: Vector2D): void {
        newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
        if (newScale !== this.scale && this.canvas) {
            const scaleRatio = newScale / this.scale;

            // Compute the new translation so that the eigenpoint remains fixed
            this.translation = this.translation.mul(scaleRatio).add(eigenpoint.mul(1 - scaleRatio));
            this.scale = newScale;
            this.updateTransform();
        }
    }

    public static panBy(delta: Vector2D): void {
        this.translation = this.translation.add(delta);
        this.updateTransform();
    }

    public static getScale(): number {
        return this.scale;
    }

    public static getTranslation(): Vector2D {
        return this.translation;
    }

}
