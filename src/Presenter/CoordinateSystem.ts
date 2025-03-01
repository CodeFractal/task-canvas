import { Rectangle, Vector2D } from "../Abstract/Math";
import { CustomPanZoom } from "./CustomPanZoom";

/** Represents a point on the screen */
export class ScreenCoords {
    constructor(
        public readonly vec: Vector2D
    ) { }

    public static new(x: number, y: number): ScreenCoords {
        return new ScreenCoords(new Vector2D(x, y));
    }

    /** Creates a ScreenCoords object from a MouseEvent
     * @param event The MouseEvent to get the coordinates from
     * @returns A ScreenCoords object representing the coordinates of the MouseEvent
    */
    public static fromEvent(event: MouseEvent): ScreenCoords {
        return ScreenCoords.new(event.clientX, event.clientY);
    }

    public static readonly zero = new ScreenCoords(Vector2D.zero);

    public get x(): number { return this.vec.x; }
    public get y(): number { return this.vec.y; }

    /** Adds a SizeOnScreen object to this ScreenCoords object
     * @param other The SizeOnScreen object to add
     * @returns A ScreenCoords object representing the sum of the two objects
     */
    public add(other: SizeOnScreen): ScreenCoords {
        return new ScreenCoords(this.vec.add(other.vec));
    }

    /** Subtracts a SizeOnScreen object from this ScreenCoords object
     * @param other The SizeOnScreen object to subtract
     * @returns A ScreenCoords object representing the difference between the two objects
     */
    public sub(other: SizeOnScreen): ScreenCoords {
        return new ScreenCoords(this.vec.sub(other.vec));
    }

    /** Subtracts another ScreenCoords object from this one
     * @param other The other ScreenCoords object to subtract
     * @returns A SizeOnScreen object representing the difference between the two ScreenCoords objects
     */
    public subtractCoords(other: ScreenCoords): SizeOnScreen {
        return new SizeOnScreen(this.vec.sub(other.vec));
    }

    /** Converts the screen coordinates to canvas coordinates */
    public toCanvasCoords(): CanvasCoords {
        const scale = CustomPanZoom.getScale ? CustomPanZoom.getScale() : 1;
        const translateX = CustomPanZoom.getTranslateX ? CustomPanZoom.getTranslateX() : 0;
        const translateY = CustomPanZoom.getTranslateY ? CustomPanZoom.getTranslateY() : 0;
        return CanvasCoords.new(
          (this.x - translateX) / scale,
          (this.y - translateY) / scale,
        );
    }
}

/** Represents a size on the screen */
export class SizeOnScreen {
    constructor(
        public readonly vec: Vector2D
    ) { }

    public static new(width: number, height: number): SizeOnScreen {
        return new SizeOnScreen(new Vector2D(width, height));
    }

    public get width(): number { return this.vec.x; }
    public get height(): number { return this.vec.y; }

    /** Adds another SizeOnScreen object to this one
     * @param other The other SizeOnScreen object to add
     * @returns A SizeOnScreen object representing the sum of the two objects
     */
    public add(other: SizeOnScreen): SizeOnScreen {
        return new SizeOnScreen(this.vec.add(other.vec));
    }

    /** Subtracts another SizeOnScreen object from this one
     * @param other The other SizeOnScreen object to subtract
     * @returns A SizeOnScreen object representing the difference between the two objects
     */
    public sub(other: SizeOnScreen): SizeOnScreen {
        return new SizeOnScreen(this.vec.sub(other.vec));
    }

    /** Converts the size on the screen to size on canvas */
    public toCanvasSize(): SizeOnCanvas {
        const scale = CustomPanZoom.getScale ? CustomPanZoom.getScale() : 1;
        return new SizeOnCanvas(this.vec.div(scale));
    }
}

/** Represents a rectangle on the screen */
export class ScreenRect {
    public readonly rect: Rectangle;

    public constructor(
        public readonly position: ScreenCoords,
        public readonly size: SizeOnScreen,
        rect?: Rectangle
    ) {
        this.rect = rect ?? new Rectangle(position.vec, size.vec);
    }

    /** Creates a ScreenRect object from the bounds of a provided Element
     * @param element The element to get the bounds from
     * @returns A ScreenRect object representing the bounds of the element
    */
    public static fromElementBounds(element: Element): ScreenRect {
        const bounds = element.getBoundingClientRect();
        return new ScreenRect(ScreenCoords.new(bounds.left, bounds.top), SizeOnScreen.new(bounds.width, bounds.height));
    }

    /** Creates a ScreenRect object from two ScreenCoords
     * @param p1 The first ScreenCoords
     * @param p2 The second ScreenCoords
     * @returns A ScreenRect object representing the rectangle created by the two points
     */
    public static fromPoints(p1: ScreenCoords, p2: ScreenCoords): ScreenRect {
        return new ScreenRect(ScreenCoords.new(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y)), SizeOnScreen.new(Math.abs(p1.x - p2.x), Math.abs(p1.y - p2.y)));
    }

    /** Converts the screen rectangle to a canvas rectangle */
    public toCanvasRect(): CanvasRect {
        return new CanvasRect(this.position.toCanvasCoords(), this.size.toCanvasSize());
    }

    /** Checks if the rectangle contains a point
     * @param point The point to check
     * @returns Whether the rectangle contains the point
    */
    public contains(point: ScreenCoords): boolean {
        return this.rect.contains(point.vec);
    }

    /** Checks if the rectangle intersects another rectangle
     * @param other The other rectangle to check
     * @returns Whether the rectangles intersect
    */
    public intersects(other: ScreenRect): boolean {
        return this.rect.intersects(other.rect);
    }

}

