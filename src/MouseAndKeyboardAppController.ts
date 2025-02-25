import { DependencyArrow } from './DependencyArrow';
import { DOMController } from './DOMController';
import { CustomPanZoom } from './CustomPanZoom';
import { MouseInputInterpreter } from './MouseInputInterpreter';

/**
 * Represents a position in 2D space.
 */
interface Position {
  x: number;
  y: number;
}

/**
 * Callback type for handling an intent.
 */
type IntentCallback = (data: any) => void;

/**
 * Map of intent names to an array of callback functions.
 */
interface Subscriptions {
  [intent: string]: IntentCallback[];
}

/**
 * Represents a movement of a task.
 */
interface TaskMovement {
  taskElement: HTMLElement;
  canvasPosition: Position;
}

/**
 * Provides context for a context menu.
 */
interface ContextMenuContext {
  isOpen: boolean;
  target: EventTarget | null;
  position: Position;
  taskElement?: HTMLElement;
  dependencyElement?: HTMLElement | SVGElement;
}

/**
 * Represents the current state of user controls.
 */
interface ControlState {
  mousePosition: Position;
  mouseMovement: Position;
  leftPressed: boolean;
  rightPressed: boolean;
  middlePressed: boolean;
  leftDownScreenPosition: Position;
  rightDownScreenPosition: Position;
  middleDownScreenPosition: Position;
  leftDownCanvasPosition: Position | null;
  rightDownCanvasPosition: Position | null;
  middleDownCanvasPosition: Position | null;
  keys: { [key: string]: boolean };
  lastEvent: Event | null;
  target: EventTarget | null;
  taskInTitleEditMode: HTMLElement | null;
  taskInDescriptionEditMode: HTMLElement | null;
  taskElementHeldByMouse: HTMLElement | null;
  taskElementHeldByMouseOriginalCanvasPosition: Position;
  taskElementHeldByMouseCurrentCanvasPosition: Position;
  selectedTaskElements: Set<HTMLElement>;
  selectionBoxStart: Position;
  contextMenuContext: ContextMenuContext;
  dependencyCreationMode: string | null;
  dependencyCreationFixedTask: string | null;
  ghostArrow: any;
  mouseIsHoldingDependencyArrow: boolean;
  mouseIsHoldingSingleTask: boolean;
  mouseIsHoldingTaskGroup: boolean;
  mouseIsHoldingCanvas: boolean;
  mouseIsDrawingSelectionBox: boolean;
  taskGroupAnchor?: HTMLElement;
  taskGroupOriginalPositions?: Map<HTMLElement, Position>;
  taskGroupAnchorOriginalMouseCanvasPosition?: Position;
}

// -------------------- Intent subscriptions -------------------- //

const subscriptions: Subscriptions = {
  panCanvas: [],
  createTask: [],
  startEditingTaskTitle: [],
  stopEditingTaskTitle: [],
  startEditingTaskDescription: [],
  stopEditingTaskDescription: [],
  toggleTaskCompletion: [],
  toggleTaskExpansion: [],
  moveTasks: [],
  deleteTasks: [],
  createDependency: [],
  deleteDependency: [],
  undo: [],
  redo: []
};

// -------------------- Snap Grid Constants -------------------- //

/** The size of the snap grid in pixels. */
const SNAP_GRID_SIZE = 40;

/** The minimum distance between a task and a grid line for snapping to occur. */
const SNAP_DISTANCE = 6;

// -------------------- Global Control State -------------------- //

const ControlState: ControlState = {
  mousePosition: { x: 0, y: 0 },
  mouseMovement: { x: 0, y: 0 },
  leftPressed: false,
  rightPressed: false,
  middlePressed: false,
  leftDownScreenPosition: { x: 0, y: 0 },
  rightDownScreenPosition: { x: 0, y: 0 },
  middleDownScreenPosition: { x: 0, y: 0 },
  leftDownCanvasPosition: null,
  rightDownCanvasPosition: null,
  middleDownCanvasPosition: null,
  keys: {},
  lastEvent: null,
  target: null,

  taskInTitleEditMode: null,
  taskInDescriptionEditMode: null,
  taskElementHeldByMouse: null,
  taskElementHeldByMouseOriginalCanvasPosition: { x: 0, y: 0 },
  taskElementHeldByMouseCurrentCanvasPosition: { x: 0, y: 0 },
  selectedTaskElements: new Set<HTMLElement>(),
  selectionBoxStart: { x: 0, y: 0 },
  contextMenuContext: {
    isOpen: false,
    target: null,
    position: { x: 0, y: 0 }
  },

  dependencyCreationMode: null,
  dependencyCreationFixedTask: null,
  ghostArrow: null,

  mouseIsHoldingDependencyArrow: false,
  mouseIsHoldingSingleTask: false,
  mouseIsHoldingTaskGroup: false,
  mouseIsHoldingCanvas: false,
  mouseIsDrawingSelectionBox: false,
};

