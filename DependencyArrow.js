(function () {
    let arrowCounter = 0;
    const DEFAULT_GRID_SIZE = 20;
    const DEFAULT_MARGIN = 10;
    const FIXED_RADIUS = 10; // desired rounding radius

    // Resolve an endpoint given its "role" ('start' or 'end').
    // For an HTMLElement input:
    // - role 'start': return the element’s right edge (in parent's coordinate space)
    //   with a vertical offset of 20px.
    // - role 'end': return the element’s left edge with a 20px vertical offset.
    // Otherwise, assume input is a coordinate object.
    function resolveEndpoint(input, role, parent) {
        if (input instanceof HTMLElement) {
            const parentRect = parent.getBoundingClientRect();
            const rect = input.getBoundingClientRect();
            const bounds = {
                left: rect.left - parentRect.left,
                top: rect.top - parentRect.top,
                right: rect.right - parentRect.left,
                bottom: rect.bottom - parentRect.top
            };
            if (role === 'start') {
                return { x: bounds.right, y: bounds.top + 20 };
            } else if (role === 'end') {
                return { x: bounds.left, y: bounds.top + 20 };
            } else {
                throw new Error("Unknown role: " + role);
            }
        } else {
            return input;
        }
    }

    // Compute a grid-based vertical segment x coordinate.
    function computeVerticalX(sx, ex, gridSize) {
        const mid = (sx + ex) / 2;
        return Math.round(mid / gridSize) * gridSize;
    }

    // Helper: Get element bounds relative to the parent.
    function getElementBounds(element, parent) {
        const parentRect = parent.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top - parentRect.top,
            bottom: rect.bottom - parentRect.top,
            left: rect.left - parentRect.left,
            right: rect.right - parentRect.left
        };
    }

    // Compute the polyline route from S to E.
    // Normal case (when S.x <= E.x and there is at least 10px clearance on each side):
    //   The route leaves S horizontally and approaches E horizontally.
    // Backtracking case (when the clearance rule would be broken, S.x > E.x, or
    //   when the normal route would produce degenerate horizontal segments):
    //   A 5‑segment route is built:
    //     1. Horizontal right from S (at least 10px, snapped to grid)
    //     2. Vertical from S.y to the computed midpoint.
    //     3. Horizontal left at that midpoint.
    //     4. Vertical from the midpoint to E.y.
    //     5. Horizontal right into E (with at least 10px clearance).
    // For computing the vertical midpoint:
    //   - If the start is an HTMLElement, use its bottom edge.
    //   - If the end is an HTMLElement, use its top edge.
    //   - Otherwise, use the provided coordinate values.
    function computeRoute(S, E, gridSize, startElem, endElem, parent) {
        const minHorizontal = 10;
        let route;
        if (S.x <= E.x && (E.x - S.x >= 2 * minHorizontal)) {
            const adjustedStartX = S.x + minHorizontal;
            const adjustedEndX = E.x - minHorizontal;
            let X_start = Math.ceil(adjustedStartX / gridSize) * gridSize;
            let X_end = Math.floor(adjustedEndX / gridSize) * gridSize;
            if (X_start < X_end) {
                let X_mid = computeVerticalX(X_start, X_end, gridSize);
                route = [
                    S,
                    { x: X_start, y: S.y },
                    { x: X_mid, y: S.y },
                    { x: X_mid, y: E.y },
                    { x: X_end, y: E.y },
                    E
                ];
            } else if (X_start === X_end) {
                route = [
                    S,
                    { x: X_start, y: S.y },
                    { x: X_start, y: E.y },
                    E
                ];
            }
        }
        if (!route) { // Fallback to backtracking route.
            let X1 = Math.ceil((S.x + minHorizontal) / gridSize) * gridSize;
            let X_final = Math.floor((E.x - minHorizontal) / gridSize) * gridSize;
            let effectiveStartY = (startElem instanceof HTMLElement)
                ? getElementBounds(startElem, parent).bottom
                : S.y;
            let effectiveEndY = (endElem instanceof HTMLElement)
                ? getElementBounds(endElem, parent).top
                : E.y;
            let Y_mid = Math.round(((effectiveStartY + effectiveEndY) / 2) / gridSize) * gridSize;
            route = [
                S,
                { x: X1, y: S.y },
                { x: X1, y: Y_mid },
                { x: X_final, y: Y_mid },
                { x: X_final, y: E.y },
                E
            ];
        }
        return route;
    }

    // Compute a minimal bounding box (with margin) for an array of points.
    function computeBoundingBox(points, margin) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        return {
            left: minX - margin,
            top: minY - margin,
            width: (maxX - minX) + 2 * margin,
            height: (maxY - minY) + 2 * margin
        };
    }

    // Helper: Check if a coordinate lies strictly within the bounds of an element.
    // Points exactly on the boundary are considered outside.
    function isPointInsideElement(coord, element, parent) {
        const parentRect = parent.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        const bounds = {
            left: rect.left - parentRect.left,
            top: rect.top - parentRect.top,
            right: rect.right - parentRect.left,
            bottom: rect.bottom - parentRect.top
        };
        return (coord.x > bounds.left && coord.x < bounds.right &&
                coord.y > bounds.top && coord.y < bounds.bottom);
    }

    // Helper: Remove consecutive duplicate points.
    function removeDuplicatePoints(points) {
        if (!points.length) return points;
        const newPoints = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const last = newPoints[newPoints.length - 1];
            if (points[i].x !== last.x || points[i].y !== last.y) {
                newPoints.push(points[i]);
            }
        }
        return newPoints;
    }

    // Helper: Create a rounded SVG path from a series of points.
    // For each corner, this computes tangent points based on the desired fixed radius (10px)
    // using the formula d = r / tan(θ/2). If the segments are too short, the values are clamped.
    function createRoundedPath(points, radius) {
        // Remove duplicate consecutive points.
        points = removeDuplicatePoints(points);

        if (points.length === 0) return "";
        if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
        if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;

        let d = `M ${points[0].x},${points[0].y}`;
        let prevPoint = points[0];

        // We'll build a new set of points for the rounded path.
        let roundedPoints = [points[0]];

        for (let i = 1; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];

            // Vectors for incoming and outgoing segments.
            const v1 = { x: current.x - prevPoint.x, y: current.y - prevPoint.y };
            const v2 = { x: next.x - current.x, y: next.y - current.y };

            // If segments are collinear, no rounding is needed.
            if ((v1.x === 0 && v2.x === 0) || (v1.y === 0 && v2.y === 0)) {
                roundedPoints.push(current);
                prevPoint = current;
                continue;
            }

            const len1 = Math.hypot(v1.x, v1.y);
            const len2 = Math.hypot(v2.x, v2.y);

            // Normalize the incoming and outgoing directions.
            const u1 = { x: v1.x / len1, y: v1.y / len1 };
            const u2 = { x: v2.x / len2, y: v2.y / len2 };

            // For the interior angle, consider the directions pointing *into* the corner.
            const inDir = { x: -u1.x, y: -u1.y };
            const dot = inDir.x * u2.x + inDir.y * u2.y;
            const clampedDot = Math.min(1, Math.max(-1, dot));
            const theta = Math.acos(clampedDot);
            if (theta === 0) {
                roundedPoints.push(current);
                prevPoint = current;
                continue;
            }

            // Ideal distance along each segment.
            const d_required = radius / Math.tan(theta / 2);
            // Clamp to the available segment lengths.
            const d_eff = Math.min(d_required, len1, len2);
            const r_eff = d_eff * Math.tan(theta / 2);

            // Compute tangent points.
            const pEntry = {
                x: current.x - u1.x * d_eff,
                y: current.y - u1.y * d_eff
            };
            const pExit = {
                x: current.x + u2.x * d_eff,
                y: current.y + u2.y * d_eff
            };

            // Add line to the entry tangent.
            roundedPoints.push(pEntry);
            // Save the corner info for arc drawing.
            roundedPoints.push({ arc: true, center: current, from: pEntry, to: pExit, r: r_eff, u1, u2, theta });
            // Add the exit tangent as the next starting point.
            roundedPoints.push(pExit);

            prevPoint = pExit;
        }

        // Add the last point.
        roundedPoints.push(points[points.length - 1]);

        // Now build the path data.
        d = `M ${roundedPoints[0].x},${roundedPoints[0].y}`;
        for (let i = 1; i < roundedPoints.length; i++) {
            const pt = roundedPoints[i];
            if (pt.arc) {
                continue;
            }
            if (i < roundedPoints.length - 1 && roundedPoints[i + 1].arc) {
                d += ` L ${pt.x},${pt.y}`;
                const arcInfo = roundedPoints[i + 1];
                const cross = arcInfo.u1.x * arcInfo.u2.y - arcInfo.u1.y * arcInfo.u2.x;
                const sweepFlag = cross < 0 ? 0 : 1;
                d += ` A ${arcInfo.r},${arcInfo.r} 0 0,${sweepFlag} ${arcInfo.to.x},${arcInfo.to.y}`;
                i += 2;
            } else {
                d += ` L ${pt.x},${pt.y}`;
            }
        }
        return d;
    }

    // Create a dependency arrow following a grid-based route.
    // Returns a handler with update, remove, addEventListener, and setColor methods.
    // If the endpoints are "invalid" (i.e. one falls within the bounds of the other element),
    // the arrow is created but hidden (its path is not displayed).
    window.DependencyArrow = {
        createArrow: function (parent, start, end, options) {
            options = options || {};
            const gridSize = options.gridSize || DEFAULT_GRID_SIZE;
            const margin = DEFAULT_MARGIN;
            arrowCounter++;
            const svgNS = "http://www.w3.org/2000/svg";

            // Resolve endpoints.
            let S = resolveEndpoint(start, 'start', parent);
            let E = resolveEndpoint(end, 'end', parent);

            // Check for "invalid" conditions.
            let invalid = false;
            if (start instanceof HTMLElement) {
                if (isPointInsideElement(E, start, parent)) {
                    invalid = true;
                }
            }
            if (end instanceof HTMLElement) {
                if (isPointInsideElement(S, end, parent)) {
                    invalid = true;
                }
            }

            const routePoints = computeRoute(S, E, gridSize, start, end, parent);
            if (!routePoints) {
                invalid = true;
            }
            const bbox = computeBoundingBox(routePoints || [S, E], margin);

            // Create the SVG container.
            const svg = document.createElementNS(svgNS, "svg");
            svg.style.position = "absolute";
            svg.style.left = bbox.left + "px";
            svg.style.top = bbox.top + "px";
            svg.style.width = bbox.width + "px";
            svg.style.height = bbox.height + "px";
            svg.style.overflow = "visible";
            svg.style.pointerEvents = "none";
            parent.appendChild(svg);

            // Create a unique marker for the arrow tip.
            const markerId = "arrowhead-" + arrowCounter;
            const defs = document.createElementNS(svgNS, "defs");
            const marker = document.createElementNS(svgNS, "marker");
            marker.setAttribute("id", markerId);
            marker.setAttribute("markerWidth", "6");
            marker.setAttribute("markerHeight", "6");
            marker.setAttribute("refX", "6");
            marker.setAttribute("refY", "3");
            marker.setAttribute("orient", "auto");
            marker.setAttribute("viewBox", "0 0 6 6");
            const markerPath = document.createElementNS(svgNS, "path");
            markerPath.setAttribute("d", "M0,0 L6,2.5 L6,3.5 L0,6 L1.5,3 z");
            markerPath.setAttribute("fill", options.color || "white");
            markerPath.style.pointerEvents = "visiblePainted";
            marker.appendChild(markerPath);
            defs.appendChild(marker);
            svg.appendChild(defs);

            // Transform route points into SVG-local coordinates.
            let localPoints = [];
            if (routePoints) {
                localPoints = routePoints.map(p => ({ x: p.x - bbox.left, y: p.y - bbox.top }));
            } else {
                localPoints = [{ x: S.x - bbox.left, y: S.y - bbox.top },
                               { x: E.x - bbox.left, y: E.y - bbox.top }];
            }
            
            // Create a path element with rounded corners.
            const d = createRoundedPath(localPoints, FIXED_RADIUS);
            const path = document.createElementNS(svgNS, "path");
            path.setAttribute("d", d);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", options.color || "white");
            path.setAttribute("stroke-width", "2");
            path.setAttribute("marker-end", `url(#${markerId})`);
            path.style.pointerEvents = "visiblePainted";
            if (invalid) {
                path.style.display = "none";
            }
            svg.appendChild(path);

            const handler = {
                update: function (newStart, newEnd) {
                    let S_new = resolveEndpoint(newStart, 'start', parent);
                    let E_new = resolveEndpoint(newEnd, 'end', parent);
                    let nowInvalid = false;
                    if (newStart instanceof HTMLElement) {
                        if (isPointInsideElement(E_new, newStart, parent)) nowInvalid = true;
                    }
                    if (newEnd instanceof HTMLElement) {
                        if (isPointInsideElement(S_new, newEnd, parent)) nowInvalid = true;
                    }
                    const newRoute = computeRoute(S_new, E_new, gridSize, newStart, newEnd, parent);
                    if (!newRoute) nowInvalid = true;
                    const newBbox = computeBoundingBox(newRoute || [S_new, E_new], margin);
                    svg.style.left = newBbox.left + "px";
                    svg.style.top = newBbox.top + "px";
                    svg.style.width = newBbox.width + "px";
                    svg.style.height = newBbox.height + "px";
                    const newLocalPoints = newRoute
                        ? newRoute.map(p => ({ x: p.x - newBbox.left, y: p.y - newBbox.top }))
                        : [{ x: S_new.x - newBbox.left, y: S_new.y - newBbox.top },
                           { x: E_new.x - newBbox.left, y: E_new.y - newBbox.top }];
                    const newD = createRoundedPath(newLocalPoints, FIXED_RADIUS);
                    path.setAttribute("d", newD);
                    path.style.display = nowInvalid ? "none" : "block";
                },
                remove: function () {
                    if (svg.parentNode) {
                        svg.parentNode.removeChild(svg);
                    }
                },
                addEventListener: function (type, listener, options) {
                    path.addEventListener(type, listener, options);
                },
                setColor: function (newColor) {
                    path.setAttribute("stroke", newColor);
                    markerPath.setAttribute("fill", newColor);
                }
            };

            return handler;
        }
    };
})();
