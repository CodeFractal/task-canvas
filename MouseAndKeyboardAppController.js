const MouseAndKeyboardAppController = (function () {
    const subscriptions = {
        // Canvas
        'panCanvas': [],

        // Tasks
        'createTask': [],
        'startEditingTaskTitle': [],
        'stopEditingTaskTitle': [],
        'startEditingTaskDescription': [],
        'stopEditingTaskDescription': [],
        'toggleTaskCompletion': [],
        'toggleTaskExpansion': [],
        'moveTasks': [],
        'deleteTasks': [],

        // Dependencies
        'createDependency': [],
        'deleteDependency': [],

        // Undo/Redo
        'undo': [],
        'redo': [],
    };

    // The size of the grid to snap tasks to (0 to disable snapping)
    const SNAP_GRID_SIZE = 40;

    // How close a task needs to be to a grid line to snap to it
    const SNAP_DISTANCE = 6;

    const ControlState = {
        mousePosition: { x: 0, y: 0 },
        mouseMovement: { x: 0, y: 0 },
        leftPressed: false,
        rightPressed: false,
        middlePressed: false,
        leftDownScreenPosition: { x: 0, y: 0 },
        rightDownScreenPosition: { x: 0, y: 0 },
        middleDownScreenPosition: { x: 0, y: 0 },
        leftDownCanvasPosition: { x: 0, y: 0 },
        rightDownCanvasPosition: { x: 0, y: 0 },
        middleDownCanvasPosition: { x: 0, y: 0 },
        keys: {},
        lastEvent: null,
        target: null,

        taskInTitleEditMode: null,
        taskInDescriptionEditMode: null,
        taskElementHeldByMouse: null,
        taskElementHeldByMouseOriginalCanvasPosition: { x: 0, y: 0 },
        taskElementHeldByMouseCurrentCanvasPosition: { x: 0, y: 0 },
        selectedTaskElements: new Set(),
        selectionBoxStart: { x: 0, y: 0 },
        contextMenuContext: {
            isOpen: false,
            target: null,
            position: { x: 0, y: 0 }
        },
        
        dependencyCreationMode: null,       // "source" or "target"
        dependencyCreationFixedTask: null,  // fixed task id
        ghostArrow: null,                   // the ghost arrow element

        mouseIsHoldingDependencyArrow: false,
        mouseIsHoldingSingleTask: false,
        mouseIsHoldingTaskGroup: false,
        mouseIsHoldingCanvas: false,
        mouseIsDrawingSelectionBox: false,
    };

    function onIntent(intentName, callback) {
        subscriptions[intentName].push(callback);
    }

    function recognizeIntent(intentName, data) {
        subscriptions[intentName].forEach(callback => callback(data));
    }

    let didInit = false;
    function init() {
        if (didInit) return;

        DOMController.init();

        // Listen for mouse events
        MouseInputInterpreter.init((virtualEvent) => {
            updateControlState(virtualEvent);
        });
        
        // Listen for keyboard events
        ['keydown', 'keyup'].forEach(evt => {
            document.addEventListener(evt, e => updateControlState(e));
        });

        didInit = true;
    }

    document.addEventListener('DOMContentLoaded', () => {
        init();     
    });

    // Update the control state with an event (then interpret the intent)
    function updateControlState(e) {
        ControlState.lastEvent = e;
        ControlState.mousePosition = { x: e.clientX, y: e.clientY };
        ControlState.mouseMovement = { x: e.movementX || 0, y: e.movementY || 0 };
        ControlState.target = e.target;
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
            ControlState.keys[e.key] = true;
        }
        else if (e.type === 'keyup') {
            ControlState.keys[e.key] = false;
        }

        interpretIntent();
    }

    function interpretIntent() {
        const e = ControlState.lastEvent;

        // Special State: Context Menu is Open
        if (ControlState.contextMenuContext.isOpen) {
            if (e.type === 'click' || e.type === 'dblclick' || e.type == 'mouseup') {
                handleContextMenuSelection();
                return;
            }
            else if (e.type === 'contextmenu') {
                const selected = handleContextMenuSelection();

                // Only return if an option was selected, otherwise we continue to allow another context menu to open.
                if (selected) return;
            }
        }

        // Special State: Holding Ghost Arrow
        if (ControlState.mouseIsHoldingDependencyArrow) {
            if (e.type === 'mousemove') {
                // Update ghostSnapTarget based on whether the mouse is over a task (other than the fixed task)
                let ghostSnapTarget = null;
                let potentialTaskElement = DOMController.getTaskElementFromChild(ControlState.target);
                let potentialTaskId = potentialTaskElement ? potentialTaskElement.getAttribute('data-id') : null;
                if (potentialTaskId && potentialTaskId !== ControlState.dependencyCreationFixedTask) {
                    ghostSnapTarget = potentialTaskId;
                }
                DOMController.updateGhostArrow(
                    ControlState.dependencyCreationMode,
                    ControlState.ghostArrow,
                    ControlState.dependencyCreationFixedTask,
                    ghostSnapTarget,
                    ControlState.mousePosition
                );
            }

            // Create a dependency on left-click
            else if (e.type === 'click' && e.button === 0) {
                var taskId = DOMController.getTaskId(ControlState.target);
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
            else if ((e.type === 'contextmenu' && e.button === 2) ||
                     (e.type === 'keydown' && e.key === 'Escape')) {
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
            else if (e.type === 'mouseup' && e.button === 2) {
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
                    x: mouseCanvasPosition.x - ControlState.leftDownCanvasPosition.x,
                    y: mouseCanvasPosition.y - ControlState.leftDownCanvasPosition.y
                };
                const newCanvasPosition = {
                    x: ControlState.taskElementHeldByMouseOriginalCanvasPosition.x + canvasDragVector.x,
                    y: ControlState.taskElementHeldByMouseOriginalCanvasPosition.y + canvasDragVector.y
                };
                
                // Snap to Grid
                if (SNAP_GRID_SIZE > 0 && !ControlState.keys['Alt']) {
                    const snapX = Math.round(newCanvasPosition.x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
                    const snapY = Math.round(newCanvasPosition.y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
                    const dx = Math.abs(newCanvasPosition.x - snapX);
                    const dy = Math.abs(newCanvasPosition.y - snapY);
                    if (dx < SNAP_DISTANCE) newCanvasPosition.x = snapX;
                    if (dy < SNAP_DISTANCE) newCanvasPosition.y = snapY;
                }

                ControlState.taskElementHeldByMouseCurrentCanvasPosition = newCanvasPosition;
                DOMController.moveTask(ControlState.taskElementHeldByMouse, newCanvasPosition, false);
            }

            // Drop a Task
            else if (e.type === 'mouseup' && e.button === 0) {
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
            else if (e.type === 'contextmenu' && e.button === 2) {
                DOMController.moveTask(ControlState.taskElementHeldByMouse, ControlState.taskElementHeldByMouseOriginalCanvasPosition);
                ControlState.mouseIsHoldingSingleTask = false;
                ControlState.taskElementHeldByMouse = null;
            }

            // Cancel Dragging a Task (Escape Key)
            else if (e.type === 'keydown' && e.key === 'Escape') {
                DOMController.moveTask(ControlState.taskElementHeldByMouse, ControlState.taskElementHeldByMouseOriginalCanvasPosition);
                ControlState.mouseIsHoldingSingleTask = false;
                ControlState.taskElementHeldByMouse = null;
            }

            return;
        }

        // Special State: Holding Task Group
        if (ControlState.mouseIsHoldingTaskGroup) {
            if (e.type === 'mousemove') {
                // Get the current mouse position in canvas coordinates.
                const currentMouseCanvas = DOMController.screenToCanvasPosition(ControlState.mousePosition);

                // Calculate the drag vector for the anchor relative to its initial mouse-down position.
                let dragVector = {
                    x: currentMouseCanvas.x - ControlState.taskGroupAnchorOriginalMouseCanvasPosition.x,
                    y: currentMouseCanvas.y - ControlState.taskGroupAnchorOriginalMouseCanvasPosition.y
                };

                // Compute the new position for the anchor based on its original position plus the drag vector.
                const anchorOriginalPosition = ControlState.taskGroupOriginalPositions.get(ControlState.taskGroupAnchor);
                let newAnchorPosition = {
                    x: anchorOriginalPosition.x + dragVector.x,
                    y: anchorOriginalPosition.y + dragVector.y
                };

                // Snap only the anchor if conditions apply.
                if (SNAP_GRID_SIZE > 0 && !ControlState.keys['Alt']) {
                    const snapX = Math.round(newAnchorPosition.x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
                    const snapY = Math.round(newAnchorPosition.y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
                    const dx = Math.abs(newAnchorPosition.x - snapX);
                    const dy = Math.abs(newAnchorPosition.y - snapY);
                    if (dx < SNAP_DISTANCE) newAnchorPosition.x = snapX;
                    if (dy < SNAP_DISTANCE) newAnchorPosition.y = snapY;
                }

                // Recalculate the effective drag vector from the anchor's original position.
                dragVector = {
                    x: newAnchorPosition.x - anchorOriginalPosition.x,
                    y: newAnchorPosition.y - anchorOriginalPosition.y
                };

                // Move the anchor to its new (possibly snapped) position.
                DOMController.moveTask(ControlState.taskGroupAnchor, newAnchorPosition, false);

                // For every other selected task, apply the same drag vector relative to their original positions.
                for (const taskElement of ControlState.selectedTaskElements) {
                    if (taskElement === ControlState.taskGroupAnchor) continue;
                    const originalPosition = ControlState.taskGroupOriginalPositions.get(taskElement);
                    const newPosition = {
                        x: originalPosition.x + dragVector.x,
                        y: originalPosition.y + dragVector.y
                    };
                    DOMController.moveTask(taskElement, newPosition, false);
                }
            }
            else if (e.type === 'mouseup' && e.button === 0) {
                // Finalize the move for all tasks.
                const taskMovements = [];
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
            // Optional: Handle cancelation (e.g., Escape or right-click).
            else if ((e.type === 'contextmenu' && e.button === 2) || (e.type === 'keydown' && e.key === 'Escape')) {
                for (const [taskElement, originalPosition] of ControlState.taskGroupOriginalPositions.entries()) {
                    DOMController.moveTask(taskElement, originalPosition);
                }
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
            else if (e.type === 'mouseup' && e.button === 0) {
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
            else if (e.type === 'contextmenu' && e.button === 2) {
                releaseSelectionBox();
            }
            else if (e.type === 'keydown' && e.key === 'Escape') {
                releaseSelectionBox();
            }
            return;
        }

        // Normal State: No Special State (from here on)

        if (e.type === 'mousedown') {
            if (e.button === 0) {
                const eTask = DOMController.getTaskElementFromChild(ControlState.target);

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
            else if (e.button === 2) {
                tryGrabCanvas();
                return;
            }

            return;
        }

        // Left-Click or Double-Click
        if ((e.type === 'click' || e.type === 'dblclick') && e.button === 0) {
            const eTask = DOMController.getTaskElementFromChild(ControlState.target);

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
                    const eTashHeader = DOMController.getTaskHeaderElementFromChild(ControlState.target);
                    if (eTashHeader) {
                        recognizeIntent('toggleTaskExpansion', { taskElement: eTask });
                        return;
                    }
                }

                // Edit Task Title
                const eTaskTitle = DOMController.getTaskTitleElementFromChild(ControlState.target);
                if (eTaskTitle) {
                    recognizeIntent('startEditingTaskTitle', { taskElement: eTask });
                    return;
                }

                // Edit Task Description
                const eTaskDescription = DOMController.getTaskDescriptionElementFromChild(ControlState.target);
                if (eTaskDescription) {
                    recognizeIntent('startEditingTaskDescription', { taskElement: eTask });
                    return;
                }

                // Toggle Expand/Collapse Task
                const eTaskExpand = DOMController.getTaskExpandElementFromChild(ControlState.target);
                if (eTaskExpand) {
                    recognizeIntent('toggleTaskExpansion', { taskElement: eTask });
                    return;
                }

                // Toggle Complete/Incomplete Task
                const eTaskCompletion = DOMController.getTaskCompletionCheckboxFromChild(ControlState.target);
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

                // Floor snap to grid
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
            const eTask = DOMController.getTaskElementFromChild(ControlState.target);
            if (eTask) {
                var options = [
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
                    position: ControlState.mousePosition,
                    taskElement: eTask,
                };
                return;
            }

            // Show Dependency Context Menu
            const eDependency = DOMController.getDependencyArrowElementFromChild(ControlState.target);
            if (eDependency) {
                DOMController.showContextMenu(ControlState.mousePosition, [['DELETE_DEPENDENCY', "Delete Dependency"]]);
                ControlState.contextMenuContext = {
                    isOpen: true,
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
                    isOpen: true,
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
                recognizeIntent('deleteTasks', { taskElements: Array.from(ControlState.selectedTaskElements) });
                return;
            }

            return;
        }

        return; // End of HandleInput function.
    }

    function handleContextMenuSelection() {
        const option = DOMController.getContextMenuOption(ControlState.target);

        if (option == 'ADD_TASK') {
            recognizeIntent('createTask', { position: ControlState.contextMenuContext.position });
        }
        else if (option == 'DELETE_TASK') {
            recognizeIntent('deleteTasks', { taskElement: ControlState.contextMenuContext.taskElement });
        }
        else if (option == 'DELETE_SELECTED_TASKS') {
            recognizeIntent('deleteTasks', { taskElements: Array.from(ControlState.selectedTaskElements) });
        }
        else if (option == 'REQUIRES_DEPENDENCY') {
            // For "Requires Dependency", we treat the fixed task as the one to which another task will be attached (mode "target")
            ControlState.dependencyCreationMode = "target";
            ControlState.dependencyCreationFixedTask = ControlState.contextMenuContext.taskElement.getAttribute('data-id');
            tryGrabDependencyArrow();
        }
        else if (option == 'REQUIRED_BY_DEPENDENCY') {
            // For "Required by Dependency", fixed task is the one that requires the dependency (mode "source")
            ControlState.dependencyCreationMode = "source";
            ControlState.dependencyCreationFixedTask = ControlState.contextMenuContext.taskElement.getAttribute('data-id');
            tryGrabDependencyArrow();
        }
        else if (option == 'DELETE_DEPENDENCY') {
            recognizeIntent('deleteDependency', { dependencyElement: ControlState.contextMenuContext.dependencyElement });
        }

        ControlState.contextMenuContext = {
            isOpen: false,
            target: null,
            position: { x: 0, y: 0 }
        };

        DOMController.hideContextMenu();

        return option != null;
    }

    function mouseIsHoldingSomething() {
        return ControlState.mouseIsHoldingSingleTask
            || ControlState.mouseIsHoldingTaskGroup
            || ControlState.mouseIsHoldingCanvas
            || ControlState.mouseIsHoldingDependencyArrow
            || ControlState.mouseIsDrawingSelectionBox;
    }

    function releaseAllMouseHolds() {
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

    function tryGrabSingleTask(taskElement) {
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

    function tryGrabTaskGroup(anchorTask) {
        if (ControlState.mouseIsHoldingTaskGroup)
            return true;
        if (mouseIsHoldingSomething())
            return false;
        if (ControlState.selectedTaskElements.size === 0)
            return false;
    
        ControlState.mouseIsHoldingTaskGroup = true;
        // Store the anchor task and bring it to the front.
        ControlState.taskGroupAnchor = anchorTask;
        DOMController.adjustTaskZPosition(anchorTask, { x: 0, y: 0 });
        
        // Record the original positions of each selected task.
        ControlState.taskGroupOriginalPositions = new Map();
        for (const taskElement of ControlState.selectedTaskElements) {
            ControlState.taskGroupOriginalPositions.set(taskElement, DOMController.getTaskPositionOnCanvas(taskElement));
        }
        
        // Record the initial mouse position for the anchor drag.
        ControlState.taskGroupAnchorOriginalMouseCanvasPosition = DOMController.screenToCanvasPosition(ControlState.mousePosition);
        return true;
    }

    function tryGrabCanvas() {
        if (ControlState.mouseIsHoldingCanvas)
            return true;
        if (mouseIsHoldingSomething())
            return false;

        ControlState.mouseIsHoldingCanvas = true;
        return true;
    }

    function tryGrabDependencyArrow() {
        if (ControlState.mouseIsHoldingDependencyArrow)
            return true;
        if (mouseIsHoldingSomething())
            return false;

        ControlState.mouseIsHoldingDependencyArrow = true;
        let canvas = DOMController.getCanvas();
        let fixedTaskId = ControlState.dependencyCreationFixedTask;
        let fixedEl = canvas.querySelector(`.task[data-id="${fixedTaskId}"]`);
        if (!fixedEl) return false;
        let canvasRect = canvas.getBoundingClientRect();
        let rect = fixedEl.getBoundingClientRect();
        let fixedPoint = { x: rect.left + rect.width/2 - canvasRect.left, y: rect.top + rect.height/2 - canvasRect.top };
        if (ControlState.dependencyCreationMode === "target") {
            // In target mode, ghost arrow goes from the fixed element toward the mouse.
            ControlState.ghostArrow = DependencyArrow.createArrow(canvas, fixedEl, fixedPoint, { color: "#b3555588", pzZoomFactor: CustomPanZoom.getScale() });
        }
        else if (ControlState.dependencyCreationMode === "source") {
            // In source mode, ghost arrow goes from the fixed point to the fixed element.
            ControlState.ghostArrow = DependencyArrow.createArrow(canvas, fixedPoint, fixedEl, { color: "#b3555588", pzZoomFactor: CustomPanZoom.getScale() });
        }
        return true;
    }

    function tryGrabSelectionBox() {
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

    function releaseSelectionBox() {
        DOMController.hideSelectionBox();
        ControlState.mouseIsDrawingSelectionBox = false;
    }

    function selectTask(taskElement) {
        ControlState.selectedTaskElements.add(taskElement);
        DOMController.toggleTaskHighlight(taskElement, true);
    }

    function selectAllTasks() {
        for (const taskElement of DOMController.getAllTaskElements()) {
            selectTask(taskElement);
        }
    }

    function deselectTask(taskElement) {
        ControlState.selectedTaskElements.delete(taskElement);
        DOMController.toggleTaskHighlight(taskElement, false);
    }

    function deselectAllTasks() {
        for (const taskElement of ControlState.selectedTaskElements) {
            DOMController.toggleTaskHighlight(taskElement, false);
        }
        ControlState.selectedTaskElements.clear();
    }

    // Expose the public API
    return {
        init,
        onIntent
    };
})();
