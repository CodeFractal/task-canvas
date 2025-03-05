import { IControllerPresenter, Arrow, TaskComponent } from '../../Interfaces/IPresenter';
import { IApp } from '../../Interfaces/IApp';
import { MouseInputInterpreter } from './MouseInputInterpreter';
import { ITask } from '../../Interfaces/ITask';
import { CanvasCoords, ScreenCoords, SizeOnScreen } from '../../Presenter/CoordinateSystem';
import { ControlStateManager } from './ControlStateManager';

//--------------------------------------------------------------------------------------------
// Constants
//--------------------------------------------------------------------------------------------

/** The size of the snap grid in pixels. */
const SNAP_GRID_SIZE = 40;

/** The minimum distance between a task and a grid line for snapping to occur. */
const SNAP_DISTANCE = 6;

//--------------------------------------------------------------------------------------------
// Controller
//--------------------------------------------------------------------------------------------

export class AppController {
  private app: IApp;
  private presenter: IControllerPresenter;
  private controlState: ControlStateManager = new ControlStateManager();

  constructor(app: IApp, presenter: IControllerPresenter) {
    this.app = app;
    this.presenter = presenter;
    this.init();
  }

  // Initialize input listeners
  private init(): void {
    
    // Disable the browser's default context menu
    document.addEventListener('contextmenu', (e: MouseEvent): void => {
      e.preventDefault();
    }, true);

    // Initialize mouse input interpreter with virtual event callback.
    MouseInputInterpreter.init((virtualEvent: any) => {
      this.updateControlState(virtualEvent);
    });

    // Listen for keyboard events.
    ['keydown', 'keyup'].forEach(evt => {
      document.addEventListener(evt, e => this.updateControlState(e));
    });
    
  }

  /** Updates the global control state based on an event and interprets the resulting intent.
   * @param e the event to process
   */
  private updateControlState(
    e: Event & {
      clientX?: number;
      clientY?: number;
      movementX?: number;
      movementY?: number;
      button?: number;
      type: string;
      key?: string;
      target: EventTarget | null;
    }
  ): void {
    this.controlState.lastEvent = e;
    if (e.clientX !== undefined && e.clientY !== undefined) {
      this.controlState.mousePosition = ScreenCoords.new(e.clientX, e.clientY);
    }
    this.controlState.mouseMovement = SizeOnScreen.new(e.movementX || 0, e.movementY || 0);
    this.controlState.target = e.target;

    // Process mouse button and keyboard events.
    if (e.type === 'mousedown') {
      if (e.button === 0) {
        this.controlState.leftPressed = true;
        this.controlState.leftDownScreenPosition = this.controlState.mousePosition;
        this.controlState.leftDownCanvasPosition = this.controlState.mousePosition.toCanvasCoords();
      }
      else if (e.button === 2) {
        this.controlState.rightPressed = true;
        this.controlState.rightDownScreenPosition = this.controlState.mousePosition;
        this.controlState.rightDownCanvasPosition = this.controlState.mousePosition.toCanvasCoords();
      }
      else if (e.button === 1) {
        this.controlState.middlePressed = true;
        this.controlState.middleDownScreenPosition = this.controlState.mousePosition;
        this.controlState.middleDownCanvasPosition = this.controlState.mousePosition.toCanvasCoords();
      }
    }
    else if (e.type === 'mouseup') {
      if (e.button === 0)
        this.controlState.leftPressed = false;
      else if (e.button === 2)
        this.controlState.rightPressed = false;
      else if (e.button === 1)
        this.controlState.middlePressed = false;
    }
    else if (e.type === 'keydown') {
      if (e.key) this.controlState.keys[e.key] = true;
    }
    else if (e.type === 'keyup') {
      if (e.key) this.controlState.keys[e.key] = false;
    }

    // After updating state, interpret the intent.
    this.interpretIntent();
  }

  //--------------------------------------------------------------------------------------------
  // Intent Interpretation
  //--------------------------------------------------------------------------------------------

