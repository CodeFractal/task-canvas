/* InputInterpreter.js
   This module virtualizes raw mouse events into single, interpreted ("virtual") events.
   It exposes a single object: InputInterpreter.
   Changes:
   - Separately tracks left- and right-button drag state so that mousedown events are delayed until
     a drag is detected, and right-clicks without drag yield a virtual contextmenu.
   - Virtual events now include valid pageX/pageY properties.
*/
const InputInterpreter = (function () {
    let callback = null;
    let lastMouseDownEvent = null;
    let lastClickData = null;
    let leftDragStarted = false;
    let rightDragStarted = false;
    const dragThreshold = 5;      // pixels movement to start a drag
    const dblClickDelay = 200;    // ms delay to detect a double-click

    function init(cb) {
        callback = cb;
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseDown(e) {
        lastMouseDownEvent = e;
        if (e.button === 0) {
            leftDragStarted = false;
        } else if (e.button === 2) {
            rightDragStarted = false;
        }
        // Do not immediately emit mousedown; wait for movement threshold.
    }

    function onMouseMove(e) {
        const veMove = createVirtualEvent('mousemove', e);
        if (callback) callback(veMove);

        if (lastMouseDownEvent) {
            const dx = e.clientX - lastMouseDownEvent.clientX;
            const dy = e.clientY - lastMouseDownEvent.clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (lastMouseDownEvent.button === 0 && !leftDragStarted && distance > dragThreshold) {
                leftDragStarted = true;
                const veDown = createVirtualEvent('mousedown', lastMouseDownEvent);
                if (callback) callback(veDown);
            }
            if (lastMouseDownEvent.button === 2 && !rightDragStarted && distance > dragThreshold) {
                rightDragStarted = true;
                const veDown = createVirtualEvent('mousedown', lastMouseDownEvent);
                if (callback) callback(veDown);
            }
        }
    }

    function onMouseUp(e) {
        const now = Date.now();
        if (e.button === 0) {
            if (leftDragStarted) {
                const veUp = createVirtualEvent('mouseup', e);
                if (callback) callback(veUp);
                lastMouseDownEvent = null;
                return;
            }
            // Minimal movement click.
            if (lastClickData && (now - lastClickData.time < dblClickDelay)) {
                const ve = createVirtualEvent('dblclick', e);
                if (callback) callback(ve);
                lastClickData = null;
            } else {
                lastClickData = { event: e, time: now };
                setTimeout(() => {
                    if (lastClickData && (Date.now() - lastClickData.time >= dblClickDelay)) {
                        const ve = createVirtualEvent('click', e);
                        if (callback) callback(ve);
                        lastClickData = null;
                    }
                }, dblClickDelay);
            }
        } else if (e.button === 2) {
            if (rightDragStarted) {
                const veUp = createVirtualEvent('mouseup', e);
                if (callback) callback(veUp);
            } else {
                // If right button did not drag, treat as a contextmenu.
                const ve = createVirtualEvent('contextmenu', e);
                if (callback) callback(ve);
            }
        } else {
            const ve = createVirtualEvent('mouseup', e);
            if (callback) callback(ve);
        }
        lastMouseDownEvent = null;
        leftDragStarted = false;
        rightDragStarted = false;
    }

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

    return {
        init: init
    };
})();
