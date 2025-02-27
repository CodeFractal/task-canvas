/**
 * Main application file for task management.
 * This file sets up global configurations, maintains application state,
 * and registers event listeners for task and dependency management.
 */

// Disable the browser's default context menu
document.addEventListener('contextmenu', (e: MouseEvent): void => {
    e.preventDefault();
}, true);

// --------------------------------------------------
// Global Config & Application State
// --------------------------------------------------

/** Color used for ghost dependency arrows when not snapped to a task */
const GHOST_ARROW_INVALID_COLOR: string = '#b3555588';
/** Color used for ghost dependency arrows when snapped to a task */
const GHOST_ARROW_VALID_COLOR: string = '#55b38888';
/** Color used for dependency arrows */
const DEPENDENCY_ARROW_COLOR: string = '#b3b3b3';

// Import our controllers
import * as ac from './Controls/AppController';
import { MouseAndKeyboardAppController } from './Controls/MouseAndKeyboardAppController';
import { DOMController } from './DOMController';
import { CustomPanZoom } from './CustomPanZoom';

const appController = MouseAndKeyboardAppController;

/**
 * Interface representing task data.
 */
interface TaskData {
    id: string;
    title: string;
    description: string;
    x: number;
    y: number;
    completed: boolean;
    collapsed: boolean;
}

/** Object mapping task IDs to TaskData */
const tasks: { [taskId: string]: TaskData } = {};

/**
 * Interface representing a dependency between two tasks.
 */
interface Dependency {
    from: string;
    to: string;
    arrow: any;
}

/** Array of dependencies between tasks */
const dependencies: Dependency[] = [];
/** Stack for undo actions */
const undoStack: any[] = [];
/** Stack for redo actions */
const redoStack: any[] = [];
let taskIdCounter = 1;

// --------------------------------------------------
// Core Task & Dependency Functions (Business Logic)
// --------------------------------------------------

/**
 * Creates a new task at the specified canvas coordinates.
 *
 * @param x The x coordinate for the task position
 * @param y The y coordinate for the task position
 */
function createTask(x: number, y: number): void {
    // Generate a unique task ID using a counter.
    const taskId = 'task-' + taskIdCounter++;
    // Define the task data object.
    const taskData: TaskData = {
        id: taskId,
        title: 'New Task',
        description: '<p>Description</p>',
        x: x,
        y: y,
        completed: false,
        collapsed: false,
    };
    // Store the task data in the global tasks object.
    tasks[taskId] = taskData;
    // Delegate the task creation on the canvas to the DOMController.
    DOMController.addTaskToCanvas(taskData);
    // Record this action for potential undo functionality.
    pushUndo({ type: 'addTask', task: taskData });
    // Automatically save the current state.
    autosave();
}

/**
 * Pushes an action onto the undo stack and clears the redo stack.
 *
 * @param action The action object to record for undo functionality
 */
function pushUndo(action: any): void {
    undoStack.push(action);
    // Clear the redo stack whenever a new action is recorded.
    redoStack.length = 0;
}

/**
 * Performs an undo operation.
 * Minimal stub for undo functionality.
 */
function undo(): void {
    // TODO: Implement undo logic
}

/**
 * Performs a redo operation.
 * Minimal stub for redo functionality.
 */
function redo(): void {
    // TODO: Implement redo logic
}

/**
 * Autosaves the current state of tasks and dependencies.
 * This function logs the current state for debugging purposes.
 */
function autosave(): void {
    // Log the autosave event along with current tasks and dependencies.
    console.log("Autosaved", { tasks, dependencies });
}

// --------------------------------------------------
// AppController Subscriptions
// --------------------------------------------------

appController.onCreateTask = (data: ac.IntentData_CreateTask) => {
    const canvas = document.getElementById('canvas') as HTMLElement;
    const rect = canvas.getBoundingClientRect();
    const scale = CustomPanZoom.getScale();
    // Adjust the position based on canvas offset and scale.
    const x = (data.canvasPosition.x - rect.left) / scale;
    const y = (data.canvasPosition.y - rect.top) / scale;
    createTask(x, y);
};

appController.onToggleTaskCompletion = (data: ac.IntentData_ToggleTaskCompletion) => {
    const taskElem = data.taskElement as HTMLElement;
    const taskId = taskElem.getAttribute('data-id') as string;
    const taskData = tasks[taskId];
    // Toggle the completed flag.
    taskData.completed = !taskData.completed;
    // Update the visual representation of task completion.
    DOMController.updateTaskCompletionVisual(taskElem, taskData.completed);
    // Record the toggle action for undo functionality.
    pushUndo({
        type: 'toggleComplete',
        taskId: taskData.id,
        newValue: taskData.completed,
        oldValue: !taskData.completed,
    });
    autosave();
};

