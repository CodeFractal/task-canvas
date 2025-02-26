export class Vector2D {
    constructor(
        public readonly x: number,
        public readonly y: number) {
    }

    public add(other: Vector2D): Vector2D {
        return new Vector2D(this.x + other.x, this.y + other.y);
    }

    public sub(other: Vector2D): Vector2D {
        return new Vector2D(this.x - other.x, this.y - other.y);
    }

    public mul(scalar: number): Vector2D {
        return new Vector2D(this.x * scalar, this.y * scalar);
    }

    public div(scalar: number): Vector2D {
        return new Vector2D(this.x / scalar, this.y / scalar);
    }
}

export class Rectangle {
    constructor(
        public readonly position: Vector2D,
        public readonly size: Vector2D) {
    }
    public static fromBounds(bounds: {top: number, right: number, bottom: number, left: number}): Rectangle {
        return new Rectangle(new Vector2D(bounds.left, bounds.top), new Vector2D(bounds.right - bounds.left, bounds.bottom - bounds.top));
    }

    public get left(): number {
        return this.position.x;
    }

    public get right(): number {
        return this.position.x + this.size.x;
    }

    public get top(): number {
        return this.position.y;
    }

    public get bottom(): number {
        return this.position.y + this.size.y;
    }

    public get width(): number {
        return this.size.x;
    }

    public get height(): number {
        return this.size.y;
    }

    public contains(point: Vector2D): boolean {
        return point.x >= this.left && point.x <= this.right && point.y >= this.top && point.y <= this.bottom;
    }

    public intersects(other: Rectangle): boolean {
        return this.left < other.right && this.right > other.left && this.top < other.bottom && this.bottom > other.top;
    }
}