import { ArrowHandler, DependencyArrow } from './DependencyArrow';
import { CustomPanZoom } from './CustomPanZoom';
import { IControllerPresenter, Arrow, TaskComponent } from '../Interfaces/IPresenter';
import { ITask } from '../Interfaces/ITask';
import { IDependency } from '../Interfaces/IDependency';
import { CanvasCoords, CanvasRect, ScreenCoords, ScreenRect, SizeOnScreen } from './CoordinateSystem';
import { Rectangle, Vector2D } from '../Abstract/Math';
import { ModalDialog } from './ModalDialog';

declare var Quill: any;

/**
 * DOMController manages the canvas, task elements, dependency arrows, and related UI elements.
 * It provides methods to manipulate tasks on the canvas including adding, moving, editing,
 * and drawing selection boxes and context menus.
 */
export class AppPresenter implements IControllerPresenter {
  private orderedTasks: { id: number; element: HTMLElement; position: { x: number; y: number } }[] = [];
  private canvas: HTMLElement | null = null;
  private selectionBoxElement: HTMLElement | null = null;
  private contextMenuElement: HTMLElement | null = null;
  private modalScreen: HTMLElement;
  private modalDialogElement: HTMLElement;

  // Mapping from task ID to its ITask and DOM element.
  private taskMap: Map<number, { task: ITask; element: HTMLElement }> = new Map();

  // Mapping from dependency key to its wrapped arrow.
  private dependencyMap: Map<string, ArrowWrapper> = new Map();

  constructor() {
    // Get the canvas element.
    this.canvas = document.getElementById('canvas') as HTMLElement;
    CustomPanZoom.init(this.canvas);
    // Attempt to find an existing context menu element.
    this.contextMenuElement = document.getElementById('contextMenu');
    if (!this.contextMenuElement) {
      // Create a new context menu if not found.
      this.contextMenuElement = document.createElement('div');
      this.contextMenuElement.id = 'contextMenu';
      this.contextMenuElement.style.position = 'absolute';
      this.contextMenuElement.style.display = 'none';
      document.body.appendChild(this.contextMenuElement);
    }

    // Add modal screen to DOM
    const modalScreen = document.createElement('div');
    modalScreen.id = 'modalScreen';
    modalScreen.style.position = 'fixed';
    modalScreen.style.inset = '0';
    modalScreen.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modalScreen.style.display = 'none';
    modalScreen.style.zIndex = '1000';
    document.body.appendChild(modalScreen);

    // Add modal dialog to DOM
    this.modalDialogElement = ModalDialog.makeHtmlElement();
    this.modalDialogElement.style.zIndex = '1001';
    document.body.appendChild(this.modalDialogElement);

    this.modalScreen = modalScreen;
  }

  //────────────────────────────────────────────────────────────
  // IPresenter methods (using ITask where appropriate)
  //────────────────────────────────────────────────────────────

  pauseCanvas(): void {
    this.modalScreen.style.display = 'block';
  }

  unpauseCanvas(): void {
    this.modalScreen.style.display = 'none';    
  }

  showModal(title: string, message: string, options: [string, string][]): Promise<string> {
    return new Promise((resolve) => {
      const dialog = new ModalDialog(this.modalDialogElement, {
        title,
        message,
        options,
        allowClose: false,
        onSelection: button => {
          resolve(button);
        }
      });
      dialog.show();
    });
  }

  panCanvas(delta: SizeOnScreen): void {
    CustomPanZoom.panBy(delta.vec);
  }

  getTaskPositionOnCanvas(task: ITask): CanvasCoords {
    const elem = this.getTaskElement(task);
    if (!elem) throw new Error("Task element not found");
    return CanvasCoords.new(elem.offsetLeft, elem.offsetTop);
  }

  toggleTaskHighlight(task: ITask, highlight: boolean): void {
    const elem = this.getTaskElement(task);
    if (!elem) return;
    if (highlight) {
      elem.classList.add('selected');
    } else {
      elem.classList.remove('selected');
    }
  }