appController.onToggleTaskExpansion = (data: ac.IntentData_ToggleTaskExpansion) => {
    const taskElem = data.taskElement as HTMLElement;
    const taskId = taskElem.getAttribute('data-id') as string;
    const taskData = tasks[taskId];
    // Toggle the collapsed flag.
    taskData.collapsed = !taskData.collapsed;
    // Update the visual representation of task expansion.
    DOMController.toggleTaskExpansionVisual(taskElem, taskData.collapsed);
    // Record the toggle action for undo functionality.
    pushUndo({
        type: 'toggleCollapse',
        taskId: taskData.id,
        newValue: taskData.collapsed,
        oldValue: !taskData.collapsed,
    });
    autosave();
};

appController.onChangeTaskTitle = (data: ac.IntentData_ChangeTaskTitle) => {
    const taskElem = data.taskElement as HTMLElement;
    const taskId = taskElem.getAttribute('data-id') as string;
    const taskData = tasks[taskId];
    const oldTitle = taskData.title;
    const newTitle = data.newTitle;
    
    taskData.title = newTitle;
    pushUndo({ type: 'editTask', taskId: taskData.id, field: 'title', newTitle, oldTitle });
    autosave();
};

appController.onChangeTaskDescription = (data: ac.IntentData_ChangeTaskDescription) => {
    const taskElem = data.taskElement as HTMLElement;
    const taskId = taskElem.getAttribute('data-id') as string;
    const taskData = tasks[taskId];
    const oldDescription = taskData.description;
    const newDescription = data.newDescription;

    taskData.description = newDescription;
    pushUndo({ type: 'editTask', taskId: taskId, field: 'description', newDescription, oldDescription });
    autosave();
};

appController.onMoveTasks = (data: ac.IntentData_MoveTasks) => {
    const { taskMovements } = data;
    // Process each task movement.
    taskMovements.forEach((taskMovement: any): void => {
        const { taskElement, canvasPosition } = taskMovement;
        const taskId = taskElement.getAttribute('data-id') as string;
        const taskData = tasks[taskId];
        // Store the current position for undo.
        const currentCanvasPosition = { x: taskData.x, y: taskData.y };
        // Update the task's position.
        taskData.x = canvasPosition.x;
        taskData.y = canvasPosition.y;
        // Reflect the movement in the DOM.
        DOMController.moveTask(taskElement, canvasPosition);
        // Record the move action.
        pushUndo({ type: 'moveTask', taskId, oldPosition: currentCanvasPosition, newPosition: canvasPosition });
        autosave();
    });

    // Update dependency arrows to reflect new task positions.
    dependencies.forEach((dep: Dependency): void => {
        const fromEl = document.querySelector(`.task[data-id="${dep.from}"]`) as HTMLElement;
        const toEl = document.querySelector(`.task[data-id="${dep.to}"]`) as HTMLElement;
        if (fromEl && toEl) {
            // Arrow was created with (toEl, fromEl); update accordingly.
            dep.arrow.update(toEl, fromEl, { pzZoomFactor: CustomPanZoom.getScale() });
        }
    });
};

appController.onDeleteTasks = (data: ac.IntentData_DeleteTasks) => {
    data.taskElements.forEach((taskElem: Element): void => {
        const taskId = taskElem.getAttribute('data-id') as string;
        DOMController.removeTask(taskId);
        delete tasks[taskId];
    });
    autosave();
};

appController.onCreateDependency = (data: ac.IntentData_CreateDependency) => {
    const requiredTaskId = data.requiredTaskElement.getAttribute('data-id') as string;
    const requiredByTaskId = data.requiredByTaskElement.getAttribute('data-id') as string;
    if (requiredTaskId && requiredTaskId !== requiredByTaskId) {
        const arrow = DOMController.addDependency(data.requiredTaskElement, data.requiredByTaskElement, { color: DEPENDENCY_ARROW_COLOR });
        if (arrow) {
            dependencies.push({
                from: requiredTaskId,
                to: requiredByTaskId,
                arrow: arrow,
            });
            pushUndo({
                type: 'addDependency',
                from: requiredTaskId,
                to: requiredByTaskId,
            });
        }
    }
    autosave();
};

appController.onDeleteDependency = (data: ac.IntentData_DeleteDependency) => {
    const depIndex = dependencies.findIndex((d: Dependency): boolean => d.arrow.svg === data.dependencyElement);
    if (depIndex >= 0) {
        DOMController.removeDependency(dependencies[depIndex].arrow);
        dependencies.splice(depIndex, 1);
        autosave();
    }
};

// Undo/Redo intents
appController.onUndo = undo;
appController.onRedo = redo;

// --------------------------------------------------
// Initialization
// --------------------------------------------------

/**
 * Initializes the application once the DOM content is fully loaded.
 */
document.addEventListener('DOMContentLoaded', (): void => {
    const canvas = document.getElementById('canvas') as HTMLElement;
    CustomPanZoom.init(canvas);
    DOMController.init();
});