/** Represents a point on the canvas */
export class CanvasCoords {
    constructor(
        public readonly vec: Vector2D
    ) { }

    public static new(x: number, y: number): CanvasCoords {
        return new CanvasCoords(new Vector2D(x, y));
    }

    public static readonly zero = new CanvasCoords(Vector2D.zero);

    public get x(): number { return this.vec.x; }
    public get y(): number { return this.vec.y; }

    /** Adds a SizeOnCanvas object to this CanvasCoords object
     * @param other The SizeOnCanvas object to add
     * @returns A CanvasCoords object representing the sum of the two objects
     */
    public add(other: SizeOnCanvas): CanvasCoords {
        return new CanvasCoords(this.vec.add(other.vec));
    }

    /** Subtracts a SizeOnCanvas object from this CanvasCoords object
     * @param other The SizeOnCanvas object to subtract
     * @returns A CanvasCoords object representing the difference between the two objects
     */
    public sub(other: SizeOnCanvas): CanvasCoords {
        return new CanvasCoords(this.vec.sub(other.vec));
    }

    /** Subtracts another CanvasCoords object from this one
     * @param other The other CanvasCoords object to subtract
     * @returns A SizeOnCanvas object representing the difference between the two CanvasCoords objects
     */
    public subtractCoords(other: CanvasCoords): SizeOnCanvas {
        return new SizeOnCanvas(this.vec.sub(other.vec));
    }

    /** Converts the canvas coordinates to screen coordinates */
    public toScreenCoords(): ScreenCoords {
        const scale = CustomPanZoom.getScale ? CustomPanZoom.getScale() : 1;
        const translateX = CustomPanZoom.getTranslateX ? CustomPanZoom.getTranslateX() : 0;
        const translateY = CustomPanZoom.getTranslateY ? CustomPanZoom.getTranslateY() : 0;
        return ScreenCoords.new(
          this.x * scale + translateX,
          this.y * scale + translateY,
        );
    }
}

/** Represents a size on the canvas */
export class SizeOnCanvas {
    constructor(
        public readonly vec: Vector2D
    ) { }

    public static new(width: number, height: number): SizeOnCanvas {
        return new SizeOnCanvas(new Vector2D(width, height));
    }

    public get width(): number { return this.vec.x; }
    public get height(): number { return this.vec.y; }

    /** Adds another SizeOnCanvas object to this one
     * @param other The other SizeOnCanvas object to add
     * @returns A SizeOnCanvas object representing the sum of the two objects
     */
    public add(other: SizeOnCanvas): SizeOnCanvas {
        return new SizeOnCanvas(this.vec.add(other.vec));
    }

    /** Subtracts another SizeOnCanvas object from this one
     * @param other The other SizeOnCanvas object to subtract
     * @returns A SizeOnCanvas object representing the difference between the two objects
     */
    public sub(other: SizeOnCanvas): SizeOnCanvas {
        return new SizeOnCanvas(this.vec.sub(other.vec));
    }

    /** Converts the size on the canvas to size on screen */
    public toScreenSize(): SizeOnScreen {
        const scale = CustomPanZoom.getScale ? CustomPanZoom.getScale() : 1;
        return new SizeOnScreen(this.vec.mul(scale));
    }
}

/** Represents a rectangle on the canvas */
export class CanvasRect {
    public readonly rect: Rectangle;
    constructor(
        public readonly position: CanvasCoords,
        public readonly size: SizeOnCanvas,
        rect?: Rectangle
    ) {
        this.rect = rect ?? new Rectangle(position.vec, size.vec);
    }

    /** Creates a CanvasRect object from two CanvasCoords
     * @param p1 The first CanvasCoords
     * @param p2 The second CanvasCoords
     * @returns A CanvasRect object representing the rectangle created by the two points
     */
    public static fromPoints(p1: CanvasCoords, p2: CanvasCoords): CanvasRect {
        return new CanvasRect(CanvasCoords.new(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y)), SizeOnCanvas.new(Math.abs(p1.x - p2.x), Math.abs(p1.y - p2.y)));
    }

    /** Converts the canvas rectangle to a screen rectangle */
    public toScreenRect(): ScreenRect {
        return new ScreenRect(this.position.toScreenCoords(), this.size.toScreenSize());
    }

    /** Checks if the rectangle contains a point
     * @param point The point to check
     * @returns Whether the rectangle contains the point
    */
    public contains(point: CanvasCoords): boolean {
        return this.rect.contains(point.vec);
    }

    /** Checks if the rectangle intersects another rectangle
     * @param other The other rectangle to check
     * @returns Whether the rectangles intersect
    */
    public intersects(other: CanvasRect): boolean {
        return this.rect.intersects(other.rect);
    }
}