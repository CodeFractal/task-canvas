/* CustomPanZoom.js
   A simple, custom panning and zooming implementation.
   Exposes a single object: CustomPanZoom.
   Uses CSS transforms on the canvas element to enable infinite scrolling.
*/
const CustomPanZoom = (function () {
    let canvas;
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    const minScale = 0.5;
    const maxScale = 5;

    // Initialize the custom pan/zoom on the given element.
    function init(el) {
        canvas = el;
        canvas.style.transformOrigin = "0 0";
        // Set an initial cursor.
        canvas.style.cursor = "default";
        updateTransform();
        // Listen for wheel events on the canvas.
        canvas.addEventListener('wheel', onWheel, { passive: false });
    }

    // Handle wheel events: if CTRL is pressed, zoom; otherwise, pan.
    function onWheel(e) {
        e.preventDefault();
        if (e.ctrlKey) {
            // Zoom: deltaY < 0 zooms in, deltaY > 0 zooms out.
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            setScale(scale + delta, e.clientX, e.clientY);
        } else {
            // Pan: adjust translation based on wheel delta.
            translateX -= e.deltaX;
            translateY -= e.deltaY;
            updateTransform();
        }
    }

    // Set a new scale and adjust translation so that the point under the cursor remains fixed.
    function setScale(newScale, centerX, centerY) {
        newScale = Math.max(minScale, Math.min(maxScale, newScale));
        if (newScale !== scale) {
            const rect = canvas.getBoundingClientRect();
            const offsetX = centerX - rect.left;
            const offsetY = centerY - rect.top;
            const relX = (offsetX - translateX) / scale;
            const relY = (offsetY - translateY) / scale;
            translateX = offsetX - relX * newScale;
            translateY = offsetY - relY * newScale;
            scale = newScale;
            updateTransform();
        }
    }

    // Update the canvas element's CSS transform.
    function updateTransform() {
        if (canvas) {
            canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        }
    }

    // Pan by a given delta.
    function panBy(deltaX, deltaY) {
        translateX += deltaX;
        translateY += deltaY;
        updateTransform();
    }

    function getScale() {
        return scale;
    }

    function getTranslateX() {
        return translateX;
    }

    function getTranslateY() {
        return translateY;
    }

    return {
        init: init,
        getScale: getScale,
        getTranslateX: getTranslateX,
        getTranslateY: getTranslateY,
        panBy: panBy
    };
})();
