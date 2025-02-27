import { Vector2D } from '../Abstract/Math';
import { DependencyArrow } from '../Presenter/DependencyArrow';
import { DOMController } from '../Presenter/DOMController';
import { CustomPanZoom } from '../Presenter/CustomPanZoom';
import { MouseInputInterpreter } from './Input/MouseInputInterpreter';
import { AppController, IntentData_ChangeTaskDescription, IntentData_ChangeTaskTitle, IntentData_CreateDependency, IntentData_CreateTask, IntentData_DeleteDependency, IntentData_DeleteTasks, IntentData_MoveTask, IntentData_MoveTasks, IntentData_ToggleTaskCompletion, IntentData_ToggleTaskExpansion } from './AppController';

/**
 * Provides context for a context menu.
 */
interface ContextMenuContext {
  /** The target of the event that triggered the context menu */
  target: EventTarget | null;

  /** The screen position where the context menu was opened */
  position: Vector2D;

  /** The task element associated with the context menu */
  taskElement?: HTMLElement;

  /** The dependency element associated with the context menu */
  dependencyElement?: HTMLElement | SVGElement;
}

/**
 * Represents the current state of user controls.
 */
interface ControlState {

  /** The current position of the cursor in screen space */
  mousePosition: Vector2D;

  /** The movement vector of the cursor (`mousemove` events only) */
  mouseMovement: Vector2D;

  /** Whether the left mouse button is pressed */
  leftPressed: boolean;

  /** Whether the right mouse button is pressed */
  rightPressed: boolean;

  /** Whether the middle mouse button is pressed */
  middlePressed: boolean;

  /** The screen position where the left mouse button was pressed */
  leftDownScreenPosition: Vector2D;

  /** The screen position where the right mouse button was pressed */
  rightDownScreenPosition: Vector2D;

  /** The screen position where the middle mouse button was pressed */
  middleDownScreenPosition: Vector2D;

  /** The canvas position where the left mouse button was pressed */
  leftDownCanvasPosition: Vector2D | null;

  /** The canvas position where the right mouse button was pressed */
  rightDownCanvasPosition: Vector2D | null;

  /** The canvas position where the middle mouse button was pressed */
  middleDownCanvasPosition: Vector2D | null;

  /** A dictionary mapping keys to their down state (`true` means the key is down) */
  keys: { [key: string]: boolean };

  /** The last mouse or keyboard event that occurred */
  lastEvent: Event | null;

  /** The target of the last event */
  target: EventTarget | null;

  /** If a task title is being edited, this is the element of the task whose title is being edited, otherwise `null` */
  taskInTitleEditMode: HTMLElement | null;

  /** If a task description is being edited, this is the element of the task whose description is being edited, otherwise `null` */
  taskInDescriptionEditMode: HTMLElement | null;

  /** The task element currently held by the mouse */
  taskElementHeldByMouse: HTMLElement | null;

  /** The original canvas position of the task element currently held by the mouse */
  taskElementHeldByMouseOriginalCanvasPosition: Vector2D;

  /** The current canvas position of the task element currently held by the mouse */
  taskElementHeldByMouseCurrentCanvasPosition: Vector2D;

  /** The set of elements of all tasks that are currently selected */
  selectedTaskElements: Set<HTMLElement>;

  /** The position where the selection box started */
  selectionBoxStart: Vector2D;

  /** Holds information about the active context menu */
  contextMenuContext: ContextMenuContext | null;

  /** The task element to which the ghost dependency arrow is fixed */
  dependencyCreationFirstTask: HTMLElement | null;

  /** Indicates the direction of the dependency being created. So `true` means the arrow tip will follow the cursor. */
  dependencyCreationFirstTaskIsRequired: boolean;

  /** The ghost dependency arrow element */
  ghostArrow: any;

  /** Whether the mouse is currently holding a dependency arrow */
  mouseIsHoldingDependencyArrow: boolean;

