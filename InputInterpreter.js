/* InputInterpreter.js
   This module virtualizes raw mouse events into single, interpreted ("virtual") events.
   It exposes a single object: InputInterpreter.
   Changes:
   - Separately tracks left- and right-button drag state with individual mouse down events.
   - Delays mousedown until drag is detected; right-clicks without drag yield a virtual contextmenu.
   - Virtual events now include valid pageX/pageY properties.
   - Improved reliability with defensive coding and a destroy method for cleanup.
*/
const InputInterpreter = (function () {
    let callback = null;
    let leftMouseDownEvent = null;
    let rightMouseDownEvent = null;
    let lastClickData = null;
    let leftDragStarted = false;
    let rightDragStarted = false;
    const dragThreshold = 5;      // pixels movement to start a drag
    const dblClickDelay = 200;    // ms delay to detect a double-click
    let listenersAdded = false;

    // Called when a mouse button is pressed.
    function onMouseDown(e) {
        if (e.button === 0) {
            leftMouseDownEvent = e;
            leftDragStarted = false;
        } else if (e.button === 2) {
            rightMouseDownEvent = e;
            rightDragStarted = false;
        }
        // Do not immediately emit mousedown; wait for movement threshold.
    }

    // Called when the mouse moves.
    function onMouseMove(e) {
        // Always emit a virtual mousemove event.
        safeCallback(createVirtualEvent('mousemove', e));

        // Check for left-button drag start.
        if (leftMouseDownEvent && !leftDragStarted) {
            const dx = e.clientX - leftMouseDownEvent.clientX;
            const dy = e.clientY - leftMouseDownEvent.clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > dragThreshold) {
                leftDragStarted = true;
                safeCallback(createVirtualEvent('mousedown', leftMouseDownEvent));
            }
        }

        // Check for right-button drag start.
        if (rightMouseDownEvent && !rightDragStarted) {
            const dx = e.clientX - rightMouseDownEvent.clientX;
            const dy = e.clientY - rightMouseDownEvent.clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > dragThreshold) {
                rightDragStarted = true;
                safeCallback(createVirtualEvent('mousedown', rightMouseDownEvent));
            }
        }
    }

    // Called when a mouse button is released.
    function onMouseUp(e) {
        const now = Date.now();
        if (e.button === 0) {
            if (leftDragStarted) {
                safeCallback(createVirtualEvent('mouseup', e));
            } else {
                // Handle minimal movement click with potential double-click detection.
                if (lastClickData && (now - lastClickData.time < dblClickDelay)) {
                    safeCallback(createVirtualEvent('dblclick', e));
                    lastClickData = null;
                } else {
                    lastClickData = { event: e, time: now };
                    setTimeout(() => {
                        if (lastClickData && (Date.now() - lastClickData.time >= dblClickDelay)) {
                            safeCallback(createVirtualEvent('click', e));
                            lastClickData = null;
                        }
                    }, dblClickDelay);
                }
            }
            leftMouseDownEvent = null;
            leftDragStarted = false;
        } else if (e.button === 2) {
            if (rightDragStarted) {
                safeCallback(createVirtualEvent('mouseup', e));
            } else {
                // If right button did not drag, treat as a contextmenu.
                safeCallback(createVirtualEvent('contextmenu', e));
            }
            rightMouseDownEvent = null;
            rightDragStarted = false;
        } else {
            safeCallback(createVirtualEvent('mouseup', e));
        }
    }

    // Constructs a virtual event with extended properties.
    function createVirtualEvent(type, originalEvent) {
        return {
            type: type,
            button: originalEvent.button,
            clientX: originalEvent.clientX,
            clientY: originalEvent.clientY,
            pageX: (originalEvent.pageX !== undefined) ? originalEvent.pageX : originalEvent.clientX + window.scrollX,
            pageY: (originalEvent.pageY !== undefined) ? originalEvent.pageY : originalEvent.clientY + window.scrollY,
            target: originalEvent.target,
            originalEvent: originalEvent
        };
    }

    // Safely invokes the callback to catch errors without disrupting event processing.
    function safeCallback(ve) {
        if (typeof callback === 'function') {
            try {
                callback(ve);
            } catch (error) {
                console.error('InputInterpreter callback error:', error);
            }
        }
    }

    // Initializes the interpreter with a callback.
    function init(cb) {
        if (typeof cb !== 'function') {
            throw new Error('InputInterpreter.init requires a callback function');
        }
        callback = cb;
        if (!listenersAdded) {
            document.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            listenersAdded = true;
        }
    }

    // Cleans up event listeners and resets internal state.
    function destroy() {
        if (listenersAdded) {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            listenersAdded = false;
        }
        callback = null;
        leftMouseDownEvent = null;
        rightMouseDownEvent = null;
        lastClickData = null;
        leftDragStarted = false;
        rightDragStarted = false;
    }

    // Expose the public API. (Existing usage remains unchanged.)
    return {
        init: init,
        destroy: destroy
    };
})();