  /** Interprets the current intent based on the latest event and control state. */
  private interpretIntent(): void {
    const e = this.controlState.lastEvent;
    if (!e) return;

    // If the canvas is paused, the presenter has control.
    if (this.app.isCanvasPaused()) return;

    // Special State: Context Menu is Open
    if (this.controlState.contextMenuContext) {
      if (e.type === 'click' || e.type === 'dblclick' || e.type === 'mouseup') {
        this.handleContextMenuSelection();
        return;
      }
      else if (e.type === 'contextmenu') {
        const selected = this.handleContextMenuSelection();

        // Only return if an option was selected, otherwise we continue to allow another context menu to open.
        if (selected) return;
      }
    }

    // Special State: Holding Ghost (Dependency) Arrow
    if (this.controlState.dependencyCreationContext) {
      const context = this.controlState.dependencyCreationContext;
      if (e.type === 'mousemove') {
        const taskOrCursorScreenPosition = this.presenter.getTask(this.controlState.target as Element) ?? this.controlState.mousePosition.toCanvasCoords();
        if (context.firstTaskIsRequiredTask) {
          this.presenter.updateArrow(context.ghostArrow, { target: taskOrCursorScreenPosition, isGhostArrow: true });
        }
        else {
          this.presenter.updateArrow(context.ghostArrow, { source: taskOrCursorScreenPosition, isGhostArrow: true });
        }
      }

      // Create a dependency on left-click
      else if (e.type === 'click' && (e as MouseEvent).button === 0) {
        const secondTask = this.presenter.getTask(this.controlState.target as Element);
        if (secondTask) {
          if (context.firstTaskIsRequiredTask) {
            this.app.createDependency(context.firstTask, secondTask);
          } else {
            this.app.createDependency(secondTask, context.firstTask);
          }
        }

        // Remove the ghost arrow from the canvas if it exists.
        this.presenter.removeArrow(context.ghostArrow);

        // Clear dependency creation state.
        this.controlState.dependencyCreationContext = null;
        this.controlState.mouseIsHoldingDependencyArrow = false;
        return;
      }

      // Cancel Dependency Creation on right-click or Escape.
      else if (
        (e.type === 'contextmenu' && (e as MouseEvent).button === 2) ||
        (e.type === 'keydown' && (e as KeyboardEvent).key === 'Escape')
      ) {
        // Remove the ghost arrow from the canvas if it exists.
        this.presenter.removeArrow(context.ghostArrow);

        // Clear dependency creation state.
        this.controlState.dependencyCreationContext = null;
        this.controlState.mouseIsHoldingDependencyArrow = false;
        return;
      }

      return;
    }

    // Special State: Holding Canvas (Panning)
    if (this.controlState.mouseIsHoldingCanvas) {
      if (e.type === 'mousemove') {
        const movement = this.controlState.mouseMovement;
        this.presenter.panCanvas(movement);
      }
      else if (e.type === 'mouseup' && (e as MouseEvent).button === 2) {
        this.controlState.mouseIsHoldingCanvas = false;
      }
      return;
    }

    // Special State: Holding Single Task
    if (this.controlState.mouseIsHoldingSingleTask) {

      // Drag a Task
      if (e.type === 'mousemove') {
        const mouseCanvasPos = this.controlState.mousePosition.toCanvasCoords();
        const canvasDragVector = mouseCanvasPos.subtractCoords(this.controlState.leftDownCanvasPosition!);
        const orig = this.controlState.taskHeldByMouseOriginalCanvasPosition;
        let newCanvasPos = orig.add(canvasDragVector);

        // Snap to Grid (unless Alt key is held)
        if (SNAP_GRID_SIZE > 0 && !this.controlState.keys['Alt']) {
          const snapX = Math.round(newCanvasPos.x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
          const snapY = Math.round(newCanvasPos.y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
          const dx = Math.abs(newCanvasPos.x - snapX);
          const dy = Math.abs(newCanvasPos.y - snapY);
          newCanvasPos = CanvasCoords.new(
            dx < SNAP_DISTANCE ? snapX : newCanvasPos.x,
            dy < SNAP_DISTANCE ? snapY : newCanvasPos.y
          );
        }

        this.controlState.taskHeldByMouseCurrentCanvasPosition = newCanvasPos;
        this.presenter.moveTask(this.controlState.taskHeldByMouse!, newCanvasPos, false);
      }

      // Drop a Task
      else if (e.type === 'mouseup' && (e as MouseEvent).button === 0) {
        if (this.controlState.taskHeldByMouse) {
          this.app.moveTasks([{ task: this.controlState.taskHeldByMouse, position: this.controlState.taskHeldByMouseCurrentCanvasPosition }]);
        }
        this.controlState.mouseIsHoldingSingleTask = false;
        this.controlState.taskHeldByMouse = null;
      }

      // Cancel Dragging a Task (Right-Click or Escape)
      else if (
        (e.type === 'contextmenu' && (e as MouseEvent).button === 2) ||
        (e.type === 'keydown' && (e as KeyboardEvent).key === 'Escape')
      ) {
        if (this.controlState.taskHeldByMouse) {
          this.presenter.moveTask(this.controlState.taskHeldByMouse, this.controlState.taskHeldByMouseOriginalCanvasPosition);
        }
        this.controlState.mouseIsHoldingSingleTask = false;
        this.controlState.taskHeldByMouse = null;
      }

      return;
    }

    // Special State: Holding Task Group
    if (this.controlState.mouseIsHoldingTaskGroup) {
      if (e.type === 'mousemove') {
        // Get the current canvas position of the mouse.
        const mousePosOnCanvas = this.controlState.mousePosition.toCanvasCoords();

        // Calculate the drag vector for the anchor relative to its initial mouse-down position.
        let dragVector = mousePosOnCanvas.subtractCoords(this.controlState.taskGroupAnchorOriginalMouseCanvasPosition!);

        // Compute the new position for the anchor based on its original position plus the drag vector.
        const origAnchorPos = this.controlState.taskGroupOriginalPositions!.get(this.controlState.taskGroupAnchor!)!;
        let newAnchorPos = origAnchorPos.add(dragVector);

        // Snap to Grid (unless Alt key is held)
        if (SNAP_GRID_SIZE > 0 && !this.controlState.keys['Alt']) {
          const snapX = Math.round(newAnchorPos.x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
          const snapY = Math.round(newAnchorPos.y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
          const dx = Math.abs(newAnchorPos.x - snapX);
          const dy = Math.abs(newAnchorPos.y - snapY);
          newAnchorPos = CanvasCoords.new(
            dx < SNAP_DISTANCE ? snapX : newAnchorPos.x,
            dy < SNAP_DISTANCE ? snapY : newAnchorPos.y
          );
        }

        // Recalculate the drag vector after snapping.
        dragVector = newAnchorPos.subtractCoords(origAnchorPos);

        // Move the anchor to its new (possibly snapped) position.
        this.presenter.moveTask(this.controlState.taskGroupAnchor!, newAnchorPos, false);

        // Move each selected task by the same drag vector.
        this.controlState.selectedTasks.forEach(task => {
          if (task === this.controlState.taskGroupAnchor) return;
          const origPos = this.controlState.taskGroupOriginalPositions!.get(task)!;
          const newPos = origPos.add(dragVector);
          this.presenter.moveTask(task, newPos, false);
        });
      }

      // Drop the Task Group
      else if (e.type === 'mouseup' && (e as MouseEvent).button === 0) {
        const taskMovements: { task: ITask; position: CanvasCoords }[] = [];
        this.controlState.selectedTasks.forEach(task => {
          const pos = this.presenter.getTaskPositionOnCanvas(task);
          taskMovements.push({ task, position: pos });
        });
        this.app.moveTasks(taskMovements);
        this.controlState.mouseIsHoldingTaskGroup = false;
        delete this.controlState.taskGroupOriginalPositions;
        delete this.controlState.taskGroupAnchor;
        delete this.controlState.taskGroupAnchorOriginalMouseCanvasPosition;
      }

      // Cancel Dragging the Task Group (Right-Click or Escape)
      else if (
        (e.type === 'contextmenu' && (e as MouseEvent).button === 2) ||
        (e.type === 'keydown' && (e as KeyboardEvent).key === 'Escape')
      ) {
        this.controlState.taskGroupOriginalPositions!.forEach((origPos, task) => {
          this.presenter.moveTask(task, origPos);
        });
        this.controlState.mouseIsHoldingTaskGroup = false;
        delete this.controlState.taskGroupOriginalPositions;
        delete this.controlState.taskGroupAnchor;
        delete this.controlState.taskGroupAnchorOriginalMouseCanvasPosition;
      }
      return;
    }

    // Special State: Drawing Selection Box
    if (this.controlState.mouseIsDrawingSelectionBox) {
      if (e.type === 'mousemove') {
        const startPosition = this.controlState.selectionBoxStart;
        const currentPosition = this.controlState.mousePosition;
        this.presenter.moveSelectionBox(startPosition, currentPosition);
      } 
      else if (e.type === 'mouseup' && (e as MouseEvent).button === 0) {
        const startPosition = this.controlState.selectionBoxStart;
        const currentPosition = this.controlState.mousePosition;
        const tasksInArea = this.presenter.getTasksInArea(startPosition, currentPosition);
        const deselect = this.controlState.keys['Alt'] || this.controlState.keys['Meta'];
        for (const task of tasksInArea) {
          if (deselect) {
            this.deselectTask(task);
          }
          else {
            this.selectTask(task);
          }
        }
        this.releaseSelectionBox();
      } 
      else if (e.type === 'contextmenu' && (e as MouseEvent).button === 2) {
        this.releaseSelectionBox();
      } 
      else if (e.type === 'keydown' && (e as KeyboardEvent).key === 'Escape') {
        this.releaseSelectionBox();
      }
      return;
    }

    // Special State: Editing Task Title
    if (this.controlState.taskTitleEditContext) {
      const context = this.controlState.taskTitleEditContext;
      
      // Finish Editing Task Title (Enter Key or Click Away)
      const finishEditingTaskTitle = (): void => {
        const title = this.presenter.getTaskTitle(context.task);
        this.presenter.toggleEditModeForTaskTitle(context.task, false);
        if (title && title.length > 0) {
          this.app.changeTaskTitle(context.task, title);
        }
        else {
          this.presenter.setTaskTitle(context.task, context.originalTitle);
        }
        this.controlState.taskTitleEditContext = null;
      };
      if (e.type === 'keydown' && (e as KeyboardEvent).key === 'Enter') {
        finishEditingTaskTitle();
        return;
      }
      if (e.type === 'mousedown' || e.type === 'click' || e.type === 'dblclick' || e.type === 'contextmenu') {
        const taskInfo = this.presenter.getTaskInfo(this.controlState.target as Element);
        const targetWasTaskTitle = taskInfo?.task === context.task && taskInfo.component === TaskComponent.Title;

        // We don't want to interfere with activity within the task title itself.
        if (targetWasTaskTitle) return;

        // If the user clicked anywhere else, finish editing the task title and continue processing the event.
        finishEditingTaskTitle();
      }

      // Cancel Editing Task Title (Escape Key)
      else if (e.type === 'keydown' && (e as KeyboardEvent).key === 'Escape') {
        this.presenter.toggleEditModeForTaskTitle(context.task, false);
        this.presenter.setTaskTitle(context.task, context.originalTitle);
        this.controlState.taskTitleEditContext = null;
        return;
      }

      // Prevent processing keyboard events while editing the task title.
      else if (e.type === 'keydown' || e.type === 'keyup') {
        return;
      }

      // We don't return here, because some paths should continue to process the event.
    }

    // Special State: Editing Task Description
    if (this.controlState.taskDescriptionEditContext) {
      const context = this.controlState.taskDescriptionEditContext;
      
      // Finish Editing Task Description (Enter Key or Click Away)
      const finishEditingTaskDescription = (): void => {
        const description = this.presenter.getTaskDescription(context.task);
        this.presenter.toggleEditModeForTaskDescription(context.task, false);
        if (description != null) {
          this.app.changeTaskDescription(context.task, description);
        }
        else {
          this.presenter.setTaskDescription(context.task, context.originalDescription);
        }
        this.controlState.taskDescriptionEditContext = null;
      };
      if (e.type === 'mousedown' || e.type === 'click' || e.type === 'dblclick' || e.type === 'contextmenu') {
        const taskInfo = this.presenter.getTaskInfo(this.controlState.target as Element);
        const targetWasTaskDescription = taskInfo?.task === context.task && taskInfo.component === TaskComponent.Description;

        // We don't want to interfere with activity within the task description itself.
        if (targetWasTaskDescription) return;

        // If the user clicked anywhere else, finish editing the task description and continue processing the event.
        finishEditingTaskDescription();
      }

      // Cancel Editing Task Description
      else if (e.type === 'keydown' && (e as KeyboardEvent).key === 'Escape') {
        this.presenter.toggleEditModeForTaskDescription(context.task, false);
        this.presenter.setTaskDescription(context.task, context.originalDescription);
        this.controlState.taskDescriptionEditContext = null;
        
        return;
      }

      // Prevent processing keyboard events while editing the task description.
      else if (e.type === 'keydown' || e.type === 'keyup') {
        return;
      }

      // We don't return here, because some paths should continue to process the event.
    }

    // Normal State: No Special State (from here on)

    if (e.type === 'mousedown') {
      if ((e as MouseEvent).button === 0) {
        const taskInfo = this.presenter.getTaskInfo(this.controlState.target as Element);
        const eTask = taskInfo ? taskInfo.task : null;

        // Grab a Task (or Task Group)
        if (eTask) {
          let taskIsPartOfSelection = this.controlState.selectedTasks.has(eTask);
          if (!taskIsPartOfSelection && this.controlState.keys['Shift']) {
            this.selectTask(eTask);
            taskIsPartOfSelection = true;
          }

          if (taskIsPartOfSelection) {
            this.tryGrabTaskGroup(eTask);
            return;
          }
          else {
            this.tryGrabSingleTask(eTask);
            return;
          }
        }

        // Start Drawing a Selection Box
        else {
          if (this.tryGrabSelectionBox()) {

            // Deselect all tasks if Shift key is not held
            if (!this.controlState.keys['Shift']) {
              this.deselectAllTasks();
            }

            return;
          }
        }
      }

      // Grab the Canvas
      else if ((e as MouseEvent).button === 2) {
        this.tryGrabCanvas();
        return;
      }

      return;
    }

    // Left-Click or Double-Click
    if ((e.type === 'click' || e.type === 'dblclick') && (e as MouseEvent).button === 0) {
      const taskInfo = this.presenter.getTaskInfo(this.controlState.target as Element);
      const task = taskInfo ? taskInfo.task : null;

      // Toggle Task Selection (Shift-Click)
      if (task && this.controlState.keys['Shift']) {
        if (this.controlState.selectedTasks.has(task)) {
          this.deselectTask(task);
        }
        else {
          this.selectTask(task);
        }
        return;
      }

      this.deselectAllTasks();

      if (task) {

        // Toggle Expand/Collapse Task (Double-Click on Task Header)
        if (e.type === 'dblclick' && taskInfo!.component === TaskComponent.Header) {
          // Only expand if there is a description.
          if (task.isExpanded() || task.getDescription()) {
            this.app.toggleTaskExpansion(task, null);
            return;
          }
        }

        // Edit Task Title
        if (taskInfo!.component === TaskComponent.Title) {
          const originalTitle = taskInfo!.task.getTitle();
          this.presenter.toggleEditModeForTaskTitle(task, true);
          this.controlState.taskTitleEditContext = {
            task: task,
            originalTitle
          };
          return;
        }

        // Edit Task Description
        if (taskInfo!.component === TaskComponent.Description) {
          const originalDescription = taskInfo!.task.getDescription();
          this.presenter.toggleEditModeForTaskDescription(task, true);
          this.controlState.taskDescriptionEditContext = {
            task: task,
            originalDescription
          };
          return;
        }

        // Toggle Expand/Collapse Task (Button Click)
        if (taskInfo!.component === TaskComponent.Collapse) {
          const isExpanding = !task.isExpanded();
          this.app.toggleTaskExpansion(task, null);

          // If expanding and no description, start editing the description automatically.
          if (isExpanding && !task.getDescription()) {
            this.presenter.toggleEditModeForTaskDescription(task, true);
            this.controlState.taskDescriptionEditContext = {
              task: task,
              originalDescription: ''
            };
          }
          return;
        }

        // Toggle Complete/Incomplete Task
        if (taskInfo!.component === TaskComponent.Completion) {
          this.app.toggleTaskCompletion(task, null);
          return;
        }

        // Select Task (Single-Click)
        if (e.type === 'click') {
          this.selectTask(task);
          return;
        }

      }

      // Add Task (Double-Click)
      else if (e.type === 'dblclick') {
        const canvasPos = this.controlState.mousePosition.toCanvasCoords();

        // (floor) Snap the mouse position to the grid.
        const snappedPosition = CanvasCoords.new(
          Math.floor(canvasPos.x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE,
          Math.floor(canvasPos.y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE
        );

        this.app.createTask(snappedPosition);
        return;
      }

      return;
    }

    // Right-Click (Context Menu)
    if (e.type === 'contextmenu') {

      // Show Task Context Menu
      const taskInfo = this.presenter.getTaskInfo(this.controlState.target as Element);
      const eTask = taskInfo ? taskInfo.task : null;
      if (eTask) {
        let options: [string, string][] = [
          ['REQUIRES_DEPENDENCY', "Requires ..."],
          ['REQUIRED_BY_DEPENDENCY', "Required by ..."]
        ];
        if (this.controlState.selectedTasks.has(eTask)) {
          options.push(['DELETE_SELECTED_TASKS', "Delete Selected Tasks"]);
        }
        else {
          options.push(['DELETE_TASK', "Delete Task"]);
        }
        this.presenter.showContextMenu(this.controlState.mousePosition, options);
        this.controlState.contextMenuContext = {
          target: this.controlState.target,
          position: this.controlState.mousePosition,
          task: eTask
        };
        return;
      }

      // Show Dependency Context Menu
      const dependency = this.presenter.getDependency(this.controlState.target as Element);
      if (dependency) {
        this.presenter.showContextMenu(this.controlState.mousePosition, [['DELETE_DEPENDENCY', "Delete Dependency"]]);
        this.controlState.contextMenuContext = {
          target: this.controlState.target,
          position: this.controlState.mousePosition,
          dependency: dependency
        };
        return;
      }

      // Show Canvas Context Menu
      else {
        this.presenter.showContextMenu(this.controlState.mousePosition, [['ADD_TASK', "Add Task"]]);
        this.controlState.contextMenuContext = {
          target: this.controlState.target,
          position: this.controlState.mousePosition
        };
        return;
      }
    }

    if (e.type === 'keydown') {

      // Select all tasks
      if (this.controlState.keys['a'] && (this.controlState.keys['Control'] || this.controlState.keys['Meta'])) {
        this.selectAllTasks();
        return;
      }

      // Delete selected tasks
      if (this.controlState.keys['Delete'] || this.controlState.keys['Backspace']) {
        const tasksToDelete = Array.from(this.controlState.selectedTasks);
        this.controlState.selectedTasks.clear();
        this.app.deleteTasks(tasksToDelete);
        return;
      }

      return;
    }

    return; // End of interpretIntent.
  }

  //--------------------------------------------------------------------------------------------
  // Context Menu Selection
  //--------------------------------------------------------------------------------------------

  /** Handles a selection made from a context menu.
   * @returns true if an option was selected, false otherwise
   */
  private handleContextMenuSelection(): boolean {
    if (this.controlState.contextMenuContext === null) return false;
    const context = this.controlState.contextMenuContext;

    const option = this.presenter.getContextMenuOption(this.controlState.target as Element);
    if (option === 'ADD_TASK') {
      const canvasPos = context.position.toCanvasCoords();
      this.app.createTask(canvasPos);
    }
    else if (option === 'DELETE_TASK') {
      if (context.task) {
        this.controlState.selectedTasks.delete(context.task);
        this.app.deleteTasks([context.task]);
      }
    }
    else if (option === 'DELETE_SELECTED_TASKS') {
      const tasks = Array.from(this.controlState.selectedTasks);
      this.controlState.selectedTasks.clear();
      this.app.deleteTasks(tasks);
    }
    else if (option === 'REQUIRES_DEPENDENCY') {
      if (!context.task) throw new Error('Task is null');
      
      this.tryGrabDependencyArrow(
        context.task,
        false
      );
    }
    else if (option === 'REQUIRED_BY_DEPENDENCY') {
      if (!context.task) throw new Error('Task is null');
      
      this.tryGrabDependencyArrow(
        context.task,
        true
      );
    }
    else if (option === 'DELETE_DEPENDENCY') {
      if (!context.dependency) throw new Error('Dependency is null');

      this.app.deleteDependency(context.dependency);
    }

    // Reset context menu state.
    this.controlState.contextMenuContext = null;

    this.presenter.hideContextMenu();

    return option != null;
  }

  //--------------------------------------------------------------------------------------------
  // Holding and Releasing Objects
  //--------------------------------------------------------------------------------------------

  /** Checks whether the mouse is currently holding any object.
   * @returns true if something is held, false otherwise
   */
  private mouseIsHoldingSomething(): boolean {
    return (
      this.controlState.mouseIsHoldingSingleTask ||
      this.controlState.mouseIsHoldingTaskGroup ||
      this.controlState.mouseIsHoldingCanvas ||
      this.controlState.mouseIsHoldingDependencyArrow ||
      this.controlState.mouseIsDrawingSelectionBox
    );
  }

  /** Releases all current mouse holds and resets their state. */
  private releaseAllMouseHolds(): void {
    if (this.controlState.mouseIsHoldingDependencyArrow) {
      this.controlState.mouseIsHoldingDependencyArrow = false;
    }
    if (this.controlState.mouseIsHoldingSingleTask) {
      this.controlState.mouseIsHoldingSingleTask = false;
      this.controlState.taskHeldByMouse = null;
    }
    if (this.controlState.mouseIsHoldingTaskGroup) {
      this.controlState.mouseIsHoldingTaskGroup = false;
    }
    if (this.controlState.mouseIsHoldingCanvas) {
      this.controlState.mouseIsHoldingCanvas = false;
    }
    if (this.controlState.mouseIsDrawingSelectionBox) {
      this.releaseSelectionBox();
    }
  }

  /** Attempts to grab a single task for dragging.
   * @param task the task to grab
   * @returns true if successful, false otherwise
   */
  private tryGrabSingleTask(task: ITask): boolean {
    if (this.controlState.mouseIsHoldingSingleTask && this.controlState.taskHeldByMouse === task)
      return true;
    if (this.mouseIsHoldingSomething())
      return false;

    this.controlState.mouseIsHoldingSingleTask = true;
    this.controlState.taskHeldByMouse = task;

    // Move the task to the front for dragging
    this.controlState.taskHeldByMouseOriginalCanvasPosition = this.presenter.getTaskPositionOnCanvas(task);
    this.presenter.adjustTaskZPosition(task, CanvasCoords.zero);

    return true;
  }

  /** Attempts to grab a group of tasks for group dragging.
   * @param anchorTask the task to serve as the drag anchor
   * @returns true if successful, false otherwise
   */
  private tryGrabTaskGroup(anchorTask: ITask): boolean {
    if (this.controlState.mouseIsHoldingTaskGroup)
      return true;
    if (this.mouseIsHoldingSomething())
      return false;
    if (this.controlState.selectedTasks.size === 0)
      return false;

    this.controlState.mouseIsHoldingTaskGroup = true;
    this.controlState.taskGroupAnchor = anchorTask;

    // Bring the anchor task to the front.
    this.presenter.adjustTaskZPosition(anchorTask, CanvasCoords.zero);

    // Record the original positions of each selected task.
    this.controlState.taskGroupOriginalPositions = new Map();
    this.controlState.selectedTasks.forEach(task => {
      this.controlState.taskGroupOriginalPositions!.set(task, this.presenter.getTaskPositionOnCanvas(task));
    });

    // Record the initial mouse position in canvas coordinates.
    this.controlState.taskGroupAnchorOriginalMouseCanvasPosition = this.controlState.mousePosition.toCanvasCoords();
    return true;
  }

  /** Attempts to grab the canvas for panning.
   * @returns true if successful, false otherwise
   */
  private tryGrabCanvas(): boolean {
    if (this.controlState.mouseIsHoldingCanvas)
      return true;
    if (this.mouseIsHoldingSomething())
      return false;

    this.controlState.mouseIsHoldingCanvas = true;
    return true;
  }

  /** Attempts to start dependency arrow creation.
   * @param firstTask the first task in the dependency
   * @param taskIsRequired true if the first task is required by the second task
   * @returns true if successful, false otherwise
   */
  private tryGrabDependencyArrow(firstTask: ITask, firstTaskIsRequiredTask: boolean): boolean {
    if (this.controlState.mouseIsHoldingDependencyArrow)
      return true;
    if (this.mouseIsHoldingSomething())
      return false;

    this.controlState.mouseIsHoldingDependencyArrow = true;
    const cursorPos = this.controlState.mousePosition.toCanvasCoords();
    const arrowSource = firstTaskIsRequiredTask ? firstTask : cursorPos;
    const arrowTarget = firstTaskIsRequiredTask ? cursorPos : firstTask;
    const arrow = this.presenter.createArrow(arrowSource, arrowTarget);

    this.controlState.dependencyCreationContext = {
      firstTask: firstTask,
      firstTaskIsRequiredTask: firstTaskIsRequiredTask,
      ghostArrow: arrow
    }

    return true;
  }

  /** Attempts to start drawing a selection box.
   * @returns true if successful, false otherwise
   */
  private tryGrabSelectionBox(): boolean {
    if (this.controlState.mouseIsDrawingSelectionBox)
      return true;
    if (this.mouseIsHoldingSomething())
      return false;
    this.controlState.mouseIsDrawingSelectionBox = true;
    this.controlState.selectionBoxStart = this.controlState.mousePosition;
    const startPosition = this.controlState.selectionBoxStart;
    const currentPosition = this.controlState.mousePosition;
    this.presenter.moveSelectionBox(startPosition, currentPosition);
    this.presenter.showSelectionBox();
    return true;
  }

  /** Releases the selection box. */
  private releaseSelectionBox(): void {
    this.presenter.hideSelectionBox();
    this.controlState.mouseIsDrawingSelectionBox = false;
  }

  /** Selects a task.
   * @param task the task to select
   */
  private selectTask(task: ITask): void {
    this.controlState.selectedTasks.add(task);
    this.presenter.toggleTaskHighlight(task, true);
  }

  /** Selects all tasks (delegates to the presenter for retrieval). */
  private selectAllTasks(): void {
    const tasks = this.presenter.getAllTasks();
    this.controlState.selectedTasks = new Set(tasks);
    this.presenter.toggleAllTaskHighlights(true);
  }

  /** Deselects a task.
   * @param task the task to deselect
   */
  private deselectTask(task: ITask): void {
    this.controlState.selectedTasks.delete(task);
    this.presenter.toggleTaskHighlight(task, false);
  }

  /** Deselects all tasks. */
  private deselectAllTasks(): void {
    this.controlState.selectedTasks.clear();
    this.presenter.toggleAllTaskHighlights(false);
  }
}
