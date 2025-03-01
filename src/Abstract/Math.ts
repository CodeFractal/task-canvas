export class Vector2D {
    constructor(
        public readonly x: number,
        public readonly y: number) {
    }

    public static readonly zero = new Vector2D(0, 0);
    public static readonly identity = new Vector2D(1, 1);
    public static readonly up = new Vector2D(0, -1);
    public static readonly down = new Vector2D(0, 1);
    public static readonly left = new Vector2D(-1, 0);
    public static readonly right = new Vector2D(1, 0);

    public lenSqr(): number {
        return this.x * this.x + this.y * this.y;
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

    public translate(x: number, y: number): Vector2D {
        return new Vector2D(this.x + x, this.y + y);
    }

    public negate(): Vector2D {
        return new Vector2D(-this.x, -this.y);
    }

    public normalize(): Vector2D {
        const lenSqr = this.lenSqr();
        if (lenSqr === 0) return Vector2D.zero;
        
        const invLen = 1 / Math.sqrt(lenSqr);
        return new Vector2D(this.x * invLen, this.y * invLen);
    }

    public dot(other: Vector2D): number {
        return this.x * other.x + this.y * other.y;
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
    public static fromPoints(p1: Vector2D, p2: Vector2D): Rectangle {
        return new Rectangle(new Vector2D(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y)), new Vector2D(Math.abs(p1.x - p2.x), Math.abs(p1.y - p2.y)));
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