  /** Whether the mouse is currently holding a single task */
  mouseIsHoldingSingleTask: boolean;

  /** Whether the mouse is currently holding a task group */
  mouseIsHoldingTaskGroup: boolean;

  /** Whether the mouse is currently holding the canvas */
  mouseIsHoldingCanvas: boolean;

  /** Whether the mouse is currently drawing a selection box */
  mouseIsDrawingSelectionBox: boolean;

  /** The anchor task element of the task group being dragged */
  taskGroupAnchor?: HTMLElement;

  /** The original positions of all tasks in the task group being dragged */
  taskGroupOriginalPositions?: Map<HTMLElement, Vector2D>;

  /** The original mouse canvas position of the task group anchor */
  taskGroupAnchorOriginalMouseCanvasPosition?: Vector2D;
}

// -------------------- Snap Grid Constants -------------------- //

/** The size of the snap grid in pixels. */
const SNAP_GRID_SIZE = 40;

/** The minimum distance between a task and a grid line for snapping to occur. */
const SNAP_DISTANCE = 6;

// -------------------- Global Control State -------------------- //

const ControlState: ControlState = {
  mousePosition: new Vector2D(0, 0),
  mouseMovement: new Vector2D(0, 0),
  leftPressed: false,
  rightPressed: false,
  middlePressed: false,
  leftDownScreenPosition: new Vector2D(0, 0),
  rightDownScreenPosition: new Vector2D(0, 0),
  middleDownScreenPosition: new Vector2D(0, 0),
  leftDownCanvasPosition: null,
  rightDownCanvasPosition: null,
  middleDownCanvasPosition: null,
  keys: {},
  lastEvent: null,
  target: null,

  taskInTitleEditMode: null,
  taskInDescriptionEditMode: null,
  taskElementHeldByMouse: null,
  taskElementHeldByMouseOriginalCanvasPosition: new Vector2D(0, 0),
  taskElementHeldByMouseCurrentCanvasPosition: new Vector2D(0, 0),
  selectedTaskElements: new Set<HTMLElement>(),
  selectionBoxStart: new Vector2D(0, 0),
  contextMenuContext: null,

  dependencyCreationFirstTask: null,
  dependencyCreationFirstTaskIsRequired: false,
  ghostArrow: null,

  mouseIsHoldingDependencyArrow: false,
  mouseIsHoldingSingleTask: false,
  mouseIsHoldingTaskGroup: false,
  mouseIsHoldingCanvas: false,
  mouseIsDrawingSelectionBox: false,
};

// -------------------- Exported Module -------------------- //

class AppControllerImplementation implements AppController {
  public init() {
    init();
  }
  public onCreateTask?: (data: IntentData_CreateTask) => void;
  public onToggleTaskCompletion?: (data: IntentData_ToggleTaskCompletion) => void;
  public onToggleTaskExpansion?: (data: IntentData_ToggleTaskExpansion) => void;
  public onChangeTaskTitle?: (data: IntentData_ChangeTaskTitle) => void;
  public onChangeTaskDescription?: (data: IntentData_ChangeTaskDescription) => void;
  public onMoveTasks?: (data: IntentData_MoveTasks) => void;
  public onDeleteTasks?: (data: IntentData_DeleteTasks) => void;
  public onCreateDependency?: (data: IntentData_CreateDependency) => void;
  public onDeleteDependency?: (data: IntentData_DeleteDependency) => void;
  public onUndo?: () => void;
  public onRedo?: () => void;
}

export const MouseAndKeyboardAppController = new AppControllerImplementation();