  toggleAllTaskHighlights(highlight: boolean): void {
    const taskElements = this.canvas?.querySelectorAll('.task') as NodeListOf<HTMLElement>;
    taskElements.forEach((taskEl) => {
      if (highlight) {
        taskEl.classList.add('selected');
      }
      else {
        taskEl.classList.remove('selected');
      }
    });
  }

  showSelectionBox(): void {
    if (!this.canvas) throw new Error("Canvas not initialized");
    if (!this.selectionBoxElement) {
      this.selectionBoxElement = document.createElement('div');
      this.selectionBoxElement.style.position = 'absolute';
      this.selectionBoxElement.style.border = '1px dashed lightblue';
      this.selectionBoxElement.style.backgroundColor = 'rgba(173,216,230,0.2)';
      this.selectionBoxElement.style.pointerEvents = 'none';
      this.canvas.appendChild(this.selectionBoxElement);
    }
  }

  moveSelectionBox(start: ScreenCoords, end: ScreenCoords): void {
    if (!this.selectionBoxElement) return;
    // Determine the top-left corner of the selection box.
    let x = Math.min(start.x, end.x);
    let y = Math.min(start.y, end.y);
    // Get current scale and translation from the pan/zoom module.
    const scale = CustomPanZoom.getScale();
    const translation = CustomPanZoom.getTranslation();
    // Adjust coordinates for canvas translation and scale.
    x = (x - translation.x) / scale;
    y = (y - translation.y) / scale;
    // Calculate the width and height of the selection box.
    let width = Math.abs(start.x - end.x) / scale;
    let height = Math.abs(start.y - end.y) / scale;
    // Update the selection box element's position and dimensions.
    this.selectionBoxElement.style.left = x + 'px';
    this.selectionBoxElement.style.top = y + 'px';
    this.selectionBoxElement.style.width = width + 'px';
    this.selectionBoxElement.style.height = height + 'px';
  }

  hideSelectionBox(): void {
    if (this.selectionBoxElement) {
      this.selectionBoxElement.remove();
      this.selectionBoxElement = null;
    }
  }

  getAllTasks(): ITask[] {
    return Array.from(this.taskMap.values()).map((mapping) => mapping.task);
  }

  getTasksInArea(start: ScreenCoords, end: ScreenCoords): ITask[] {
    if (!this.canvas) throw new Error("Canvas not initialized");
    const selectionRect = ScreenRect.fromPoints(start, end);
    const tasksInArea: ITask[] = [];
    const taskElements = this.canvas.querySelectorAll('.task') as NodeListOf<HTMLElement>;
    taskElements.forEach((taskEl) => {
      const taskRect = ScreenRect.fromElementBounds(taskEl);
      if (selectionRect.intersects(taskRect)) {
        const idString = taskEl.getAttribute('data-id');
        const id = idString ? parseInt(idString) : null;
        if (id && this.taskMap.has(id)) {
          tasksInArea.push(this.taskMap.get(id)!.task);
        }
      }
    });
    return tasksInArea;
  }

  showContextMenu(position: ScreenCoords, options: [string, string][]): void {
    const contextMenuElement = this.contextMenuElement;
    if (!contextMenuElement) {
      throw new Error("Not initialized");
    }
    // Clear any existing menu items.
    contextMenuElement.innerHTML = '';
    options.forEach((opt) => {
      const item = document.createElement('div');
      item.textContent = opt[1];
      item.setAttribute('data-role', 'context-menu-item');
      item.setAttribute('data-key', opt[0]);
      contextMenuElement.appendChild(item);
    });
    contextMenuElement.style.left = position.x + 'px';
    contextMenuElement.style.top = position.y + 'px';
    contextMenuElement.style.display = 'block';
  }

  hideContextMenu(): void {
    if (this.contextMenuElement) {
      this.contextMenuElement.style.display = 'none';
    }
  }