// -------------------- Public API Functions -------------------- //

/**
 * Registers a callback for a specific intent.
 * @param intentName the name of the intent
 * @param callback the callback to invoke when the intent is recognized
 */
function onIntent(intentName: string, callback: IntentCallback): void {
  subscriptions[intentName].push(callback);
}

/**
 * Invokes all callbacks associated with a given intent.
 * @param intentName the name of the intent
 * @param data the data to pass to the callbacks
 */
function recognizeIntent(intentName: string, data: any): void {
  subscriptions[intentName].forEach(callback => callback(data));
}

let didInit = false;

/** Initializes the application by setting up DOM and input listeners. */
function init(): void {
  if (didInit) return;

  DOMController.init();

  // Initialize mouse input interpreter with virtual event callback.
  MouseInputInterpreter.init((virtualEvent: any) => {
    updateControlState(virtualEvent);
  });

  // Listen for keyboard events.
  ['keydown', 'keyup'].forEach(evt => {
    document.addEventListener(evt, e => updateControlState(e));
  });

  didInit = true;
}

document.addEventListener('DOMContentLoaded', () => {
  init();
});

// -------------------- Internal Functions -------------------- //

/**
 * Updates the global control state based on an event and interprets the resulting intent.
 * @param e the event to process
 */
function updateControlState(e: Event & {
  clientX?: number;
  clientY?: number;
  movementX?: number;
  movementY?: number;
  button?: number;
  type: string;
  key?: string;
  target: EventTarget | null;
}): void {
  ControlState.lastEvent = e;
  if (e.clientX !== undefined && e.clientY !== undefined) {
    ControlState.mousePosition = { x: e.clientX, y: e.clientY };
  }
  ControlState.mouseMovement = { x: e.movementX || 0, y: e.movementY || 0 };
  ControlState.target = e.target;

  // Process mouse button and keyboard events.
  if (e.type === 'mousedown') {
    if (e.button === 0) {
      ControlState.leftPressed = true;
      ControlState.leftDownScreenPosition = { ...ControlState.mousePosition };
      ControlState.leftDownCanvasPosition = DOMController.screenToCanvasPosition(ControlState.mousePosition);
    }
    else if (e.button === 2) {
      ControlState.rightPressed = true;
      ControlState.rightDownScreenPosition = { ...ControlState.mousePosition };
      ControlState.rightDownCanvasPosition = DOMController.screenToCanvasPosition(ControlState.mousePosition);
    }
    else if (e.button === 1) {
      ControlState.middlePressed = true;
      ControlState.middleDownScreenPosition = { ...ControlState.mousePosition };
      ControlState.middleDownCanvasPosition = DOMController.screenToCanvasPosition(ControlState.mousePosition);
    }
  }
  else if (e.type === 'mouseup') {
    if (e.button === 0)
      ControlState.leftPressed = false;
    else if (e.button === 2)
      ControlState.rightPressed = false;
    else if (e.button === 1)
      ControlState.middlePressed = false;
  }
  else if (e.type === 'keydown') {
    if (e.key) ControlState.keys[e.key] = true;
  }
  else if (e.type === 'keyup') {
    if (e.key) ControlState.keys[e.key] = false;
  }

  // After updating state, interpret the intent.
  interpretIntent();
}

/**
 * Interprets the current intent based on the latest event and control state.
 */
