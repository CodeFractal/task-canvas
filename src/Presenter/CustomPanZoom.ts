import { Rectangle, Vector2D } from "../Abstract/Math";

export class CustomPanZoom {
    private static readonly minScale = 0.25;
    private static readonly maxScale = 2;
    private static readonly scrollIncrement = 20;
    private static readonly gridSize = 40;

    private static canvas: HTMLElement | null = null;
    private static gridPattern: SVGPatternElement | null = null;
    private static scale = 1;
    private static translation: Vector2D = Vector2D.zero;

    public static init(canvas: HTMLElement, grid: SVGElement): void {
        this.canvas = canvas;
        this.canvas.style.transformOrigin = "0 0";
        this.canvas.style.cursor = "default";

        const gridPattern = grid?.querySelector("pattern");
        if (!(gridPattern instanceof SVGPatternElement)) {
            throw new Error("Grid pattern not found");
        }
        this.gridPattern = gridPattern;
        this.gridPattern.setAttribute('width', `${this.gridSize}`);
        this.gridPattern.setAttribute('height', `${this.gridSize}`);

        this.updateTransform();
        (this.canvas.parentElement || this.canvas).addEventListener("wheel", e => this.onWheel(e), { passive: false });
    }

    private static updateTransform(): void {
        if (this.canvas) {
            this.canvas.style.transform = `translate(${this.translation.x}px, ${this.translation.y}px) scale(${this.scale})`;
        }
        if (this.gridPattern) {
            const translateX = this.translation.x % (this.gridSize * this.scale);
            const translateY = this.translation.y % (this.gridSize * this.scale);
            this.gridPattern.setAttribute('patternTransform', `translate(${translateX}, ${translateY}) scale(${this.scale})`);
        }
    }

    private static onWheel(e: WheelEvent): void {
        e.preventDefault();

        // Zoom in/out with ctrl + scrollwheel
        if (e.ctrlKey) {
            const delta = e.deltaY * -0.001;
            const mousePos = new Vector2D(e.clientX, e.clientY);
            this.setScale(this.scale * (1 + delta), mousePos);
        }
        else {
            let panX = 0;
            let panY = 0;
            const scrollIncrement = this.scrollIncrement * this.scale;
            if (e.shiftKey) {
                if (e.deltaY > 0) {
                    panX = -scrollIncrement;
                }
                else if (e.deltaY < 0) {
                    panX = scrollIncrement;
                }
            }
            else {
                if (e.deltaY > 0) {
                    panY = -scrollIncrement;
                }
                else if (e.deltaY < 0) {
                    panY = scrollIncrement;
                }
                if (e.deltaX > 0) {
                    panX = -scrollIncrement;
                }
                else if (e.deltaX < 0) {
                    panX = scrollIncrement;
                }
            }

            const newTranslation = this.translation.add(new Vector2D(panX, panY));

            // Snap the translation to the nearest scroll increment on each (adjusted) axis
            const snapX = panX ? Math.round(newTranslation.x / scrollIncrement) * scrollIncrement : newTranslation.x;
            const snapY = panY ? Math.round(newTranslation.y / scrollIncrement) * scrollIncrement : newTranslation.y;

            const snappedTranslation = new Vector2D(snapX, snapY);
            this.setTranslation(snappedTranslation);

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

    public static setTranslation(translation: Vector2D): void {
        this.translation = translation;
        this.updateTransform();
    }

}
