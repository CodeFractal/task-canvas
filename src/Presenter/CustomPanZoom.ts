export const CustomPanZoom = (function () {
    let canvas: HTMLElement | null = null;
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    const minScale = 0.5;
    const maxScale = 5;

    function init(el: HTMLElement): void {
        canvas = el;
        canvas.style.transformOrigin = "0 0";
        canvas.style.cursor = "default";
        updateTransform();
        canvas.addEventListener("wheel", onWheel, { passive: false });
    }

    function onWheel(e: WheelEvent): void {
        e.preventDefault();
        if (e.ctrlKey) {
            // Zoom: deltaY < 0 zooms in, deltaY > 0 zooms out.
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            setScale(scale + delta, e.clientX, e.clientY);
        }
        else {
            // Pan: adjust translation based on wheel delta.
            translateX -= e.deltaX;
            translateY -= e.deltaY;
            updateTransform();
        }
    }

    function setScale(newScale: number, centerX: number, centerY: number): void {
        newScale = Math.max(minScale, Math.min(maxScale, newScale));
        if (newScale !== scale && canvas) {
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

    function updateTransform(): void {
        if (canvas) {
            canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        }
    }

    function panBy(deltaX: number, deltaY: number): void {
        translateX += deltaX;
        translateY += deltaY;
        updateTransform();
    }

    function getScale(): number {
        return scale;
    }

    function getTranslateX(): number {
        return translateX;
    }

    function getTranslateY(): number {
        return translateY;
    }

    return {
        init,
        getScale,
        getTranslateX,
        getTranslateY,
        panBy,
    };
})();