function interpretIntent(): void {
  const e = ControlState.lastEvent;
  if (!e) return;

  // Special State: Context Menu is Open
  if (ControlState.contextMenuContext.isOpen) {
    if (e.type === 'click' || e.type === 'dblclick' || e.type === 'mouseup') {
      handleContextMenuSelection();
      return;
    }
    else if (e.type === 'contextmenu') {
      const selected = handleContextMenuSelection();

      // Only return if an option was selected, otherwise we continue to allow another context menu to open.
      if (selected) return;
    }
  }

  // Special State: Holding Ghost (Dependency) Arrow
  if (ControlState.mouseIsHoldingDependencyArrow) {
    if (e.type === 'mousemove') {
      let ghostSnapTarget: string | null = null;
      const potentialTaskElement = DOMController.getTaskElementFromChild(ControlState.target as Element);
      const potentialTaskId = potentialTaskElement ? potentialTaskElement.getAttribute('data-id') : null;
      if (potentialTaskId && potentialTaskId !== ControlState.dependencyCreationFixedTask) {
        ghostSnapTarget = potentialTaskId;
      }
      DOMController.updateGhostArrow(
        ControlState.dependencyCreationMode as string,
        ControlState.ghostArrow,
        ControlState.dependencyCreationFixedTask as string,
        ghostSnapTarget,
        ControlState.mousePosition
      );
    }

    // Create a dependency on left-click
    else if (e.type === 'click' && (e as MouseEvent).button === 0) {
      const taskId = DOMController.getTaskId(ControlState.target as Element);
      if (taskId) {
        recognizeIntent('createDependency', { 
          taskId: taskId, 
          fixedTaskId: ControlState.dependencyCreationFixedTask, 
          mode: ControlState.dependencyCreationMode 
        });
      }

      // Remove the ghost arrow from the canvas if it exists.
      if (ControlState.ghostArrow) {
        ControlState.ghostArrow.remove();
        ControlState.ghostArrow = null;
      }

      // Clear dependency creation state.
      ControlState.dependencyCreationMode = null;
      ControlState.dependencyCreationFixedTask = null;
      ControlState.mouseIsHoldingDependencyArrow = false;
      return;
    }

    // Cancel Dependency Creation on right‑click or Escape.
    else if (
      (e.type === 'contextmenu' && (e as MouseEvent).button === 2) ||
      (e.type === 'keydown' && (e as KeyboardEvent).key === 'Escape')
    ) {
      if (ControlState.ghostArrow) {
        ControlState.ghostArrow.remove();
        ControlState.ghostArrow = null;
      }
      ControlState.dependencyCreationMode = null;
      ControlState.dependencyCreationFixedTask = null;
      ControlState.mouseIsHoldingDependencyArrow = false;
      return;
    }

    return;
  }

  // Special State: Holding Canvas
  if (ControlState.mouseIsHoldingCanvas) {
    if (e.type === 'mousemove') {
      recognizeIntent('panCanvas', { mouseMovement: ControlState.mouseMovement });
    }
    else if (e.type === 'mouseup' && (e as MouseEvent).button === 2) {
      ControlState.mouseIsHoldingCanvas = false;
    }
    return;
  }

  // Special State: Holding Single Task
  if (ControlState.mouseIsHoldingSingleTask) {

    // Drag a Task
    if (e.type === 'mousemove') {
      const mouseCanvasPosition = DOMController.screenToCanvasPosition(ControlState.mousePosition);
      const canvasDragVector = {
        x: mouseCanvasPosition.x - ControlState.leftDownCanvasPosition!.x,
        y: mouseCanvasPosition.y - ControlState.leftDownCanvasPosition!.y
      };
      const newCanvasPosition = {
        x: ControlState.taskElementHeldByMouseOriginalCanvasPosition.x + canvasDragVector.x,
        y: ControlState.taskElementHeldByMouseOriginalCanvasPosition.y + canvasDragVector.y
      };
                
      // Snap to Grid (unless Alt key is held)
      if (SNAP_GRID_SIZE > 0 && !ControlState.keys['Alt']) {
        const snapX = Math.round(newCanvasPosition.x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
        const snapY = Math.round(newCanvasPosition.y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
        const dx = Math.abs(newCanvasPosition.x - snapX);
        const dy = Math.abs(newCanvasPosition.y - snapY);
        if (dx < SNAP_DISTANCE) newCanvasPosition.x = snapX;
        if (dy < SNAP_DISTANCE) newCanvasPosition.y = snapY;
      }

      ControlState.taskElementHeldByMouseCurrentCanvasPosition = newCanvasPosition;
      DOMController.moveTask(ControlState.taskElementHeldByMouse as HTMLElement, newCanvasPosition, false);
    }

    // Drop a Task
    else if (e.type === 'mouseup' && (e as MouseEvent).button === 0) {
      recognizeIntent('moveTasks', {
        taskMovements: [
          {
            taskElement: ControlState.taskElementHeldByMouse,
            canvasPosition: ControlState.taskElementHeldByMouseCurrentCanvasPosition
          }
        ]
      });
      ControlState.mouseIsHoldingSingleTask = false;
      ControlState.taskElementHeldByMouse = null;
    }

    // Cancel Dragging a Task (Right-Click)
    else if (e.type === 'contextmenu' && (e as MouseEvent).button === 2) {
      DOMController.moveTask(ControlState.taskElementHeldByMouse as HTMLElement, ControlState.taskElementHeldByMouseOriginalCanvasPosition);
      ControlState.mouseIsHoldingSingleTask = false;
      ControlState.taskElementHeldByMouse = null;
    }

    // Cancel Dragging a Task (Escape Key)
    else if (e.type === 'keydown' && (e as KeyboardEvent).key === 'Escape') {
      DOMController.moveTask(ControlState.taskElementHeldByMouse as HTMLElement, ControlState.taskElementHeldByMouseOriginalCanvasPosition);
      ControlState.mouseIsHoldingSingleTask = false;
      ControlState.taskElementHeldByMouse = null;
    }

    return;
  }

  // Special State: Holding Task Group
  if (ControlState.mouseIsHoldingTaskGroup) {
    if (e.type === 'mousemove') {
      // Get the current canvas position of the mouse.
      const currentMouseCanvas = DOMController.screenToCanvasPosition(ControlState.mousePosition);

      // Calculate the drag vector for the anchor relative to its initial mouse-down position.
      let dragVector = {
        x: currentMouseCanvas.x - (ControlState.taskGroupAnchorOriginalMouseCanvasPosition as Position).x,
        y: currentMouseCanvas.y - (ControlState.taskGroupAnchorOriginalMouseCanvasPosition as Position).y
      };

      // Compute the new position for the anchor based on its original position plus the drag vector.
      const anchorOriginalPosition = ControlState.taskGroupOriginalPositions!.get(ControlState.taskGroupAnchor as HTMLElement) as Position;
      let newAnchorPosition = {
        x: anchorOriginalPosition.x + dragVector.x,
        y: anchorOriginalPosition.y + dragVector.y
      };

      // Snap to Grid (Unless Alt key is held)
      if (SNAP_GRID_SIZE > 0 && !ControlState.keys['Alt']) {
        const snapX = Math.round(newAnchorPosition.x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
        const snapY = Math.round(newAnchorPosition.y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
        const dx = Math.abs(newAnchorPosition.x - snapX);
        const dy = Math.abs(newAnchorPosition.y - snapY);
        if (dx < SNAP_DISTANCE) newAnchorPosition.x = snapX;
        if (dy < SNAP_DISTANCE) newAnchorPosition.y = snapY;
      }

      // Recalculate the drag vector after snapping.
      dragVector = {
        x: newAnchorPosition.x - anchorOriginalPosition.x,
        y: newAnchorPosition.y - anchorOriginalPosition.y
      };

      // Move the anchor to its new (possibly snapped) position.
      DOMController.moveTask(ControlState.taskGroupAnchor as HTMLElement, newAnchorPosition, false);
      
      // Move each selected task by the same drag vector.
      ControlState.selectedTaskElements.forEach(taskElement => {
        if (taskElement === ControlState.taskGroupAnchor) return;
        const originalPosition = ControlState.taskGroupOriginalPositions!.get(taskElement) as Position;
        const newPosition = {
          x: originalPosition.x + dragVector.x,
          y: originalPosition.y + dragVector.y
        };
        DOMController.moveTask(taskElement, newPosition, false);
      });
    }

    // Drop the Task Group
    else if (e.type === 'mouseup' && (e as MouseEvent).button === 0) {
      const taskMovements: TaskMovement[] = [];
      for (const taskElement of ControlState.selectedTaskElements) {
          const newPosition = DOMController.getTaskPositionOnCanvas(taskElement);
          taskMovements.push({
              taskElement: taskElement,
              canvasPosition: newPosition
          });
      }
      recognizeIntent('moveTasks', { taskMovements });
      ControlState.mouseIsHoldingTaskGroup = false;
      delete ControlState.taskGroupOriginalPositions;
      delete ControlState.taskGroupAnchor;
      delete ControlState.taskGroupAnchorOriginalMouseCanvasPosition;
    }

    // Cancel Dragging the Task Group (Right-Click or Escape)
    else if ((e.type === 'contextmenu' && (e as MouseEvent).button === 2) ||
             (e.type === 'keydown' && (e as KeyboardEvent).key === 'Escape')) {
      ControlState.taskGroupOriginalPositions!.forEach((originalPosition, taskElement) => {
        DOMController.moveTask(taskElement, originalPosition);
      });
      ControlState.mouseIsHoldingTaskGroup = false;
      delete ControlState.taskGroupOriginalPositions;
      delete ControlState.taskGroupAnchor;
      delete ControlState.taskGroupAnchorOriginalMouseCanvasPosition;
    }
    return;
  }

  // Special State: Drawing Selection Box
  if (ControlState.mouseIsDrawingSelectionBox) {
    if (e.type === 'mousemove') {
      DOMController.moveSelectionBox(ControlState.selectionBoxStart, ControlState.mousePosition);
    }
    else if (e.type === 'mouseup' && (e as MouseEvent).button === 0) {
      const taskElementsInSelectionBox = DOMController.getTaskElementsInArea(ControlState.selectionBoxStart, ControlState.mousePosition);
      const deselect = ControlState.keys['Alt'] || ControlState.keys['Meta'];
      for (const taskElement of taskElementsInSelectionBox) {
        if (deselect) {
            deselectTask(taskElement);
        }
        else {
            selectTask(taskElement);
        }
      }
      releaseSelectionBox();
    }
    else if (e.type === 'contextmenu' && (e as MouseEvent).button === 2) {
      releaseSelectionBox();
    }
    else if (e.type === 'keydown' && (e as KeyboardEvent).key === 'Escape') {
      releaseSelectionBox();
    }
    return;
  }

  // Normal State: No Special State (from here on)

  if (e.type === 'mousedown') {
    if ((e as MouseEvent).button === 0) {
      const eTask = DOMController.getTaskElementFromChild(ControlState.target as Element);
      
      // Grab a Task (or Task Group)
      if (eTask) {
        let taskIsPartOfSelection = ControlState.selectedTaskElements.has(eTask);
        if (!taskIsPartOfSelection && ControlState.keys['Shift']) {
          selectTask(eTask);
          taskIsPartOfSelection = true;
        }

        if (taskIsPartOfSelection) {
          tryGrabTaskGroup(eTask);
          return;
        }
        else {
          tryGrabSingleTask(eTask);
          return;
        }
      }

      // Start Drawing a Selection Box
      else {
        if (tryGrabSelectionBox()) {
          ControlState.selectionBoxStart = { ...ControlState.mousePosition };
          DOMController.moveSelectionBox(ControlState.selectionBoxStart, ControlState.mousePosition);
          DOMController.showSelectionBox();

          if (!ControlState.keys['Shift']) {
            deselectAllTasks();
          }

          return;
        }
      }
    }

    // Grab the Canvas
    else if ((e as MouseEvent).button === 2) {
      tryGrabCanvas();
      return;
    }

    return;
  }

  // Left-Click or Double-Click
  if ((e.type === 'click' || e.type === 'dblclick') && (e as MouseEvent).button === 0) {
    const eTask = DOMController.getTaskElementFromChild(ControlState.target as Element);

    // Toggle Task Selection (Shift-Click)
    if (eTask && ControlState.keys['Shift']) {
      if (ControlState.selectedTaskElements.has(eTask)) {
        deselectTask(eTask);
      }
      else {
        selectTask(eTask);
      }
      return;
    }

    deselectAllTasks();

    if (eTask) {

      // Toggle Expense/Collapse Task (Double-Click on Task Header)
      if (e.type === 'dblclick') {
        const eTaskHeader = DOMController.getTaskHeaderElementFromChild(ControlState.target as Element);
        if (eTaskHeader) {
          recognizeIntent('toggleTaskExpansion', { taskElement: eTask });
          return;
        }
      }

      // Edit Task Title
      const eTaskTitle = DOMController.getTaskTitleElementFromChild(ControlState.target as Element);
      if (eTaskTitle) {
        recognizeIntent('startEditingTaskTitle', { taskElement: eTask });
        return;
      }

      // Edit Task Description
      const eTaskDescription = DOMController.getTaskDescriptionElementFromChild(ControlState.target as Element);
      if (eTaskDescription) {
        recognizeIntent('startEditingTaskDescription', { taskElement: eTask });
        return;
      }

      // Toggle Expand/Collapse Task
      const eTaskExpand = DOMController.getTaskExpandElementFromChild(ControlState.target as Element);
      if (eTaskExpand) {
        recognizeIntent('toggleTaskExpansion', { taskElement: eTask });
        return;
      }

      // Toggle Complete/Incomplete Task
      const eTaskCompletion = DOMController.getTaskCompletionCheckboxFromChild(ControlState.target as Element);
      if (eTaskCompletion) {
        recognizeIntent('toggleTaskCompletion', { taskElement: eTask });
        return;
      }

      // Select Task (Single-Click)
      if (e.type === 'click') {
        selectTask(eTask);
        return;
      }

    }

    // Add Task (Double-Click)
    else if (e.type === 'dblclick') {

      // (floor) Snap the mouse position to the grid.
      const snappedPosition = {
        x: Math.floor(ControlState.mousePosition.x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE,
        y: Math.floor(ControlState.mousePosition.y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE
      };

      recognizeIntent('createTask', { position: snappedPosition });
      return;
    }

    return;
  }

  // Right-Click (Context Menu)
  if (e.type === 'contextmenu') {
            
    // Show Task Context Menu
    const eTask = DOMController.getTaskElementFromChild(ControlState.target as Element);
    if (eTask) {
      let options: [string, string][] = [
        ['REQUIRES_DEPENDENCY', "Requires Dependency"],
        ['REQUIRED_BY_DEPENDENCY', "Required By Dependency"]
      ];
      if (ControlState.selectedTaskElements.size > 0 && ControlState.selectedTaskElements.has(eTask)) {
        options.unshift(['DELETE_SELECTED_TASKS', "Delete Selected Tasks"]);
      }
      else {
        options.unshift(['DELETE_TASK', "Delete Task"]);
      }
      DOMController.showContextMenu(ControlState.mousePosition, options);
      ControlState.contextMenuContext = {
        isOpen: true,
        target: ControlState.target,
        position: { ...ControlState.mousePosition },
        taskElement: eTask
      };
      return;
    }

    // Show Dependency Context Menu
    const eDependency = DOMController.getDependencyArrowElementFromChild(ControlState.target as Element);
    if (eDependency) {
      DOMController.showContextMenu(ControlState.mousePosition, [['DELETE_DEPENDENCY', "Delete Dependency"]]);
      ControlState.contextMenuContext = {
        isOpen: true,
        target: ControlState.target,
        position: { ...ControlState.mousePosition },
        dependencyElement: eDependency
      };
      return;
    }

    // Show Canvas Context Menu
    else {
      DOMController.showContextMenu(ControlState.mousePosition, [['ADD_TASK', "Add Task"]]);
      ControlState.contextMenuContext = {
        isOpen: true,
        target: ControlState.target,
        position: { ...ControlState.mousePosition }
      };
      return;
    }
  }

  if (e.type === 'keydown') {

    // Select all tasks
    if (ControlState.keys['a'] && (ControlState.keys['Control'] || ControlState.keys['Meta'])) {
      selectAllTasks();
      return;
    }

    // Delete selected tasks
    if (ControlState.keys['Delete'] || ControlState.keys['Backspace']) {
      recognizeIntent('deleteTasks', { taskElements: Array.from(ControlState.selectedTaskElements) });
      return;
    }

    return;
  }

  return; // End of HandleInput function.
}

/**
 * Handles a selection made from a context menu.
 * @returns true if an option was selected, false otherwise
 */
function handleContextMenuSelection(): boolean {
  const option = DOMController.getContextMenuOption(ControlState.target as Element);
  if (option === 'ADD_TASK') {
    recognizeIntent('createTask', { position: ControlState.contextMenuContext.position });
  }
  else if (option === 'DELETE_TASK') {
    recognizeIntent('deleteTasks', { taskElement: ControlState.contextMenuContext.taskElement });
  }
  else if (option === 'DELETE_SELECTED_TASKS') {
    recognizeIntent('deleteTasks', { taskElements: Array.from(ControlState.selectedTaskElements) });
  }
  else if (option === 'REQUIRES_DEPENDENCY') {
    // For "Requires Dependency", we treat the fixed task as the one to which another task will be attached (mode 'target')
    ControlState.dependencyCreationMode = 'target';
    ControlState.dependencyCreationFixedTask = ControlState.contextMenuContext.taskElement!.getAttribute('data-id');
    tryGrabDependencyArrow();
  }
  else if (option === 'REQUIRED_BY_DEPENDENCY') {
    // For "Required By Dependency", we treat the fixed task as the one that requires the dependency (mode 'source')
    ControlState.dependencyCreationMode = 'source';
    ControlState.dependencyCreationFixedTask = ControlState.contextMenuContext.taskElement!.getAttribute('data-id');
    tryGrabDependencyArrow();
  }
  else if (option === 'DELETE_DEPENDENCY') {
    recognizeIntent('deleteDependency', { dependencyElement: ControlState.contextMenuContext.dependencyElement });
  }

  // Reset context menu state.
  ControlState.contextMenuContext = {
    isOpen: false,
    target: null,
    position: { x: 0, y: 0 }
  };

  DOMController.hideContextMenu();

  return option != null;
}

/**
 * Checks whether the mouse is currently holding any object.
 * @returns true if something is held, false otherwise
 */
function mouseIsHoldingSomething(): boolean {
  return (
    ControlState.mouseIsHoldingSingleTask ||
    ControlState.mouseIsHoldingTaskGroup ||
    ControlState.mouseIsHoldingCanvas ||
    ControlState.mouseIsHoldingDependencyArrow ||
    ControlState.mouseIsDrawingSelectionBox
  );
}

/**
 * Releases all current mouse holds and resets their state.
 */
function releaseAllMouseHolds(): void {
  if (ControlState.mouseIsHoldingDependencyArrow) {
    ControlState.mouseIsHoldingDependencyArrow = false;
  }
  if (ControlState.mouseIsHoldingSingleTask) {
    ControlState.mouseIsHoldingSingleTask = false;
    ControlState.taskElementHeldByMouse = null;
  }
  if (ControlState.mouseIsHoldingTaskGroup) {
    ControlState.mouseIsHoldingTaskGroup = false;
  }
  if (ControlState.mouseIsHoldingCanvas) {
    ControlState.mouseIsHoldingCanvas = false;
  }
  if (ControlState.mouseIsDrawingSelectionBox) {
    releaseSelectionBox();
  }
}

/**
 * Attempts to grab a single task element for dragging.
 * @param taskElement the task element to grab
 * @returns true if successful, false otherwise
 */
function tryGrabSingleTask(taskElement: HTMLElement): boolean {
  if (ControlState.mouseIsHoldingSingleTask && ControlState.taskElementHeldByMouse === taskElement)
    return true;
  if (mouseIsHoldingSomething())
    return false;

  ControlState.mouseIsHoldingSingleTask = true;
  ControlState.taskElementHeldByMouse = taskElement;
  ControlState.taskElementHeldByMouseOriginalCanvasPosition = DOMController.getTaskPositionOnCanvas(taskElement);

  // Move the task to the front for dragging
  DOMController.adjustTaskZPosition(taskElement, { x: 0, y: 0 });
  return true;
}

/**
 * Attempts to grab a group of tasks for group dragging.
 * @param anchorTask the task element to serve as the drag anchor
 * @returns true if successful, false otherwise
 */
function tryGrabTaskGroup(anchorTask: HTMLElement): boolean {
  if (ControlState.mouseIsHoldingTaskGroup)
    return true;
  if (mouseIsHoldingSomething())
    return false;
  if (ControlState.selectedTaskElements.size === 0)
    return false;
    
  ControlState.mouseIsHoldingTaskGroup = true;
  ControlState.taskGroupAnchor = anchorTask;

  // Bring the anchor task to the front.
  DOMController.adjustTaskZPosition(anchorTask, { x: 0, y: 0 });

  // Record the original positions of each selected task.
  ControlState.taskGroupOriginalPositions = new Map();
  for (const taskElement of ControlState.selectedTaskElements) {
    ControlState.taskGroupOriginalPositions.set(taskElement, DOMController.getTaskPositionOnCanvas(taskElement));
  }
  
  // Record the initial mouse position in canvas coordinates.
  ControlState.taskGroupAnchorOriginalMouseCanvasPosition = DOMController.screenToCanvasPosition(ControlState.mousePosition);
  return true;
}

/**
 * Attempts to grab the canvas for panning.
 * @returns true if successful, false otherwise
 */
function tryGrabCanvas(): boolean {
  if (ControlState.mouseIsHoldingCanvas)
    return true;
  if (mouseIsHoldingSomething())
    return false;

  ControlState.mouseIsHoldingCanvas = true;
  return true;
}

/**
 * Attempts to start dependency arrow creation.
 * @returns true if successful, false otherwise
 */
function tryGrabDependencyArrow(): boolean {
  if (ControlState.mouseIsHoldingDependencyArrow)
    return true;
  if (mouseIsHoldingSomething())
    return false;

  ControlState.mouseIsHoldingDependencyArrow = true;
  const canvas = DOMController.getCanvas();
  const fixedTaskId = ControlState.dependencyCreationFixedTask;
  const fixedEl = canvas.querySelector(`.task[data-id="${fixedTaskId}"]`) as HTMLElement;
  if (!fixedEl) return false;
  const canvasRect = canvas.getBoundingClientRect();
  const rect = fixedEl.getBoundingClientRect();
  const fixedPoint = { x: rect.left + rect.width / 2 - canvasRect.left, y: rect.top + rect.height / 2 - canvasRect.top };
  if (ControlState.dependencyCreationMode === 'target') {
    // In target mode, ghost arrow goes from the fixed element toward the mouse.
    ControlState.ghostArrow = DependencyArrow.createArrow(canvas, fixedEl, fixedPoint, { color: "#b3555588", pzZoomFactor: CustomPanZoom.getScale() });
  }
  else if (ControlState.dependencyCreationMode === 'source') {
    // In source mode, ghost arrow goes from the fixed point to the fixed element.
    ControlState.ghostArrow = DependencyArrow.createArrow(canvas, fixedPoint, fixedEl, { color: "#b3555588", pzZoomFactor: CustomPanZoom.getScale() });
  }
  return true;
}

/**
 * Attempts to start drawing a selection box.
 * @returns true if successful, false otherwise
 */
function tryGrabSelectionBox(): boolean {
  if (ControlState.mouseIsDrawingSelectionBox)
    return true;
  if (mouseIsHoldingSomething())
    return false;

  ControlState.mouseIsDrawingSelectionBox = true;
  ControlState.selectionBoxStart = { ...ControlState.mousePosition };
  DOMController.moveSelectionBox(ControlState.selectionBoxStart, ControlState.mousePosition);
  DOMController.showSelectionBox();
  return true;
}

/**
 * Releases the selection box.
 */
function releaseSelectionBox(): void {
  DOMController.hideSelectionBox();
  ControlState.mouseIsDrawingSelectionBox = false;
}

/**
 * Selects a task element.
 * @param taskElement the task element to select
 */
function selectTask(taskElement: HTMLElement): void {
  ControlState.selectedTaskElements.add(taskElement);
  DOMController.toggleTaskHighlight(taskElement, true);
}

/**
 * Selects all task elements.
 */
function selectAllTasks(): void {
  DOMController.getAllTaskElements().forEach(taskElement => selectTask(taskElement));
}

/**
 * Deselects a specific task element.
 * @param taskElement the task element to deselect
 */
function deselectTask(taskElement: HTMLElement): void {
  ControlState.selectedTaskElements.delete(taskElement);
  DOMController.toggleTaskHighlight(taskElement, false);
}

/**
 * Deselects all task elements.
 */
function deselectAllTasks(): void {
  ControlState.selectedTaskElements.forEach(taskElement => DOMController.toggleTaskHighlight(taskElement, false));
  ControlState.selectedTaskElements.clear();
}

// -------------------- Exported Module -------------------- //

export const MouseAndKeyboardAppController = {
  init,
  onIntent
};