// -------------------- Public API Functions -------------------- //

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
    ControlState.mousePosition = new Vector2D(e.clientX, e.clientY);
  }
  ControlState.mouseMovement = new Vector2D(e.movementX || 0, e.movementY || 0);
  ControlState.target = e.target;

  // Process mouse button and keyboard events.
  if (e.type === 'mousedown') {
    if (e.button === 0) {
      ControlState.leftPressed = true;
      ControlState.leftDownScreenPosition = ControlState.mousePosition;
      ControlState.leftDownCanvasPosition = DOMController.screenToCanvasPosition(ControlState.mousePosition);
    }
    else if (e.button === 2) {
      ControlState.rightPressed = true;
      ControlState.rightDownScreenPosition = ControlState.mousePosition;
      ControlState.rightDownCanvasPosition = DOMController.screenToCanvasPosition(ControlState.mousePosition);
    }
    else if (e.button === 1) {
      ControlState.middlePressed = true;
      ControlState.middleDownScreenPosition = ControlState.mousePosition;
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
  if (ControlState.contextMenuContext) {
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
      let ghostSnapTarget: HTMLElement | null = null;
      const potentialTaskElement = DOMController.getTaskElementFromChild(ControlState.target as Element);
      if (potentialTaskElement && potentialTaskElement !== ControlState.dependencyCreationFirstTask) {
        ghostSnapTarget = potentialTaskElement
      }
      DOMController.updateGhostArrow(
        ControlState.ghostArrow,
        ControlState.dependencyCreationFirstTask!,
        ControlState.dependencyCreationFirstTaskIsRequired,
        ghostSnapTarget,
        ControlState.mousePosition
      );
    }

    // Create a dependency on left-click
    else if (e.type === 'click' && (e as MouseEvent).button === 0) {
      const secondTask = DOMController.getTaskElementFromChild(ControlState.target as Element);
      if (secondTask) {
        if (!(ControlState.dependencyCreationFirstTask instanceof Element)) throw new Error('First task is not an element');
        const firstTask = ControlState.dependencyCreationFirstTask;
        MouseAndKeyboardAppController.onCreateDependency?.({
          requiredTaskElement: ControlState.dependencyCreationFirstTaskIsRequired ? firstTask : secondTask,
          requiredByTaskElement: ControlState.dependencyCreationFirstTaskIsRequired ? secondTask : firstTask
        });
      }

      // Remove the ghost arrow from the canvas if it exists.
      if (ControlState.ghostArrow) {
        ControlState.ghostArrow.remove();
        ControlState.ghostArrow = null;
      }

      // Clear dependency creation state.
      ControlState.dependencyCreationFirstTask = null;
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
      ControlState.dependencyCreationFirstTask = null;
      ControlState.mouseIsHoldingDependencyArrow = false;
      return;
    }

    return;
  }

  // Special State: Holding Canvas
  if (ControlState.mouseIsHoldingCanvas) {
    if (e.type === 'mousemove') {
      // TODO: Implement panning
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

      ControlState.taskElementHeldByMouseCurrentCanvasPosition = new Vector2D(newCanvasPosition.x, newCanvasPosition.y);
      DOMController.moveTask(ControlState.taskElementHeldByMouse as HTMLElement, newCanvasPosition, false);
    }

    // Drop a Task
    else if (e.type === 'mouseup' && (e as MouseEvent).button === 0) {
      if (ControlState.taskElementHeldByMouse) {
        MouseAndKeyboardAppController.onMoveTasks?.({
          taskMovements: [
            {
              taskElement: ControlState.taskElementHeldByMouse,
              canvasPosition: ControlState.taskElementHeldByMouseCurrentCanvasPosition
            }
          ]
        });
      }
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
      const mousePositionOnCanvas = DOMController.screenToCanvasPosition(ControlState.mousePosition);

      // Calculate the drag vector for the anchor relative to its initial mouse-down position.
      let dragVector = mousePositionOnCanvas.sub(ControlState.taskGroupAnchorOriginalMouseCanvasPosition!);

      // Compute the new position for the anchor based on its original position plus the drag vector.
      const anchorOriginalPosition = ControlState.taskGroupOriginalPositions!.get(ControlState.taskGroupAnchor!)!;
      let newAnchorPosition = anchorOriginalPosition.add(dragVector);

      // Snap to Grid (Unless Alt key is held)
      if (SNAP_GRID_SIZE > 0 && !ControlState.keys['Alt']) {
        const snapX = Math.round(newAnchorPosition.x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
        const snapY = Math.round(newAnchorPosition.y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
        const dx = Math.abs(newAnchorPosition.x - snapX);
        const dy = Math.abs(newAnchorPosition.y - snapY);
        newAnchorPosition = new Vector2D(
          dx < SNAP_DISTANCE ? snapX : newAnchorPosition.x,
          dy < SNAP_DISTANCE ? snapY : newAnchorPosition.y
        );
      }

      // Recalculate the drag vector after snapping.
      dragVector = newAnchorPosition.sub(anchorOriginalPosition);

      // Move the anchor to its new (possibly snapped) position.
      DOMController.moveTask(ControlState.taskGroupAnchor as HTMLElement, newAnchorPosition, false);

      // Move each selected task by the same drag vector.
      ControlState.selectedTaskElements.forEach(taskElement => {
        if (taskElement === ControlState.taskGroupAnchor) return;
        const originalPosition = ControlState.taskGroupOriginalPositions!.get(taskElement)!;
        const newPosition = {
          x: originalPosition.x + dragVector.x,
          y: originalPosition.y + dragVector.y
        };
        DOMController.moveTask(taskElement, newPosition, false);
      });
    }

    // Drop the Task Group
    else if (e.type === 'mouseup' && (e as MouseEvent).button === 0) {
      const taskMovements: IntentData_MoveTask[] = [];
      for (const taskElement of ControlState.selectedTaskElements) {
        const newPosition = DOMController.getTaskPositionOnCanvas(taskElement);
        taskMovements.push({
          taskElement: taskElement,
          canvasPosition: newPosition
        });
      }
      MouseAndKeyboardAppController.onMoveTasks?.({ taskMovements });
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
          ControlState.selectionBoxStart = ControlState.mousePosition;
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
          MouseAndKeyboardAppController.onToggleTaskExpansion?.({ taskElement: eTask });
          return;
        }
      }

      // Edit Task Title
      const eTaskTitle = DOMController.getTaskTitleElementFromChild(ControlState.target as Element);
      if (eTaskTitle) {
        DOMController.editTaskTitle(eTask, (oldValue: string, newValue: string): void => {
          MouseAndKeyboardAppController.onChangeTaskTitle?.({ taskElement: eTask, newTitle: newValue });
        });
        return;
      }

      // Edit Task Description
      const eTaskDescription = DOMController.getTaskDescriptionElementFromChild(ControlState.target as Element);
      if (eTaskDescription) {
        DOMController.editTaskDescription(eTask, (oldValue: string, newValue: string): void => {
          MouseAndKeyboardAppController.onChangeTaskDescription?.({ taskElement: eTask, newDescription: newValue });
        });
        return;
      }

      // Toggle Expand/Collapse Task (Button Click)
      const eTaskExpand = DOMController.getTaskExpandElementFromChild(ControlState.target as Element);
      if (eTaskExpand) {
        MouseAndKeyboardAppController.onToggleTaskExpansion?.({ taskElement: eTask });
        return;
      }

      // Toggle Complete/Incomplete Task
      const eTaskCompletion = DOMController.getTaskCompletionCheckboxFromChild(ControlState.target as Element);
      if (eTaskCompletion) {
        MouseAndKeyboardAppController.onToggleTaskCompletion?.({ taskElement: eTask });
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
      // TODO: [BUG] Snapping calculation needs to take place in canvas space - not screen space.
      const snappedPosition = new Vector2D(
        Math.floor(ControlState.mousePosition.x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE,
        Math.floor(ControlState.mousePosition.y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE
      );

      MouseAndKeyboardAppController.onCreateTask?.({ canvasPosition: snappedPosition });
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
        target: ControlState.target,
        position: ControlState.mousePosition,
        taskElement: eTask
      };
      return;
    }

    // Show Dependency Context Menu
    const eDependency = DOMController.getDependencyArrowElementFromChild(ControlState.target as Element);
    if (eDependency) {
      DOMController.showContextMenu(ControlState.mousePosition, [['DELETE_DEPENDENCY', "Delete Dependency"]]);
      ControlState.contextMenuContext = {
        target: ControlState.target,
        position: ControlState.mousePosition,
        dependencyElement: eDependency
      };
      return;
    }

    // Show Canvas Context Menu
    else {
      DOMController.showContextMenu(ControlState.mousePosition, [['ADD_TASK', "Add Task"]]);
      ControlState.contextMenuContext = {
        target: ControlState.target,
        position: ControlState.mousePosition
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
      const taskElements = Array.from(ControlState.selectedTaskElements);
      ControlState.selectedTaskElements.clear();
      MouseAndKeyboardAppController.onDeleteTasks?.({ taskElements });
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
  if (ControlState.contextMenuContext === null) return false;

  const option = DOMController.getContextMenuOption(ControlState.target as Element);
  if (option === 'ADD_TASK') {
    MouseAndKeyboardAppController.onCreateTask?.({ canvasPosition: ControlState.contextMenuContext.position });
  }
  else if (option === 'DELETE_TASK') {
    if (ControlState.contextMenuContext.taskElement) {
      ControlState.selectedTaskElements.delete(ControlState.contextMenuContext.taskElement);
      MouseAndKeyboardAppController.onDeleteTasks?.({ taskElements: [ControlState.contextMenuContext.taskElement] });
    }
  }
  else if (option === 'DELETE_SELECTED_TASKS') {
    const taskElements = Array.from(ControlState.selectedTaskElements);
    ControlState.selectedTaskElements.clear();
    MouseAndKeyboardAppController.onDeleteTasks?.({ taskElements });
  }
  else if (option === 'REQUIRES_DEPENDENCY') {
    if (!ControlState.contextMenuContext.taskElement) throw new Error('Task element is null');
    ControlState.dependencyCreationFirstTask = ControlState.contextMenuContext.taskElement;
    ControlState.dependencyCreationFirstTaskIsRequired = false;
    tryGrabDependencyArrow();
  }
  else if (option === 'REQUIRED_BY_DEPENDENCY') {
    if (!ControlState.contextMenuContext.taskElement) throw new Error('Task element is null');
    ControlState.dependencyCreationFirstTask = ControlState.contextMenuContext.taskElement;
    ControlState.dependencyCreationFirstTaskIsRequired = true;
    tryGrabDependencyArrow();
  }
  else if (option === 'DELETE_DEPENDENCY') {
    if (ControlState.contextMenuContext.dependencyElement) {
      MouseAndKeyboardAppController.onDeleteDependency?.({ dependencyElement: ControlState.contextMenuContext.dependencyElement });
    }
  }

  // Reset context menu state.
  ControlState.contextMenuContext = null;

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
  const firstTask = ControlState.dependencyCreationFirstTask;
  if (!firstTask) return false;

  const canvasRect = canvas.getBoundingClientRect();
  const rect = firstTask.getBoundingClientRect();
  const fixedPoint = { x: rect.left + rect.width / 2 - canvasRect.left, y: rect.top + rect.height / 2 - canvasRect.top };
  if (ControlState.dependencyCreationFirstTaskIsRequired) {
    ControlState.ghostArrow = DependencyArrow.createArrow(canvas, firstTask, fixedPoint, { color: "#b3555588", pzZoomFactor: CustomPanZoom.getScale() });
  }
  else {
    ControlState.ghostArrow = DependencyArrow.createArrow(canvas, fixedPoint, firstTask, { color: "#b3555588", pzZoomFactor: CustomPanZoom.getScale() });
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
  ControlState.selectionBoxStart = ControlState.mousePosition;
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
