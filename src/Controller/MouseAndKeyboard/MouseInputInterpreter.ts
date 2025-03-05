/**
 * The MouseInputInterpreter is a module that interprets raw mouse events into "virtual" events,
 * such as 'mousedown' (after crossing a drag threshold), 'mouseup', 'click', 'dblclick',
 * 'contextmenu', and 'mousemove'. This provides a unified way of handling mouse interactions
 * with threshold-based drag detection and debounced double-click detection.
 */
export const MouseInputInterpreter = (function () {
    /** A function reference used to propagate virtual events to an external consumer. */
    let callback: ((ve: any) => void) | null = null;

    /** Stores the last mousedown event from the left button. */
    let leftMouseDownEvent: MouseEvent | null = null;

    /** Stores the last mousedown event from the right button. */
    let rightMouseDownEvent: MouseEvent | null = null;

    /** Stores the last mousedown event from the middle button. */
    let middleMouseDownEvent: MouseEvent | null = null;

    /**
     * Stores information needed to determine whether a single click could turn into a double-click.
     * Holds the event object and a timestamp.
     */
    let lastClickData: { event: MouseEvent; time: number } | null = null;

    /**
     * Stores information needed to determine whether a single middle click could turn into a double-click.
     * Holds the event object and a timestamp.
     */
    let middleLastClickData: { event: MouseEvent; time: number } | null = null;

    /** Tracks whether a left-button drag has started after crossing the drag threshold. */
    let leftDragStarted = false;

    /** Tracks whether a right-button drag has started after crossing the drag threshold. */
    let rightDragStarted = false;

    /** Tracks whether a middle-button drag has started after crossing the drag threshold. */
    let middleDragStarted = false;

    /** Movement threshold (pixels) to interpret a mousedown as a drag rather than a click. */
    const dragThreshold = 5;

    /** Delay (ms) to detect a double-click event between two clicks. */
    const dblClickDelay = 200;

    /** A flag to ensure we only add global event listeners once. */
    let listenersAdded = false;

    /**
     * Called when a mouse button is pressed down.
     * We do not immediately emit a mousedown event for left, middle, or right buttons here.
     * Instead, we wait until the mouse has moved beyond the drag threshold (in onMouseMove).
     *
     * @param {MouseEvent} e The raw MouseEvent object.
     * @returns {void}
     */
    function onMouseDown(e: MouseEvent): void {
        if (e.button === 0) {
            // Left mouse button pressed: track the event but do not immediately emit.
            leftMouseDownEvent = e;
            leftDragStarted = false;
        } else if (e.button === 2) {
            // Right mouse button pressed: track the event but do not immediately emit.
            rightMouseDownEvent = e;
            rightDragStarted = false;
        } else if (e.button === 1) {
            // Middle mouse button pressed: track the event but do not immediately emit.
            middleMouseDownEvent = e;
            middleDragStarted = false;
        }
    }

    /**
     * Called whenever the mouse moves.
     * Always emits a 'mousemove' virtual event.
     * Checks if a drag should be started for the left, middle, or right button if they've been pressed.
     *
     * @param {MouseEvent} e The raw MouseEvent object.
     * @returns {void}
     */
    function onMouseMove(e: MouseEvent): void {
        // Always emit a virtual 'mousemove' event.
        safeCallback(createVirtualEvent('mousemove', e));

        // If left mouse is down but we've not started a drag, check distance moved.
        if (leftMouseDownEvent && !leftDragStarted) {
            const dx = e.clientX - leftMouseDownEvent.clientX;
            const dy = e.clientY - leftMouseDownEvent.clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If distance > threshold, emit a 'mousedown' to signify drag has started.
            if (distance > dragThreshold) {
                leftDragStarted = true;
                safeCallback(createVirtualEvent('mousedown', leftMouseDownEvent));
            }
        }

        // If right mouse is down but we've not started a drag, check distance moved.
        if (rightMouseDownEvent && !rightDragStarted) {
            const dx = e.clientX - rightMouseDownEvent.clientX;
            const dy = e.clientY - rightMouseDownEvent.clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If distance > threshold, emit a 'mousedown' to signify drag has started.
            if (distance > dragThreshold) {
                rightDragStarted = true;
                safeCallback(createVirtualEvent('mousedown', rightMouseDownEvent));
            }
        }

        // If middle mouse is down but we've not started a drag, check distance moved.
        if (middleMouseDownEvent && !middleDragStarted) {
            const dx = e.clientX - middleMouseDownEvent.clientX;
            const dy = e.clientY - middleMouseDownEvent.clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If distance > threshold, emit a 'mousedown' to signify drag has started.
            if (distance > dragThreshold) {
                middleDragStarted = true;
                safeCallback(createVirtualEvent('mousedown', middleMouseDownEvent));
            }
        }
    }

    /**
     * Called when a mouse button is released.
     * Depending on whether a drag was started or not, emits the appropriate event:
     * - 'mouseup' if a drag was in progress,
     * - 'click' if no drag and no double-click within the dblClickDelay timeframe,
     * - 'dblclick' if within the dblClickDelay timeframe,
     * - 'contextmenu' if right mouse button was not dragged,
     * - or a generic 'mouseup' for other buttons.
     *
     * @param {MouseEvent} e The raw MouseEvent object.
     * @returns {void}
     */
    function onMouseUp(e: MouseEvent): void {
        const now = Date.now();

        if (e.button === 0) {
            // Left button release
            if (leftDragStarted) {
                // If we already started dragging, just emit a 'mouseup'
                safeCallback(createVirtualEvent('mouseup', e));
            } else {
                // Minimal movement -> could be click or part of a double-click
                if (lastClickData && now - lastClickData.time < dblClickDelay) {
                    // If we have a recent click in memory, emit 'dblclick'
                    safeCallback(createVirtualEvent('dblclick', e));
                    lastClickData = null;
                } else {
                    // Otherwise, store this click and wait to see if another comes soon
                    lastClickData = { event: e, time: now };
                    setTimeout(() => {
                        // If double-click didn't occur within dblClickDelay, emit a single 'click'
                        if (lastClickData && Date.now() - lastClickData.time >= dblClickDelay) {
                            safeCallback(createVirtualEvent('click', e));
                            lastClickData = null;
                        }
                    }, dblClickDelay);
                }
            }
            leftMouseDownEvent = null;
            leftDragStarted = false;
        } else if (e.button === 2) {
            // Right button release
            if (rightDragStarted) {
                // If a drag was started, just emit a 'mouseup'
                safeCallback(createVirtualEvent('mouseup', e));
            } else {
                // If no drag, interpret this as a 'contextmenu'
                safeCallback(createVirtualEvent('contextmenu', e));
            }
            rightMouseDownEvent = null;
            rightDragStarted = false;
        } else if (e.button === 1) {
            // Middle button release
            if (middleDragStarted) {
                // If we already started dragging, just emit a 'mouseup'
                safeCallback(createVirtualEvent('mouseup', e));
            } else {
                // Minimal movement -> could be click or part of a double-click
                if (middleLastClickData && now - middleLastClickData.time < dblClickDelay) {
                    // If we have a recent middle click in memory, emit 'dblclick'
                    safeCallback(createVirtualEvent('dblclick', e));
                    middleLastClickData = null;
                } else {
                    // Otherwise, store this click and wait to see if another comes soon
                    middleLastClickData = { event: e, time: now };
                    setTimeout(() => {
                        // If double-click didn't occur within dblClickDelay, emit a single 'click'
                        if (middleLastClickData && Date.now() - middleLastClickData.time >= dblClickDelay) {
                            safeCallback(createVirtualEvent('click', e));
                            middleLastClickData = null;
                        }
                    }, dblClickDelay);
                }
            }
            middleMouseDownEvent = null;
            middleDragStarted = false;
        } else {
            // For any other button, just emit a 'mouseup'
            safeCallback(createVirtualEvent('mouseup', e));
        }
    }

    /**
     * Creates and returns a "virtual" event object based on the original MouseEvent.
     * These objects contain standardized data such as clientX, clientY, pageX, pageY, and the button number.
     *
     * @param {string} type The type of the virtual event (e.g. 'mousemove', 'mouseup', etc.).
     * @param {MouseEvent} originalEvent The original MouseEvent that triggered this virtual event.
     * @returns {object} A virtual event containing standardized mouse coordinates and references.
     */
    function createVirtualEvent(type: string, originalEvent: MouseEvent): any {
        return {
            type: type,
            button: originalEvent.button,
            clientX: originalEvent.clientX,
            clientY: originalEvent.clientY,
            pageX:
                originalEvent.pageX !== undefined
                    ? originalEvent.pageX
                    : originalEvent.clientX + window.scrollX,
            pageY:
                originalEvent.pageY !== undefined
                    ? originalEvent.pageY
                    : originalEvent.clientY + window.scrollY,
            target: originalEvent.target,
            originalEvent: originalEvent,
        };
    }

    /**
     * Safely invokes the user-provided callback with the given virtual event object.
     * Any errors thrown by the callback are caught and logged to the console,
     * preventing them from interfering with other event processing.
     *
     * @param {any} ve The virtual event object to pass to the callback.
     * @returns {void}
     */
    function safeCallback(ve: any): void {
        if (typeof callback === 'function') {
            try {
                callback(ve);
            } catch (error) {
                console.error("InputInterpreter callback error:", error);
            }
        }
    }

    /**
     * Initializes the MouseInputInterpreter with a callback function.
     * The callback will receive "virtual" mouse events such as 'mousemove', 'mousedown', 'mouseup',
     * 'click', 'dblclick', and 'contextmenu'.
     *
     * @param {(ve: any) => void} cb A callback function that receives virtual mouse events.
     * @throws {Error} If the provided argument is not a function.
     * @returns {void}
     */
    function init(cb: (ve: any) => void): void {
        if (typeof cb !== 'function') {
            throw new Error("MouseInputInterpreter.init requires a callback function");
        }
        callback = cb;

        // Add the necessary event listeners if not already added.
        if (!listenersAdded) {
            document.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            listenersAdded = true;
        }
    }

    /**
     * Removes the event listeners and resets the internal state.
     * This should be called when the MouseInputInterpreter is no longer needed.
     *
     * @returns {void}
     */
    function destroy(): void {
        if (listenersAdded) {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            listenersAdded = false;
        }
        callback = null;
        leftMouseDownEvent = null;
        rightMouseDownEvent = null;
        middleMouseDownEvent = null;
        lastClickData = null;
        middleLastClickData = null;
        leftDragStarted = false;
        rightDragStarted = false;
        middleDragStarted = false;
    }

    // Expose public methods.
    return {
        init,
        destroy,
    };
})();
