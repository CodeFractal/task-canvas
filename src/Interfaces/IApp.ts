import { CanvasCoords } from "../Presenter/CoordinateSystem";
import { IDependency } from "./IDependency";
import { IStorageProvider } from "../Storage/IStorageProvider";
import { ITask } from "./ITask";
import { IStorageLocation } from "../Storage/IStorageLocation";

/** An interface which allows the controller to drive the application */
export interface IApp {

    /** Requests a connection to a storage provider
     * @returns The storage provider, if one was selected, or null if the user cancelled the request
     */
    requestConnectionToStorage(): Promise<IStorageProvider | null>;

    /** Requests a connection to a specific location
     * @param locationId The ID of the location to connect to
     * @returns The storage provider, if one was selected, or null if the user cancelled the request
     */
    requestConnectionToStorageLocation(location: IStorageLocation): Promise<IStorageProvider | null>;

    /** Loads data from the storage provider */
    load(): Promise<void>;

    /** Returns whether the canvas is paused */
    isCanvasPaused(): boolean;

    /** Creates a new task
     * @param position The desired position of the task on the canvas
     * @returns The newly created task
    */
    createTask(position: CanvasCoords): ITask;

    /** Toggles the completion of a task
     * @param task The task whose completion should be toggled
     * @param complete Whether the task should be marked as complete, incomplete, or toggled
     */
    toggleTaskCompletion(task: ITask, complete: boolean | null): void;

    /** Expands or collapses a task
     * @param task The task to be expanded or collapsed
     * @param expand Whether the task should be expanded, collapsed, or toggled
     */
    toggleTaskExpansion(task: ITask, expand: boolean | null): void;

    /** Changes the title of a task
     * @param task The task whose title should be changed
     * @param title The new title of the task
     */
    changeTaskTitle(task: ITask, title: string): void;

    /** Changes the description of a task
     * @param task The task whose description should be changed
     * @param description The new description of the task
     */
    changeTaskDescription(task: ITask, description: string): void;

    /** Moves multiple tasks to new positions on the canvas
     * @param taskMovements An array of task movements to be made, each specifying the task to be moved and its new position
     */
    moveTasks(taskMovements: { task: ITask, position: CanvasCoords }[]): void;

    /** Deletes a set of tasks
     * @param tasks The tasks to be deleted
     */
    deleteTasks(tasks: ITask[]): void;

    /** Creates a new dependency between two tasks
     * @param requiredTask The task being required
     * @param requiredByTask The task requiring another
     * @returns The newly created dependency
     */
    createDependency(requiredTask: ITask, requiredByTask: ITask): IDependency;

    /** Deletes a dependency
     * @param dependency The dependency to be deleted
     */
    deleteDependency(dependency: IDependency): void;

    /** Undoes the most recent action
     * @returns Whether an action was undone
    */
    undo(): boolean;

    /** Redoes the most recent undone action
     * @returns Whether an action was redone
    */
    redo(): boolean;

    /** Pauses the canvas, preventing further user interaction */
    pauseCanvas(): void;

    /** Unpauses the canvas, reallowing user interaction after the canvas has been paused */
    unpauseCanvas(): void;

};
