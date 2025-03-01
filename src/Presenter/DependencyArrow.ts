/** 
 * The DependencyArrow module provides a way to create and manage 
 * SVG-based arrows between two points or DOM elements, respecting 
 * a grid-based routing system and optional zoom factor.
 * 
 * @module DependencyArrow
 */

import { Rectangle, Vector2D } from "../Abstract/Math";

/**
 * Represents the options available when creating an arrow.
 */
interface ArrowOptions {
    /** The stroke/fill color of the arrow. */
    color?: string;
    /** The grid size used for routing calculations. */
    gridSize?: number;
    /** Whether to skip creating an undo action (not used here but available for external usage). */
    skipUndo?: boolean;
    /** The data-id attribute value for the arrow (not used here but available for external usage). */
    dataId?: string;
}

/**
 * Represents the methods available on an arrow handler.
 */
export interface ArrowHandler {
    /** The SVG element containing the arrow path. */
    svg: SVGSVGElement;
    /**
     * Update the arrow with new start and end points or elements.
     * 
     * This re-routes and redraws the arrow based on the newly provided endpoints, 
     * recalculating the bounding box and the path data. If the start or end 
     * is inside the other element's bounding box, the arrow is considered invalid 
     * and is hidden (display = 'none').
     * 
     * @param newStart The new start point or HTML element.
     * @param newEnd The new end point or HTML element.
     * @param options Additional options (particularly the updated zoom factor).
     */
    update: (newStart: Vector2D | Rectangle, newEnd: Vector2D | Rectangle) => void;
    /**
     * Remove the arrow from the DOM.
     */
    remove: () => void;
    /**
     * Attach an event listener to the arrow's path element.
     * 
     * @param type The event type to listen for, e.g. 'click'.
     * @param listener The event handler callback.
     * @param options Optional addEventListener options.
     */
    addEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ) => void;
    /**
     * Set the stroke/fill color of the arrow and its tip.
     * 
     * @param newColor The new color value.
     */
    setColor: (newColor: string) => void;
}

