import { DependencyArrow } from './DependencyArrow';
import { CustomPanZoom } from './CustomPanZoom';
import { Vector2D } from './Abstract/Math';

declare var Quill: any;

/**
 * DOMController manages the canvas, task elements, dependency arrows, and related UI elements.
 * It provides methods to manipulate tasks on the canvas including adding, moving, editing,
 * and drawing selection boxes and context menus.
 */
export const DOMController = (function () {
  // Ordered list of tasks for proper z-index ordering.
  let orderedTasks: { id: string; element: HTMLElement; position: { x: number; y: number } }[] = [];
  let canvas: HTMLElement | null = null;
  let didInit = false;
  let selectionBoxElement: HTMLElement | null = null;
  let contextMenuElement: HTMLElement | null = null;

  /**
   * Initializes the DOMController by retrieving the canvas and context menu elements.
   * If a unified context menu does not exist, it creates one.
   */
  function init(): void {
    if (didInit) return;
    // Get the canvas element.
    canvas = document.getElementById('canvas') as HTMLElement;
    // Attempt to find an existing context menu element.
    contextMenuElement = document.getElementById('contextMenu');
    if (!contextMenuElement) {
      // Create a new context menu if not found.
      contextMenuElement = document.createElement('div');
      contextMenuElement.id = 'contextMenu';
      contextMenuElement.style.position = 'absolute';
      contextMenuElement.style.display = 'none';
      document.body.appendChild(contextMenuElement);
    }
    didInit = true;
  }

  /**
   * Converts a screen position to a canvas position by accounting for pan and zoom.
   * @param screenPosition The x and y coordinates on the screen.
   * @returns The corresponding canvas coordinates.
   */
  function screenToCanvasPosition(screenPosition: Vector2D): Vector2D {
    const scale = CustomPanZoom.getScale ? CustomPanZoom.getScale() : 1;
    const translateX = CustomPanZoom.getTranslateX ? CustomPanZoom.getTranslateX() : 0;
    const translateY = CustomPanZoom.getTranslateY ? CustomPanZoom.getTranslateY() : 0;
    return new Vector2D(
      (screenPosition.x - translateX) / scale,
      (screenPosition.y - translateY) / scale,
    );
  }

  /**
   * Converts a screen scale to a canvas scale.
   * @param screenScale The scale values on the screen.
   * @returns The corresponding canvas scale values.
   */
  function screenToCanvasScale(screenScale: { x: number; y: number }): { x: number; y: number } {
    const scale = CustomPanZoom.getScale ? CustomPanZoom.getScale() : 1;
    return {
      x: screenScale.x / scale,
      y: screenScale.y / scale,
    };
  }

  /**
   * Retrieves the canvas element.
   * @returns The canvas HTMLElement.
   * @throws Error if the canvas is not initialized.
   */
  function getCanvas(): HTMLElement {
    if (!canvas) throw new Error("Canvas not initialized");
    return canvas;
  }

  /**
   * Finds the closest ancestor element with the 'task' class.
   * @param element The child element to search from.
   * @returns The task HTMLElement or null if not found.
   */
  function getTaskElementFromChild(element: Element): HTMLElement | null {
    return element.closest('.task') as HTMLElement;
  }

  /**
   * Finds the closest ancestor element with the 'task-header' class.
   * @param element The child element to search from.
   * @returns The task header HTMLElement or null if not found.
   */
  function getTaskHeaderElementFromChild(element: Element): HTMLElement | null {
    return element.closest('.task-header') as HTMLElement;
  }

  /**
   * Finds the closest ancestor element with the data-role attribute of 'title'.
   * @param element The child element to search from.
   * @returns The title HTMLElement or null if not found.
   */
  function getTaskTitleElementFromChild(element: Element): HTMLElement | null {
    return element.closest('[data-role="title"]') as HTMLElement;
  }

  /**
   * Finds the closest ancestor element with the data-role attribute of 'description'.
   * @param element The child element to search from.
   * @returns The description HTMLElement or null if not found.
   */
  function getTaskDescriptionElementFromChild(element: Element): HTMLElement | null {
    return element.closest('[data-role="description"]') as HTMLElement;
  }

  /**
   * Finds the closest ancestor element with the data-role attribute of 'toggle'.
   * @param element The child element to search from.
   * @returns The toggle HTMLElement or null if not found.
   */
  function getTaskExpandElementFromChild(element: Element): HTMLElement | null {
    return element.closest('[data-role="toggle"]') as HTMLElement;
  }

  /**
   * Finds the closest ancestor element with the data-role attribute of 'checkbox'.
   * @param element The child element to search from.
   * @returns The checkbox HTMLElement or null if not found.
   */
  function getTaskCompletionCheckboxFromChild(element: Element): HTMLElement | null {
    return element.closest('[data-role="checkbox"]') as HTMLElement;
  }

  /**
   * Finds the closest ancestor SVG element (representing a dependency arrow).
   * @param element The child element to search from.
   * @returns The SVGElement or null if not found.
   */
  function getDependencyArrowElementFromChild(element: Element): SVGElement | null {
    return element.closest('svg') as SVGElement;
  }

  /**
   * Retrieves the task id from a given element.
   * @param element The child element within the task.
   * @returns The task id string or null if not found.
   */
  function getTaskId(element: Element): string | null {
    const taskElement = getTaskElementFromChild(element);
    return taskElement ? taskElement.getAttribute('data-id') : null;
  }

  /**
   * Gets the current position of a task element in canvas space.
   * @param taskElement The task HTMLElement.
   */
  function getTaskPositionOnCanvas(taskElement: HTMLElement): Vector2D {
    return new Vector2D(
      taskElement.offsetLeft,
      taskElement.offsetTop,
    );
  }

  /**
   * Retrieves all task elements present on the canvas.
   * @returns A NodeList of task HTMLElements.
   * @throws Error if the canvas is not initialized.
   */
  function getAllTaskElements(): NodeListOf<HTMLElement> {
    if (!canvas) throw new Error("Canvas not initialized");
    return canvas.querySelectorAll('.task');
  }

  /**
   * Toggles the visual highlight on a task element.
   * @param taskElement The task HTMLElement.
   * @param highlight If true, adds the highlight; if false, removes it.
   */
  function toggleTaskHighlight(taskElement: HTMLElement, highlight: boolean): void {
    if (highlight) {
      taskElement.classList.add('selected');
    }
    else {
      taskElement.classList.remove('selected');
    }
  }

  /**
   * Creates and displays a selection box on the canvas.
   * This box is used for selecting multiple tasks.
   * @throws Error if the canvas is not initialized.
   */
  function showSelectionBox(): void {
    if (!canvas) throw new Error("Canvas not initialized");
    if (!selectionBoxElement) {
      selectionBoxElement = document.createElement('div');
      selectionBoxElement.style.position = 'absolute';
      selectionBoxElement.style.border = '1px dashed lightblue';
      selectionBoxElement.style.backgroundColor = 'rgba(173,216,230,0.2)';
      selectionBoxElement.style.pointerEvents = 'none';
      canvas.appendChild(selectionBoxElement);
    }
  }

  /**
   * Moves and resizes the selection box element based on start and current mouse positions.
   * Adjusts for the canvas pan and zoom.
   * @param start - The starting point (x, y) of the selection.
   * @param current - The current mouse position (x, y).
   */
  function moveSelectionBox(start: { x: number; y: number }, current: { x: number; y: number }): void {
    if (!selectionBoxElement) return;

    // Determine the top-left corner of the selection box.
    let x = Math.min(start.x, current.x);
    let y = Math.min(start.y, current.y);

    // Get current scale and translation from the pan/zoom module.
    const scale = CustomPanZoom.getScale ? CustomPanZoom.getScale() : 1;
    const translateX = CustomPanZoom.getTranslateX ? CustomPanZoom.getTranslateX() : 0;
    const translateY = CustomPanZoom.getTranslateY ? CustomPanZoom.getTranslateY() : 0;

    // Adjust coordinates for canvas translation and scale.
    x -= translateX;
    y -= translateY;
    x /= scale;
    y /= scale;

    // Calculate the width and height of the selection box.
    let width = Math.abs(start.x - current.x);
    let height = Math.abs(start.y - current.y);

    // Compensate for the scale of the canvas.
    width /= scale;
    height /= scale;

    // Update the selection box element's position and dimensions.
    selectionBoxElement.style.left = x + 'px';
    selectionBoxElement.style.top = y + 'px';
    selectionBoxElement.style.width = width + 'px';
    selectionBoxElement.style.height = height + 'px';
  }

  /**
   * Hides and removes the selection box element from the canvas.
   */
  function hideSelectionBox(): void {
    if (selectionBoxElement) {
      selectionBoxElement.remove();
      selectionBoxElement = null;
    }
  }

  /**
   * Determines whether two rectangles intersect.
   * @param r1 First rectangle with x, y, width, and height.
   * @param r2 Second rectangle with x, y, width, and height.
   * @returns True if the rectangles intersect; otherwise, false.
   */
  function rectsIntersect(
    r1: { x: number; y: number; width: number; height: number },
    r2: { x: number; y: number; width: number; height: number }
  ): boolean {
    return !(
      r2.x > r1.x + r1.width ||
      r2.x + r2.width < r1.x ||
      r2.y > r1.y + r1.height ||
      r2.y + r2.height < r1.y
    );
  }

  /**
   * Returns an array of task elements that are within a specified rectangular area.
   * @param start The starting mouse coordinates.
   * @param current The current mouse coordinates.
   * @returns An array of task HTMLElements that intersect with the area.
   * @throws Error if the canvas is not initialized.
   */
  function getTaskElementsInArea(start: { x: number; y: number }, current: { x: number; y: number }): HTMLElement[] {
    if (!canvas) throw new Error("Canvas not initialized");
    const canvasRect = canvas.getBoundingClientRect();
    const x = Math.min(start.x, current.x) - canvasRect.left;
    const y = Math.min(start.y, current.y) - canvasRect.top;
    const width = Math.abs(start.x - current.x);
    const height = Math.abs(start.y - current.y);
    const selectionRect = { x, y, width, height };
    const tasksInArea: HTMLElement[] = [];
    const taskElements = canvas.querySelectorAll('.task') as NodeListOf<HTMLElement>;
    taskElements.forEach((taskEl) => {
      const taskRect = taskEl.getBoundingClientRect();
      const taskX = taskRect.left - canvasRect.left;
      const taskY = taskRect.top - canvasRect.top;
      const taskWidth = taskRect.width;
      const taskHeight = taskRect.height;
      if (rectsIntersect({ x: taskX, y: taskY, width: taskWidth, height: taskHeight }, selectionRect)) {
        tasksInArea.push(taskEl);
      }
    });
    return tasksInArea;
  }

  /**
   * Displays the context menu at a specified position with provided options.
   * @param position The x and y coordinates where the menu should appear.
   * @param options An array of tuples where each tuple contains an option key and its human-readable label.
   */
  function showContextMenu(position: { x: number; y: number }, options: [string, string][]): void {
    if (!contextMenuElement) {
      console.error("Not initialized");
      return;
    }
    // Clear any existing menu items.
    contextMenuElement.innerHTML = '';
    // Create a menu item for each option.
    options.forEach((opt) => {
      const item = document.createElement('div');
      item.textContent = opt[1];
      item.setAttribute('data-role', 'context-menu-item');
      item.setAttribute('data-key', opt[0]);
      contextMenuElement!.appendChild(item);
    });
    // Position and show the context menu.
    contextMenuElement.style.left = position.x + 'px';
    contextMenuElement.style.top = position.y + 'px';
    contextMenuElement.style.display = 'block';
  }

  /**
   * Retrieves the option key from a clicked context menu item.
   * @param element The clicked element.
   * @returns The option key string or null if not found.
   */
  function getContextMenuOption(element: Element): string | null {
    if (!element) return null;
    const eContextMenuItems = element.closest('[data-role="context-menu-item"]');
    return eContextMenuItems ? eContextMenuItems.getAttribute('data-key') : null;
  }

  /**
   * Hides the context menu.
   */
  function hideContextMenu(): void {
    if (contextMenuElement) {
      contextMenuElement.style.display = 'none';
    }
  }

  /**
   * Adds a new task element to the canvas with the provided data.
   * The task is created with a header (toggle, title, checkbox) and a body (description).
   * @param taskData An object containing task details such as id, title, description, position, completion, and collapsed state.
   * @throws Error if the canvas is not initialized.
   */
  function addTaskToCanvas(taskData: {
    id: string;
    title: string;
    description: string;
    x: number;
    y: number;
    completed: boolean;
    collapsed: boolean;
  }): void {
    if (!canvas) throw new Error("Canvas not initialized");
    const eTask = document.createElement('div');
    eTask.classList.add('task');
    eTask.setAttribute('data-id', taskData.id);
    eTask.style.left = taskData.x + 'px';
    eTask.style.top = taskData.y + 'px';
    eTask.setAttribute('data-snapped', taskData.x % 40 === 0 && taskData.y % 40 === 0 ? 'true' : 'false');

    // Create header container for task controls.
    const header = document.createElement('div');
    header.classList.add('task-header');

    // Create toggle element to collapse/expand the task.
    const toggle = document.createElement('div');
    toggle.classList.add('toggle');
    toggle.setAttribute('data-role', 'toggle');
    toggle.textContent = taskData.collapsed ? '►' : '▼';
    header.appendChild(toggle);

    // Create title element.
    const title = document.createElement('div');
    title.classList.add('title');
    title.setAttribute('data-role', 'title');
    title.textContent = taskData.title;
    header.appendChild(title);

    // Create custom checkbox element.
    const checkbox = document.createElement('div');
    checkbox.classList.add('custom-checkbox');
    checkbox.setAttribute('data-role', 'checkbox');

    // Create checkbox fill element for completion state
    const checkboxFill = document.createElement('div');
    checkboxFill.classList.add('checkbox-fill');

    // Use a template literal for interpolated SVG content.
    checkboxFill.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" style="background: transparent;">
  <rect x="1" y="1" width="26" height="26" rx="3.75" ry="3.75" fill="none" stroke="#4d4d4d" stroke-width="2"></rect>
  <defs>
    <mask id="checkMask-${taskData.id}">
      <rect x="0" y="0" width="28" height="28" fill="white"></rect>
      <polyline points="8,15 12,19 20,9" stroke="black" stroke-width="2" stroke-linecap="round" fill="none" stroke-linejoin="round"></polyline>
    </mask>
  </defs>
  <rect x="4" y="4" width="20" height="20" rx="1.9" ry="1.9" fill="#25a599" fill-opacity="${taskData.completed ? '1' : '0.1'}" mask="url(#checkMask-${taskData.id})"></rect>
</svg>`;
    checkbox.appendChild(checkboxFill);
    header.appendChild(checkbox);

    eTask.appendChild(header);

    // Create task body container.
    const taskBody = document.createElement('div');
    taskBody.classList.add('task-body');
    eTask.appendChild(taskBody);

    // Create description element.
    const description = document.createElement('div');
    description.classList.add('description');
    description.setAttribute('data-role', 'description');
    description.innerHTML = taskData.description;
    taskBody.appendChild(description);

    // Add the new task to the canvas in the correct z-order.
    adjustTaskZPosition(eTask, { x: taskData.x, y: taskData.y });
  }

  /**
   * Moves a task element to a new position on the canvas.
   * Optionally adjusts the z-index ordering.
   * @param taskElement The task HTMLElement.
   * @param position The new x and y coordinates.
   * @param autoAdjustZPosition If true, reorders the task in the DOM based on position.
   */
  function moveTask(taskElement: HTMLElement, position: { x: number; y: number }, autoAdjustZPosition = true): void {
    taskElement.style.left = position.x + 'px';
    taskElement.style.top = position.y + 'px';
    if (autoAdjustZPosition) {
      adjustTaskZPosition(taskElement, position);
    }
  }

  /**
   * Adjusts the z-index ordering of a task element based on its position.
   * Tasks with lower y (or lower x when y is equal) are placed below others.
   * @param taskElement The task HTMLElement.
   * @param position The new x and y coordinates.
   * @throws Error if the canvas is not initialized.
   */
  function adjustTaskZPosition(taskElement: HTMLElement, position: { x: number; y: number }): void {
    let taskItem = orderedTasks.find((t) => t.element === taskElement);
    if (taskItem) {
      taskItem.position = position;
      orderedTasks = orderedTasks.filter((t) => t.element !== taskElement);
    }
    else {
      taskItem = {
        id: taskElement.getAttribute('data-id') || '',
        element: taskElement,
        position: position,
      };
    }
    let newIndex = orderedTasks.findIndex((t) => {
      return position.y > t.position.y || (position.y === t.position.y && position.x > t.position.x);
    });
    if (newIndex === -1) newIndex = orderedTasks.length;
    orderedTasks.splice(newIndex, 0, taskItem);
    if (!canvas) throw new Error("Canvas not initialized");
    if (newIndex === orderedTasks.length - 1) {
      canvas.appendChild(taskElement);
    }
    else {
      canvas.insertBefore(taskElement, orderedTasks[newIndex + 1].element);
    }
  }

  /**
   * Enables inline editing of a task's title.
   * Replaces the title element with an input field and saves the new title on blur.
   * @param taskElem The task HTMLElement.
   * @param taskData An object containing the current title and id.
   * @param onSave Callback function invoked after saving with (oldValue, newValue).
   */
  function editTaskTitle(
    taskElem: HTMLElement,
    taskData: { title: string; id: string },
    onSave: (oldValue: string, newValue: string) => void
  ): void {
    const titleEl = taskElem.querySelector('[data-role="title"]') as HTMLElement;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = taskData.title;
    input.style.width = '100%';
    // Replace the title element with an input field.
    titleEl.replaceWith(input);
    input.focus();
    input.addEventListener('blur', () => {
      const oldValue = taskData.title;
      taskData.title = input.value || "Untitled";
      const newTitleEl = document.createElement('div');
      newTitleEl.classList.add('title');
      newTitleEl.setAttribute('data-role', 'title');
      newTitleEl.textContent = taskData.title;
      input.replaceWith(newTitleEl);
      onSave(oldValue, taskData.title);
    });
  }

  /**
   * Enables rich-text editing of a task's description using Quill.
   * Replaces the description element with a Quill editor and saves on blur.
   * @param taskElem The task HTMLElement.
   * @param taskData An object containing the current description and id.
   * @param onSave Callback function invoked after saving with (oldValue, newValue).
   */
  function editTaskDescription(
    taskElem: HTMLElement,
    taskData: { description: string; id: string },
    onSave: (oldValue: string, newValue: string) => void
  ): void {
    const descEl = taskElem.querySelector('[data-role="description"]') as HTMLElement;
    const originalDesc = descEl;
    const editorContainer = document.createElement('div');
    const editorElement = document.createElement('div');
    editorContainer.appendChild(editorElement);
    editorContainer.classList.add('editor-container');
    editorContainer.style.minHeight = '50px';
    originalDesc.parentNode?.replaceChild(editorContainer, originalDesc);

    // Initialize Quill with the 'snow' theme and a toolbar.
    const quill = new Quill(editorElement, {
      theme: 'snow',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          [{ header: 1 }, { header: 2 }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ indent: '-1' }, { indent: '+1' }],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          ['clean'],
        ],
      },
    });
    quill.root.innerHTML = taskData.description;
    quill.focus();
    setTimeout(() => quill.setSelection(quill.getLength(), 0), 0);

    /**
     * Adjusts the editor's height based on its content.
     */
    function adjustHeight(): void {
      const newHeight = quill.root.scrollHeight;
      editorElement.style.height = newHeight + 'px';
    }
    quill.on('text-change', adjustHeight);
    adjustHeight();

    /**
     * Saves the new description and replaces the editor with the updated description element.
     */
    function saveAndCleanup(): void {
      const oldValue = taskData.description;
      taskData.description = quill.root.innerHTML;
      const newDescEl = document.createElement('div');
      newDescEl.classList.add('description');
      newDescEl.setAttribute('data-role', 'description');
      newDescEl.innerHTML = taskData.description;
      editorContainer.parentNode?.replaceChild(newDescEl, editorContainer);
      onSave(oldValue, taskData.description);

      // TODO: Move this listener out of the DOMController
      document.removeEventListener('click', clickOutsideListener);
    }

    /**
     * Listener to detect clicks outside the editor to trigger saving.
     * @param e The click event.
     */
    function clickOutsideListener(e: Event): void {
      if (!editorContainer.contains(e.target as Node)) {
        saveAndCleanup();
      }
    }

    // TODO: Move this listener out of the DOMController
    document.addEventListener('click', clickOutsideListener);
  }

  /**
   * Placeholder function to update dependency arrows for a given task.
   * @param taskId The id of the task.
   */
  function updateTaskDependencies(taskId: string): void {
    // Placeholder: In a full implementation, update dependency arrows related to the task.
  }

  /**
   * Adds a dependency arrow between two tasks.
   * @param fromId The id of the source task.
   * @param toId The id of the target task.
   * @param options Optional settings for the arrow (color, pzZoomFactor, skipUndo).
   * @returns The created arrow object or undefined if tasks are not found.
   * @throws Error if the canvas is not initialized.
   */
  function addDependency(
    fromId: string,
    toId: string,
    options: { color?: string; pzZoomFactor?: number; skipUndo?: boolean } = {}
  ): any {
    if (!canvas) throw new Error("Canvas not initialized");
    const fromEl = canvas.querySelector(`.task[data-id="${fromId}"]`) as HTMLElement;
    const toEl = canvas.querySelector(`.task[data-id="${toId}"]`) as HTMLElement;
    if (!fromEl || !toEl) return;
    const arrow = DependencyArrow.createArrow(
      canvas,
      toEl,
      fromEl,
      { color: options.color || '#b3b3b3', pzZoomFactor: CustomPanZoom.getScale() }
    );
    canvas.prepend(arrow.svg);
    return arrow;
  }

  /**
   * Removes a task from the canvas.
   * @param taskId The id of the task to be removed.
   * @throws Error if the canvas is not initialized.
   */
  function removeTask(taskId: string): void {
    if (!canvas) throw new Error("Canvas not initialized");
    const taskEl = canvas.querySelector(`.task[data-id="${taskId}"]`) as HTMLElement;
    if (taskEl) taskEl.remove();
  }

  /**
   * Removes a dependency arrow from the canvas.
   * @param arrow The arrow object to be removed.
   */
  function removeDependency(arrow: any): void {
    if (arrow) arrow.remove();
  }

  /**
   * Updates the visual representation of a task's completion status.
   * @param taskElem The task HTMLElement.
   * @param completed True if the task is completed; otherwise, false.
   */
  function updateTaskCompletionVisual(taskElem: HTMLElement, completed: boolean): void {
    const checkboxFill = taskElem.querySelector('.checkbox-fill') as HTMLElement;
    if (checkboxFill) {
      const innerRect = checkboxFill.querySelector('rect[mask]') as SVGRectElement;
      if (innerRect) {
        innerRect.setAttribute('fill-opacity', completed ? '1' : '0.1');
      }
    }
  }

  /**
   * Toggles the expansion (collapse/expand) visual state of a task.
   * @param taskElem The task HTMLElement.
   * @param collapsed True if the task should be collapsed; otherwise, expanded.
   */
  function toggleTaskExpansionVisual(taskElem: HTMLElement, collapsed: boolean): void {
    const taskBody = taskElem.querySelector('.task-body') as HTMLElement;
    if (taskBody) {
      taskBody.style.display = collapsed ? 'none' : 'block';
    }
    const toggleElem = taskElem.querySelector('.toggle') as HTMLElement;
    if (toggleElem) {
      toggleElem.textContent = collapsed ? '►' : '▼';
    }
  }

  /**
   * Updates the ghost arrow during dependency creation based on mouse position and snapping.
   * @param dependencyCreationMode Indicates if the ghost arrow is for 'source' or 'target'.
   * @param ghostArrow The ghost arrow object.
   * @param dependencyCreationFixedTask The fixed task id from which the dependency is created.
   * @param ghostSnapTarget The optional snapping target task id.
   * @param mousePosition The current mouse position.
   * @throws Error if the canvas is not initialized.
   */
  function updateGhostArrow(
    dependencyCreationMode: string,
    ghostArrow: any,
    dependencyCreationFixedTask: string,
    ghostSnapTarget: string | null,
    mousePosition: { x: number; y: number }
  ): void {
    if (!canvas) throw new Error("Canvas not initialized");
    const canvasRect = canvas.getBoundingClientRect();
    if (dependencyCreationMode && ghostArrow) {
      if (dependencyCreationMode === 'source') {
        const fixedEl = canvas.querySelector(`.task[data-id="${dependencyCreationFixedTask}"]`) as HTMLElement;
        if (ghostSnapTarget) {
          const targetEl = canvas.querySelector(`.task[data-id="${ghostSnapTarget}"]`) as HTMLElement;
          ghostArrow.update(targetEl, fixedEl, { pzZoomFactor: CustomPanZoom.getScale() });
          ghostArrow.setColor('#55b38888'); // Valid color
        }
        else {
          ghostArrow.update(
            { x: mousePosition.x - canvasRect.left, y: mousePosition.y - canvasRect.top },
            fixedEl,
            { pzZoomFactor: CustomPanZoom.getScale() }
          );
          ghostArrow.setColor('#b3555588'); // Invalid color
        }
      }
      else if (dependencyCreationMode === 'target') {
        const fixedEl = canvas.querySelector(`.task[data-id="${dependencyCreationFixedTask}"]`) as HTMLElement;
        if (ghostSnapTarget) {
          const sourceEl = canvas.querySelector(`.task[data-id="${ghostSnapTarget}"]`) as HTMLElement;
          ghostArrow.update(fixedEl, sourceEl, { pzZoomFactor: CustomPanZoom.getScale() });
          ghostArrow.setColor('#55b38888'); // Valid color
        }
        else {
          ghostArrow.update(
            fixedEl,
            { x: mousePosition.x - canvasRect.left, y: mousePosition.y - canvasRect.top },
            { pzZoomFactor: CustomPanZoom.getScale() }
          );
          ghostArrow.setColor('#b3555588'); // Invalid color
        }
      }
    }
  }

  // Expose the public API.
  return {
        init,
        screenToCanvasPosition,
        screenToCanvasScale,
        getCanvas,
        getTaskElementFromChild,
        getTaskHeaderElementFromChild,
        getTaskTitleElementFromChild,
        getTaskDescriptionElementFromChild,
        getTaskExpandElementFromChild,
        getTaskCompletionCheckboxFromChild,
        getDependencyArrowElementFromChild,
        getTaskId,
        getTaskPositionOnCanvas,
        getAllTaskElements,
        toggleTaskHighlight,
        moveSelectionBox,
        showSelectionBox,
        hideSelectionBox,
        getTaskElementsInArea,
        showContextMenu,
        hideContextMenu,
        getContextMenuOption,
        addTaskToCanvas,
        moveTask,
        adjustTaskZPosition,
        editTaskTitle,
        editTaskDescription,
        updateTaskDependencies,
        addDependency,
        removeTask,
        removeDependency,
        updateTaskCompletionVisual,
        toggleTaskExpansionVisual,
        updateGhostArrow
  };
})();