  addTaskToCanvas(task: ITask): void {
    if (!this.canvas) throw new Error("Canvas not initialized");
    const eTask = document.createElement('div');
    eTask.classList.add('task');
    eTask.setAttribute('data-id', task.getId().toString());
    const pos = task.getPosition();
    if (pos) {
      eTask.style.left = pos.x + 'px';
      eTask.style.top = pos.y + 'px';
      eTask.setAttribute('data-snapped', (pos.x % 40 === 0 && pos.y % 40 === 0) ? 'true' : 'false');
    }

    // Create header container for task controls.
    const header = document.createElement('div');
    header.classList.add('task-header');

    // Create "expand" element to collapse/expand the task.
    const expandSwitch = document.createElement('div');
    expandSwitch.setAttribute('data-role', 'expand-switch');
    expandSwitch.classList.add('expand-switch');
    if (task.isExpanded()) {
      expandSwitch.classList.add('expand-switch-expanded');
    }
    else if (task.getDescription().length === 0) {
      expandSwitch.classList.add('expand-switch-add');
    }
    header.appendChild(expandSwitch);

    // Create title element.
    const title = document.createElement('div');
    title.classList.add('title');
    title.setAttribute('data-role', 'title');
    title.textContent = task.getTitle();
    header.appendChild(title);

    // Create custom checkbox element.
    const checkbox = document.createElement('div');
    checkbox.classList.add('custom-checkbox');
    checkbox.setAttribute('data-role', 'checkbox');

    // Create checkbox fill element for completion state.
    const checkboxFill = document.createElement('div');
    checkboxFill.classList.add('checkbox-fill');
    checkboxFill.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" style="background: transparent;">
  <rect x="1" y="1" width="26" height="26" rx="3.75" ry="3.75" fill="none" stroke="#4d4d4d" stroke-width="2"></rect>
  <defs>
    <mask id="checkMask-${task.getId()}">
      <rect x="0" y="0" width="28" height="28" fill="white"></rect>
      <polyline points="8,15 12,19 20,9" stroke="black" stroke-width="2" stroke-linecap="round" fill="none" stroke-linejoin="round"></polyline>
    </mask>
  </defs>
  <rect x="4" y="4" width="20" height="20" rx="1.9" ry="1.9" fill="#25a599" fill-opacity="${task.isComplete() ? '1' : '0.1'}" mask="url(#checkMask-${task.getId()})"></rect>
</svg>`;
    checkbox.appendChild(checkboxFill);
    header.appendChild(checkbox);

    eTask.appendChild(header);

    // Create task body container.
    const taskBody = document.createElement('div');
    taskBody.classList.add('task-body');
    taskBody.style.display = task.isExpanded() ? 'block' : 'none';
    eTask.appendChild(taskBody);

    // Create description element.
    const description = document.createElement('div');
    description.classList.add('description');
    description.setAttribute('data-role', 'description');
    description.innerHTML = task.getDescription();
    taskBody.appendChild(description);

    // Add the new task to the canvas in the correct z-order.
    if (pos) {
      this.adjustTaskZPositionInternal(eTask, pos);
    }

    // Store the mapping between task and its element.
    this.taskMap.set(task.getId(), { task, element: eTask });
  }

  moveTask(task: ITask, position: CanvasCoords, autoAdjustZPosition: boolean = true): void {
    const mapping = this.taskMap.get(task.getId());
    if (!mapping) return;
    const elem = mapping.element;
    elem.style.left = position.x + 'px';
    elem.style.top = position.y + 'px';
    if (autoAdjustZPosition) {
      this.adjustTaskZPositionInternal(elem, position);
    }
  }

  adjustTaskZPosition(task: ITask, position: CanvasCoords): void {
    const mapping = this.taskMap.get(task.getId());
    if (!mapping) return;
    this.adjustTaskZPositionInternal(mapping.element, position);
  }

  // Internal method: same as before but works with an HTMLElement.
  private adjustTaskZPositionInternal(taskElement: HTMLElement, position: { x: number; y: number }): void {
    let taskItem = this.orderedTasks.find((t) => t.element === taskElement);
    if (taskItem) {
      taskItem.position = position;
      this.orderedTasks = this.orderedTasks.filter((t) => t.element !== taskElement);
    } else {
      taskItem = {
        id: parseInt(taskElement.getAttribute('data-id') || '-1'),
        element: taskElement,
        position: position,
      };
    }
    let newIndex = this.orderedTasks.findIndex((t) => {
      return position.y > t.position.y || (position.y === t.position.y && position.x > t.position.x);
    });
    if (newIndex === -1) newIndex = this.orderedTasks.length;
    this.orderedTasks.splice(newIndex, 0, taskItem);
    if (!this.canvas) throw new Error("Canvas not initialized");
    if (newIndex === this.orderedTasks.length - 1) {
      this.canvas.appendChild(taskElement);
    } else {
      this.canvas.insertBefore(taskElement, this.orderedTasks[newIndex + 1].element);
    }
  }

  toggleEditModeForTaskTitle(task: ITask, enable: boolean): void {
    const mapping = this.taskMap.get(task.getId());
    if (!mapping) return;
    const taskElem = mapping.element;
    const titleEl = taskElem.querySelector('[data-role="title"]') as HTMLElement;
    let titleInput = titleEl instanceof HTMLInputElement ? titleEl : null;
    if (enable) {
      if (!titleInput) {
        titleInput = document.createElement('input');
        titleInput.dataset.role = 'title';
        titleInput.type = 'text';
        titleInput.value = titleEl.textContent || '';
        titleInput.style.width = '100%';
        titleEl.replaceWith(titleInput);
        titleInput.focus();
      }
    }
    else {
      if (titleInput) {
        const newTitleEl = document.createElement('div');
        newTitleEl.dataset.role = 'title';
        newTitleEl.classList.add('title');
        newTitleEl.textContent = titleInput.value;
        titleInput.replaceWith(newTitleEl);
      }
    }
  }

  getTaskTitle(task: ITask): string {
    const mapping = this.taskMap.get(task.getId());
    if (!mapping) return '';
    const taskElem = mapping.element;
    const titleEl = taskElem.querySelector('[data-role="title"]') as HTMLElement;
    const titleInput = titleEl instanceof HTMLInputElement ? titleEl : null;
    return titleInput ? titleInput.value : titleEl.textContent || '';
  }

  setTaskTitle(task: ITask, title: string): void {
    const mapping = this.taskMap.get(task.getId());
    if (!mapping) return;
    const taskElem = mapping.element;
    const titleEl = taskElem.querySelector('[data-role="title"]') as HTMLElement;
    const titleInput = titleEl instanceof HTMLInputElement ? titleEl : null;
    if (titleInput) {
      titleInput.value = title;
    }
    else {
      titleEl.textContent = title;
    }
  }

  toggleEditModeForTaskDescription(task: ITask, enable: boolean): void {
    const mapping = this.taskMap.get(task.getId());
    if (!mapping) return;
    const taskElem = mapping.element;
    // Try to find either a normal description or an editor container if we're already editing.
    let descEl = taskElem.querySelector('[data-role="description"]') as HTMLElement;
    if (enable) {
      // If already in edit mode, do nothing.
      if (descEl && descEl.classList.contains('editor-container')) {
        return;
      }
      // Save current HTML content.
      const oldValue = descEl ? descEl.innerHTML : '';
      // Create the container for our Quill editor.
      const editorContainer = document.createElement('div');
      editorContainer.classList.add('editor-container');
      editorContainer.setAttribute('data-role', 'description');
      editorContainer.style.minHeight = '50px';
      // Create an inner element where Quill will attach.
      const editorElement = document.createElement('div');
      editorContainer.appendChild(editorElement);
      // Replace the original description element with the editor container.
      if (descEl && descEl.parentNode) {
        descEl.parentNode.replaceChild(editorContainer, descEl);
      }
      // Initialize Quill.
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
            ['clean']
          ]
        }
      });
      // Set the editor's content and focus.
      quill.root.innerHTML = oldValue;
      quill.focus();
      setTimeout(() => quill.setSelection(quill.getLength(), 0), 0);
      // Adjust the height as text changes.
      const adjustHeight = () => {
        const newHeight = quill.root.scrollHeight;
        editorElement.style.height = newHeight + 'px';
      };
      quill.on('text-change', adjustHeight);
      adjustHeight();
      // Save the Quill instance on the container for later retrieval.
      (editorContainer as any)._quill = quill;
    }
    // If we're disabling edit mode, we need to clean up the Quill editor.
    else {
      // If we're not in edit mode (i.e. not using the editor container), nothing to do.
      if (!descEl || !descEl.classList.contains('editor-container')) {
        return;
      }
      // Get the Quill instance.
      const quill = (descEl as any)._quill;
      if (!quill) return;
      // Grab the updated HTML.
      let newValue = quill.root.innerHTML;
      if (newValue === '<p><br></p>') {
        newValue = '';
      }
      // Create a new description element.
      const newDescEl = document.createElement('div');
      newDescEl.classList.add('description');
      newDescEl.setAttribute('data-role', 'description');
      newDescEl.innerHTML = newValue;
      // Replace the editor container with the new description element.
      descEl.parentNode?.replaceChild(newDescEl, descEl);
    }
  }

  getTaskDescription(task: ITask): string | null {
    const mapping = this.taskMap.get(task.getId());
    if (!mapping) return null;
    const taskElem = mapping.element;
    const descEl = taskElem.querySelector('[data-role="description"]') as HTMLElement;
    if (!descEl) return null;
    if (descEl.classList.contains('editor-container')) {
      const quill = (descEl as any)._quill;
      if (!quill) return null;
      let value = quill.root.innerHTML;
      if (value === '<p><br></p>') {
        value = '';
      }
      return value;
    }
    else {
      return descEl.innerHTML;
    }
  }

  setTaskDescription(task: ITask, description: string): void {
    const mapping = this.taskMap.get(task.getId());
    if (!mapping) return;
    const taskElem = mapping.element;
    // Look for either a plain description or an editor container if in edit mode.
    const descEl = taskElem.querySelector('[data-role="description"]') as HTMLElement;
    if (!descEl) return;
    // If editing, update the Quill editor's content.
    if (descEl.classList.contains('editor-container')) {
      const quill = (descEl as any)._quill;
      if (quill) {
        quill.root.innerHTML = description || '<p><br></p>';
      }
    }
    // If not editing
    else {
      descEl.innerHTML = description;
      if (description.length === 0) {
        const expandSwitch = taskElem.querySelector('[data-role="expand-switch"]') as HTMLElement;
        if (expandSwitch) {
          expandSwitch.classList.add('expand-switch-add');
        }
      }
    }
  }

  toggleTaskCompletion(task: ITask, completed: boolean): void {
    const taskElem = this.getTaskElement(task);
    if (!taskElem) throw new Error("Task element not found");

    const checkboxFill = taskElem.querySelector('.checkbox-fill') as HTMLElement;
    if (checkboxFill) {
      const innerRect = checkboxFill.querySelector('rect[mask]') as SVGRectElement;
      if (innerRect) {
        innerRect.setAttribute('fill-opacity', completed ? '1' : '0.1');
      }
    }
  }

  toggleTaskExpansion(task: ITask, collapsed: boolean): void {
    const taskElem = this.getTaskElement(task);
    if (!taskElem) throw new Error("Task element not found");

    const taskBody = taskElem.querySelector('.task-body') as HTMLElement;
    if (taskBody) {
      taskBody.style.display = collapsed ? 'none' : 'block';
    }
    const expandSwitch = taskElem.querySelector('[data-role="expand-switch"]') as HTMLElement;
    if (expandSwitch) {
      if (collapsed) {
        expandSwitch.classList.remove('expand-switch-expanded');
        if (task.getDescription().length === 0) {
          expandSwitch.classList.add('expand-switch-add');
        }
        else {
          expandSwitch.classList.remove('expand-switch-add');
        }
      }
      else {
        expandSwitch.classList.add('expand-switch-expanded');
        expandSwitch.classList.remove('expand-switch-add');
      }
    }
  }

  removeTask(task: ITask): void {
    if (!this.canvas) throw new Error("Canvas not initialized");

    // Remove from task map and DOM.
    const mapping = this.taskMap.get(task.getId());
    if (mapping) {
      mapping.element.remove();
      this.taskMap.delete(task.getId());
    }

    // Remove from ordered tasks.
    const index = this.orderedTasks.findIndex((t) => t.id === task.getId());
    if (index !== -1) {
      this.orderedTasks.splice(index, 1);
    }

  }

  //────────────────────────────────────────────────────────────
  // Dependency / Arrow methods
  //────────────────────────────────────────────────────────────

  addDependency(dependency: IDependency): Arrow {
    if (!this.canvas) throw new Error("Canvas not initialized");
    const requiredTask = dependency.getRequiredTask();
    const requiredByTask = dependency.getRequiredByTask();
    const key = this.dependencyKey(requiredTask.getId(), requiredByTask.getId());
    const wrapper = new ArrowWrapper(this, requiredTask, requiredByTask, dependency, key, this.canvas);
    this.dependencyMap.set(key, wrapper);
    return wrapper;
  }

  removeDependency(dependency: IDependency): void {
    const key = this.dependencyKey(dependency.getRequiredTask().getId(), dependency.getRequiredByTask().getId());
    const wrapper = this.dependencyMap.get(key);
    if (wrapper) {
      wrapper.remove();
      this.dependencyMap.delete(key);
    }
  }

  createArrow(source: ITask | CanvasCoords, target: ITask | CanvasCoords): Arrow {
    if (!this.canvas) throw new Error("Canvas not initialized");
    return new ArrowWrapper(this, source, target, null, null, this.canvas);
  }

  updateArrow(
    arrow: Arrow,
    options: {
      source: ITask | CanvasCoords | undefined;
      target: ITask | CanvasCoords | undefined;
      isGhostArrow?: boolean;
    } | undefined
  ): void {
    // Resolve the arrow wrapper.
    if (!(arrow instanceof ArrowWrapper)) throw new Error("Invalid arrow");
    const wrapper = arrow as ArrowWrapper;

    // Update Path
    wrapper.update(options?.source || null, options?.target || null);

    // Change color for ghost arrow validation.
    if (options?.isGhostArrow) {
      const updatedSource = options.source ? options.source : wrapper.getSource();
      const updatedTarget = options.target ? options.target : wrapper.getTarget();    
      const validColor = '#55b38888';
      const invalidColor = '#b3555588';
      const invalid = updatedSource instanceof CanvasCoords || updatedTarget instanceof CanvasCoords;
      const color = invalid ? invalidColor : validColor;
      wrapper.setColor(color);
    }
    else {
      wrapper.setColor(ArrowWrapper.defaultColor);
    }

  }

  removeArrow(arrow: Arrow): void {
    (arrow as ArrowWrapper).remove();
  }

  //────────────────────────────────────────────────────────────
  // IControllerPresenter additional methods
  //────────────────────────────────────────────────────────────

  getTaskInfo(element: Element): { task: ITask; component: TaskComponent } | null {
    // Determine which task element this belongs to.
    const taskElem = this.getTaskElementFromChild(element);
    if (!taskElem) return null;
    const idString = taskElem.getAttribute('data-id');
    const id = idString ? parseInt(idString) : null;
    if (!id || !this.taskMap.has(id)) return null;
    const task = this.taskMap.get(id)!.task;

    // Determine the specific component type.
    if (element.closest('[data-role="title"]')) {
      return { task, component: TaskComponent.Title };
    } else if (element.closest('[data-role="description"]')) {
      return { task, component: TaskComponent.Description };
    } else if (element.closest('[data-role="expand-switch"]')) {
      return { task, component: TaskComponent.Collapse };
    } else if (element.closest('[data-role="checkbox"]')) {
      return { task, component: TaskComponent.Completion };
    } else if (element.closest('.task-header')) {
      return { task, component: TaskComponent.Header };
    }
    return { task, component: TaskComponent.Task };
  }

  getTask(element: Element): ITask | null {
    const taskElem = this.getTaskElementFromChild(element);
    if (!taskElem) return null;

    const idString = taskElem.getAttribute('data-id');
    const id = idString ? parseInt(idString) : null;
    return id ? this.taskMap.get(id)!.task : null;
  }

  getDependency(element: Element): IDependency | null {
    const arrowElement = element.closest('[data-role="dependency-arrow"]');
    if (!arrowElement) return null;

    const dataId = arrowElement.getAttribute('data-id');
    if (!dataId) return null;

    const wrapper = this.dependencyMap.get(dataId);
    return wrapper?.dependency || null;
  }

  getContextMenuOption(element: Element): string | null {
    if (!element) return null;
    const eContextMenuItems = element.closest('[data-role="context-menu-item"]');
    return eContextMenuItems ? eContextMenuItems.getAttribute('data-key') : null;
  }

  //────────────────────────────────────────────────────────────
  // Internal helper methods
  //────────────────────────────────────────────────────────────

  /**
   * Retrieves the task element associated with a task.
   * @param task The task to search for.
   * @returns The task HTMLElement or null if not found.
   */
  getTaskElement(task: ITask): HTMLElement | null {
    const mapping = this.taskMap.get(task.getId());
    return mapping ? mapping.element : null;
  }

  //────────────────────────────────────────────────────────────
  // Private helper methods
  //────────────────────────────────────────────────────────────

  /**
   * Finds the closest ancestor element with the 'task' class.
   * @param element The child element to search from.
   * @returns The task HTMLElement or null if not found.
   */
  private getTaskElementFromChild(element: Element): HTMLElement | null {
    return element.closest('.task') as HTMLElement;
  }

  private dependencyKey(id1: number, id2: number): string {
    return id1 + '->' + id2;
  }

}

/**
 * ArrowWrapper wraps the DependencyArrow (which does not implement the new Arrow interface)
 * to provide an implementation of the Arrow interface.
 */
class ArrowWrapper implements Arrow {
  public static readonly defaultColor: string = '#b3b3b3';

  public readonly arrow: ArrowHandler;
  private source: CanvasCoords | ArrowRect;
  private target: CanvasCoords | ArrowRect;

  constructor(
    private presenter: AppPresenter,
    source: ITask | CanvasCoords,
    target: ITask | CanvasCoords,
    public readonly dependency: IDependency | null,
    dependencyKey: string | null,
    canvas: HTMLElement
  ) {
    this.source = this.setSource(source);
    this.target = this.setTarget(target);
    
    this.arrow = DependencyArrow.createArrow(
      canvas,
      this.getArrowSource(),
      this.getArrowTarget(),
      {
        color: ArrowWrapper.defaultColor,
        dataId: dependencyKey || undefined
      }
    );
    canvas.prepend(this.arrow.svg)
  }

  getSource(): ITask | CanvasCoords {
    return this.source instanceof CanvasCoords ? this.source : this.source.task;
  }
  private setSource(value: ITask | CanvasCoords): CanvasCoords | ArrowRect {
    if (value instanceof CanvasCoords) {
      this.source = value;
    }
    else {
      const element = this.presenter.getTaskElement(value) || undefined;
      if (!element) throw new Error("Invalid source");
      this.source = new ArrowRect(value, element);
    }
    return this.source;
  }
  private getArrowSource(): Vector2D | Rectangle {
    if (this.source instanceof CanvasCoords) {
      return this.source.vec;
    }
    else if (!this.source.element)
      throw new Error("Invalid source");
    else {
      return ScreenRect.fromElementBounds(this.source.element).toCanvasRect().rect;
    }
  }

  getTarget(): ITask | CanvasCoords {
    return this.target instanceof CanvasCoords ? this.target : this.target.task;
  }
  private setTarget(value: ITask | CanvasCoords): CanvasCoords | ArrowRect {
    if (value instanceof CanvasCoords) {
      this.target = value;
    }
    else {
      const element = this.presenter.getTaskElement(value) || undefined;
      if (!element) throw new Error("Invalid target");
      this.target = new ArrowRect(value, element);
    }
    return this.target;
  }
  private getArrowTarget(): Vector2D | Rectangle {
    if (this.target instanceof CanvasCoords) {
      return this.target.vec;
    }
    else if (!this.target.element)
      throw new Error("Invalid target");
    else {
      return ScreenRect.fromElementBounds(this.target.element).toCanvasRect().rect;
    }
  }

  update(source: ITask | CanvasCoords | null, target: ITask | CanvasCoords | null): void {
    if (source) this.setSource(source);
    if (target) this.setTarget(target);
    const arrowSource = this.getArrowSource();
    const arrowTarget = this.getArrowTarget();    
    this.arrow.update(arrowSource, arrowTarget);
  }

  setColor(color: string): void {
    this.arrow.setColor(color);
  }

  remove(): void {
    this.arrow.remove();
  }
}

class ArrowRect {
  constructor(
    public readonly task: ITask,
    public readonly element: HTMLElement
  ) { }
}