export const DependencyArrow = (function () {
    let arrowCounter = 0;
    const DEFAULT_GRID_SIZE = 20;
    const DEFAULT_MARGIN = 10;
    const FIXED_RADIUS = 10; // desired rounding radius for arrow corners
    const ARROW_THICKNESS = 2;

    /**
     * Resolve an endpoint given its "role" ('start' or 'end').
     * 
     * If the endpoint is an HTMLElement:
     *  - role 'start': return the element's right edge with a 20px vertical offset
     *  - role 'end': return the element's left edge with a 20px vertical offset
     * 
     * Otherwise, treat the input as a Point, dividing coordinates by the zoom factor.
     * 
     * @param input The endpoint which can be an HTMLElement or a Point-like object.
     * @param role The role of the endpoint, either 'start' or 'end'.
     * @returns A resolved Point in the parent's coordinate system.
     */
    function resolveEndpoint(
        input: Vector2D | Rectangle,
        role: 'start' | 'end'
    ): Vector2D {
        if (input instanceof Rectangle) {
            return role === "start"
                ? input.position.translate(input.size.x, 20)
                : input.position.translate(0, 20);
        }
        else {
            return input;
        }
    }

    /**
     * Compute the x-coordinate of the vertical line connecting two points.
     * The vertical line is computed by finding the midpoint of the two points,
     * and then rounding it to the nearest grid line.
     * @param sx The x-coordinate of the start point.
     * @param ex The x-coordinate of the end point.
     * @param gridSize The grid size.
     * @returns The x-coordinate of the vertical line.
     */
    function computeVerticalX(sx: number, ex: number, gridSize: number): number {
        const mid = (sx + ex) / 2;
        return Math.round(mid / gridSize) * gridSize;
    }

    /**
     * Compute the polyline route from {@link S} to {@link E}.
     * 
     * **Normal case** (when S.x <= E.x and there is at least 10px clearance on each side):
     * 
     * The route leaves S horizontally and approaches E horizontally.
     *  
     * **Backtracking case** (when the clearance rule would be broken, S.x > E.x, or
     * when the normal route would produce degenerate horizontal segments):
     * 
     * A 5‑segment route is built:
     * 1. Horizontal right from S (at least 10px, snapped to grid)
     * 2. Vertical from S.y to the computed midpoint.
     * 3. Horizontal left at that midpoint.
     * 4. Vertical from the midpoint to E.y.
     * 5. Horizontal right into E (with at least 10px clearance).
     * 
     * For computing the vertical midpoint:
     *   - If the start is an HTMLElement, use its bottom edge.
     *   - If the end is an HTMLElement, use its top edge.
     *   - Otherwise, use the provided coordinate values.
     * 
     * @param S The start point (in parent coordinates).
     * @param E The end point (in parent coordinates).
     * @param gridSize The grid size for snapping coordinates.
     * @param startElem The start element or coordinate input.
     * @param endElem The end element or coordinate input.
     * @returns An array of points describing the route, or undefined if the route can't be computed.
     */
    function computeRoute(
        S: Vector2D,
        E: Vector2D,
        gridSize: number,
        startElem: Vector2D | Rectangle,
        endElem: Vector2D | Rectangle
    ): Vector2D[] | undefined {
        const minHorizontal = 10;
        let route: Vector2D[] | undefined;

        // Normal route
        if (S.x <= E.x && (E.x - S.x >= 2 * minHorizontal)) {
            const adjustedStartX = S.x + minHorizontal;
            const adjustedEndX = E.x - minHorizontal;
            const X_start = Math.ceil(adjustedStartX / gridSize) * gridSize;
            const X_end = Math.floor(adjustedEndX / gridSize) * gridSize;

            if (X_start < X_end) {
                const X_mid = computeVerticalX(X_start, X_end, gridSize);
                route = [
                    S,
                    new Vector2D(X_start, S.y),
                    new Vector2D(X_mid, S.y),
                    new Vector2D(X_mid, E.y),
                    new Vector2D(X_end, E.y),
                    E,
                ];
            } else if (X_start === X_end) {
                route = [
                    S,
                    new Vector2D(X_start, S.y),
                    new Vector2D(X_start, E.y),
                    E
                ];
            }
        }

        // Fallback to backtracking route
        if (!route) {
            const X1 = Math.ceil((S.x + minHorizontal) / gridSize) * gridSize;
            const X_final = Math.floor((E.x - minHorizontal) / gridSize) * gridSize;
            const effectiveStartY =
                startElem instanceof Rectangle
                    ? startElem.bottom
                    : S.y;
            const effectiveEndY =
                endElem instanceof Rectangle
                    ? endElem.top
                    : E.y;
            const Y_mid = Math.round(((effectiveStartY + effectiveEndY) / 2) / gridSize) * gridSize;

            route = [
                S,
                new Vector2D(X1, S.y),
                new Vector2D(X1, Y_mid),
                new Vector2D(X_final, Y_mid),
                new Vector2D(X_final, E.y),
                E,
            ];
        }

        // Shift the last point by the stroke width to avoid overlap with the target element
        if (route.length > 0) {
            const last = route[route.length - 1];
            if (last.x === E.x) {
                route[route.length - 1] = last.translate(-ARROW_THICKNESS, 0);
            }
        }
        return route;
    }

    /**
     * Compute a bounding box (with margin) for the given list of points.
     * 
     * @param points The points for which to compute the bounding box.
     * @param margin The margin to expand around the min/max coordinates.
     * @returns The bounding box with left, top, width, and height properties.
     */
    function computeBoundingBox(points: Vector2D[], margin: number): Rectangle {
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        return new Rectangle(
            new Vector2D(minX - margin, minY - margin),
            new Vector2D((maxX - minX) + 2 * margin, (maxY - minY) + 2 * margin)
        );
    }

    /**
     * Remove consecutive duplicate points from an array of points.
     * 
     * @param points The array of points.
     * @returns A new array with duplicates removed.
     */
    function removeDuplicatePoints(points: Vector2D[]): Vector2D[] {
        if (!points.length) return points;
        const newPoints: Vector2D[] = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const last = newPoints[newPoints.length - 1];
            if (points[i].x !== last.x || points[i].y !== last.y) {
                newPoints.push(points[i]);
            }
        }
        return newPoints;
    }

    /**
     * Create a rounded SVG path definition string from an array of points.
     * Each corner is rounded using a fixed radius, clamped by the length of the segments.
     * 
     * @param points The array of points (in local SVG coordinates).
     * @param radius The desired corner radius.
     * @returns A string usable as the 'd' attribute of an SVG path.
     */
    function createRoundedPath(points: Vector2D[], radius: number): string {
        // Remove consecutive duplicate points.
        points = removeDuplicatePoints(points);

        if (points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
        if (points.length === 2) {
            return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
        }

        let d = `M ${points[0].x},${points[0].y}`;
        let prevPoint = points[0];

        // This interface helps hold corner rounding information.
        interface Arc {
            arc: boolean;
            center: Vector2D;
            from: Vector2D;
            to: Vector2D;
            r: number;
            u1: Vector2D;
            u2: Vector2D;
            theta: number;
        }

        const roundedPoints: (Vector2D | Arc)[] = [points[0]];

        // Build a set of points & arcs that represent the path with rounded corners.
        for (let i = 1; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];

            // Vectors for incoming and outgoing segments.
            const v1 = current.sub(prevPoint);
            const v2 = next.sub(current);

            // If segments are collinear, no rounding is needed.
            if ((v1.x === 0 && v2.x === 0) || (v1.y === 0 && v2.y === 0)) {
                roundedPoints.push(current);
                prevPoint = current;
                continue;
            }

            // Normalize the directions.
            const u1 = v1.normalize();
            const u2 = v2.normalize();

            // Dot product to find angle at the corner.
            const inDir = u1.negate(); // direction coming into the corner
            const dot = inDir.dot(u2);
            const clampedDot = Math.min(1, Math.max(-1, dot));
            const theta = Math.acos(clampedDot);
            if (theta === 0) {
                roundedPoints.push(current);
                prevPoint = current;
                continue;
            }

            // Ideal offset along each segment to produce the desired radius.
            const d_required = radius / Math.tan(theta / 2);
            // Clamp the offset to the available segment lengths.
            const len1 = Math.sqrt(v1.lenSqr());
            const len2 = Math.sqrt(v2.lenSqr());
            const d_eff = Math.min(d_required, len1, len2);
            const r_eff = d_eff * Math.tan(theta / 2);

            // Compute the tangent points around this corner.
            const pEntry = current.sub(u1.mul(d_eff));
            const pExit = current.add(u2.mul(d_eff));

            // Push the entry tangent, the arc info, and the exit tangent.
            roundedPoints.push(pEntry);
            roundedPoints.push({
                arc: true,
                center: current,
                from: pEntry,
                to: pExit,
                r: r_eff,
                u1,
                u2,
                theta
            } as Arc);
            roundedPoints.push(pExit);

            prevPoint = pExit;
        }

        // Add the last point.
        roundedPoints.push(points[points.length - 1]);

        // Now construct the SVG path string from our line/arc descriptors.
        const firstPoint = roundedPoints[0] as Vector2D;
        d = `M ${firstPoint.x},${firstPoint.y}`;
        for (let i = 1; i < roundedPoints.length; i++) {
            const ptOrArc = roundedPoints[i];

            // If we encounter an Arc placeholder, skip it here—draw arcs in a combined step below.
            if ((ptOrArc as Arc).arc) {
                continue;
            }

            const pt = ptOrArc as Vector2D;

            // If the next chunk is an arc, then line up to the arc start and build the arc command.
            if (i < roundedPoints.length - 1 && (roundedPoints[i + 1] as Arc).arc) {
                d += ` L ${pt.x},${pt.y}`;
                const arcInfo = roundedPoints[i + 1] as Arc;
                // Cross product sign determines arc direction.
                const cross = arcInfo.u1.x * arcInfo.u2.y - arcInfo.u1.y * arcInfo.u2.x;
                const sweepFlag = cross < 0 ? 0 : 1;
                d += ` A ${arcInfo.r},${arcInfo.r} 0 0,${sweepFlag} ${arcInfo.to.x},${arcInfo.to.y}`;
                i += 2; // Skip the arc placeholders.
            }
            else {
                d += ` L ${pt.x},${pt.y}`;
            }
        }
        return d;
    }

    return {
        /**
         * Create a new arrow. The arrow is represented as an SVG element 
         * that is absolutely positioned within the parent, containing a 
         * path with a custom marker to render the arrowhead.
         * 
         * @param parent The parent HTMLElement in which the arrow is drawn.
         * @param start The start endpoint (HTMLElement or Point-like object).
         * @param end The end endpoint (HTMLElement or Point-like object).
         * @param options Additional configuration options.
         * @returns An ArrowHandler object with methods to manage the arrow.
         */
        createArrow: function (
            parent: HTMLElement,
            start: Vector2D | Rectangle,
            end: Vector2D | Rectangle,
            options: ArrowOptions = {}
        ): ArrowHandler {
            options = options || {};
            const gridSize = options.gridSize || DEFAULT_GRID_SIZE;
            const margin = DEFAULT_MARGIN;
            arrowCounter++;

            // The XML namespace for SVG
            const svgNS = 'http://www.w3.org/2000/svg';

            // Resolve endpoints (convert from HTML elements or raw points to normalized Points).
            let S = resolveEndpoint(start, 'start');
            let E = resolveEndpoint(end, 'end');

            // Check for "invalid" conditions: if one endpoint lies inside the other's element.
            let invalid = false;
            if (start instanceof Rectangle) {
                if (start.contains(E)) {
                    invalid = true;
                }
            }
            if (end instanceof Rectangle) {
                if (end.contains(S)) {
                    invalid = true;
                }
            }

            // Compute the route the arrow will take. 
            // If none is possible, we'll mark the arrow invalid and hide it.
            const routePoints = computeRoute(S, E, gridSize, start, end);
            if (!routePoints) {
                invalid = true;
            }

            // Calculate a bounding box around the route (plus margin).
            const bbox = computeBoundingBox(routePoints || [S, E], margin);

            // Create the SVG container for this arrow, absolutely positioned in the parent.
            const svg = document.createElementNS(svgNS, 'svg');
            svg.style.position = 'absolute';
            svg.style.left = bbox.left + 'px';
            svg.style.top = bbox.top + 'px';
            svg.style.width = bbox.width + 'px';
            svg.style.height = bbox.height + 'px';
            svg.style.overflow = 'visible';
            svg.style.pointerEvents = 'none';
            svg.dataset.role = 'dependency-arrow';
            parent.appendChild(svg);

            // Set the data-id attribute if provided.
            if (options.dataId) {
                svg.dataset.id = options.dataId;
            }

            // Create a unique marker element (arrowhead) for this arrow instance.
            const markerId = 'arrowhead-' + arrowCounter;
            const defs = document.createElementNS(svgNS, 'defs');
            const marker = document.createElementNS(svgNS, 'marker');
            marker.setAttribute('id', markerId);
            marker.setAttribute('markerWidth', '6');
            marker.setAttribute('markerHeight', '6');
            marker.setAttribute('refX', '5');
            marker.setAttribute('refY', '3');
            marker.setAttribute('orient', 'auto');
            marker.setAttribute('viewBox', '0 0 6 6');
            const markerPath = document.createElementNS(svgNS, 'path');
            markerPath.setAttribute('d', 'M0,0 L6,3 L0,6 L1.5,3 z');
            markerPath.setAttribute('fill', options.color || 'white');
            markerPath.style.pointerEvents = 'visiblePainted'; 
            marker.appendChild(markerPath);
            defs.appendChild(marker);
            svg.appendChild(defs);

            // Convert the route points from global parent coords to the local SVG coordinate system.
            let localPoints: Vector2D[];
            if (routePoints) {
                localPoints = routePoints.map(p => p.sub(bbox.position));
            } else {
                localPoints = [
                    S.sub(bbox.position),
                    E.sub(bbox.position)
                ];
            }

            // Construct the path string with rounded corners.
            const d = createRoundedPath(localPoints, FIXED_RADIUS);
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', options.color || 'white');
            path.setAttribute('stroke-width', ARROW_THICKNESS.toString());
            path.setAttribute('marker-end', `url(#${markerId})`);
            path.style.pointerEvents = 'visiblePainted';

            // If the arrow was invalid, hide it initially.
            if (invalid) {
                path.style.display = 'none';
            }

            svg.appendChild(path);

            // Return an object that lets consumers manage this arrow.
            const handler: ArrowHandler = {
                svg: svg,

                /**
                 * Update the arrow to new start and end coordinates or elements. 
                 * This re-routes and repositions the arrow, possibly hiding it 
                 * if it becomes invalid (e.g. an endpoint falls within the other's element).
                 * 
                 * @param newStart The new start point or HTML element.
                 * @param newEnd The new end point or HTML element.
                 */
                update: function (newStart: Vector2D | Rectangle, newEnd: Vector2D | Rectangle) {
                    const S_new = resolveEndpoint(newStart, 'start');
                    const E_new = resolveEndpoint(newEnd, 'end');

                    let nowInvalid = false;
                    if (newStart instanceof Rectangle) {
                        if (newStart.contains(E_new)) {
                            nowInvalid = true;
                        }
                    }
                    if (newEnd instanceof Rectangle) {
                        if (newEnd.contains(S_new)) {
                            nowInvalid = true;
                        }
                    }

                    const newRoute = computeRoute(
                        S_new,
                        E_new,
                        gridSize,
                        newStart,
                        newEnd
                    );
                    if (!newRoute) nowInvalid = true;

                    // Recompute the bounding box for the new route.
                    const newBbox = computeBoundingBox(newRoute || [S_new, E_new], margin);
                    svg.style.left = newBbox.left + 'px';
                    svg.style.top = newBbox.top + 'px';
                    svg.style.width = newBbox.width + 'px';
                    svg.style.height = newBbox.height + 'px';

                    // Adjust the path coordinates to the new local origin (the top-left of newBbox).
                    const newLocalPoints = newRoute
                        ? newRoute.map(p => p.sub(newBbox.position))
                        : [
                            S_new.sub(newBbox.position),
                            E_new.sub(newBbox.position),
                        ];

                    // Rebuild the path data and toggle visibility based on validity.
                    const newD = createRoundedPath(newLocalPoints, FIXED_RADIUS);
                    path.setAttribute('d', newD);
                    path.style.display = nowInvalid ? 'none' : 'block';
                },

                /**
                 * Remove the arrow's SVG from the DOM.
                 */
                remove: function () {
                    if (svg.parentNode) {
                        svg.parentNode.removeChild(svg);
                    }
                },

                /**
                 * Attach an event listener to the arrow's path element.
                 * For example, `arrow.addEventListener('click', (evt) => ...)`.
                 * 
                 * @param type The event type (e.g., 'click').
                 * @param listener The listener callback.
                 * @param options Optional event listener options.
                 */
                addEventListener: function (
                    type: string,
                    listener: EventListenerOrEventListenerObject,
                    options?: boolean | AddEventListenerOptions
                ) {
                    path.addEventListener(type, listener, options);
                },

                /**
                 * Update the arrow's stroke and arrowhead color.
                 * 
                 * @param newColor The new color for the arrow stroke and tip.
                 */
                setColor: function (newColor: string) {
                    path.setAttribute('stroke', newColor);
                    markerPath.setAttribute('fill', newColor);
                },
            };

            // Return the arrow handler to the caller.
            return handler;
        },
    };
})();
