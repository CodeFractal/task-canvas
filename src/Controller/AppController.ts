import { Vector2D } from "../Abstract/Math";

/** An interface which allows the app to listen for user intents */
export interface AppController {

    /** Called when the user intends to create a new task */
    onCreateTask?: (data: IntentData_CreateTask) => void;

    /** Called when the user intends to toggle the completion of a task */
    onToggleTaskCompletion?: (data: IntentData_ToggleTaskCompletion) => void;

    /** Called when the user intends to expand or collapse a task based on its current state */
    onToggleTaskExpansion?: (data: IntentData_ToggleTaskExpansion) => void;

    /** Called when the user intends to change the title of a task */
    onChangeTaskTitle?: (data: IntentData_ChangeTaskTitle) => void;

    /** Called when the user intends to change the description of a task */
    onChangeTaskDescription?: (data: IntentData_ChangeTaskDescription) => void;

    /** Called when the user intends to change the position of a task */
    onMoveTasks?: (data: IntentData_MoveTasks) => void;

    /** Called when the user intends to delete a task */
    onDeleteTasks?: (data: IntentData_DeleteTasks) => void;

    /** Called when the user intends to create a new dependency */
    onCreateDependency?: (data: IntentData_CreateDependency) => void;

    /** Called when the user intends to delete a dependency */
    onDeleteDependency?: (data: IntentData_DeleteDependency) => void;

    /** Called when the user intends to undo the last action */
    onUndo?: () => void;

    /** Called when the user intends to redo the last undone action */
    onRedo?: () => void;

}

/** Holds data associated with the user's intent to create a new task */
export interface IntentData_CreateTask {
    /** The desired position of the task in canvas coordinates */
    canvasPosition: Vector2D;
}

/** Holds data associated with the user's intent to toggle the completion of a task */
export interface IntentData_ToggleTaskCompletion {
    /** The task whose completion should be toggled on/off */
    taskElement: Element;
}

/** Holds data associated with the user's intent to expand or collapse a task */
export interface IntentData_ToggleTaskExpansion {
    /** The task to be expanded or collapsed */
    taskElement: Element;
}

/** Holds data associated with the user's intent to change the title of a task */
export interface IntentData_ChangeTaskTitle {
    /** The task whose title should be changed */
    taskElement: Element;
    /** The new title of the task */
    newTitle: string;
}

/** Holds data associated with the user's intent to change the description of a task */
export interface IntentData_ChangeTaskDescription {
    /** The task whose description should be changed */
    taskElement: Element;
    /** The new description of the task */
    newDescription: string;
}

/** Holds data associated with the user's intent do move a task */
export interface IntentData_MoveTask {
    /** The task to be moved */
    taskElement: Element;
    /** The new position of the task in canvas coordinates */
    canvasPosition: Vector2D;
}

/** Holds data associated with the user's intent to move a task */
export interface IntentData_MoveTasks {
    /** An array of task movements to be made, each specifying the task to be moved and its new position */
    taskMovements: IntentData_MoveTask[];
}

/** Holds data associated with the user's intent to delete a task */
export interface IntentData_DeleteTasks {
    /** The tasks to be deleted */
    taskElements: Element[];
}

/** Holds data associated with the user's intent to create a new dependency */
export interface IntentData_CreateDependency {
    /** The task being required by another */
    requiredTaskElement: Element;
    /** The task which requires another */
    requiredByTaskElement: Element;
}

/** Holds data associated with the user's intent to delete a dependency */
export interface IntentData_DeleteDependency {
    /** The dependency to be deleted */
    dependencyElement: Element;
}

  