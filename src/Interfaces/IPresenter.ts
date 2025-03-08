import { CanvasCoords, ScreenCoords, SizeOnScreen } from "../Presenter/CoordinateSystem";
import { IDependency } from "./IDependency";
import { ITask } from "./ITask";

/** Represents the presenter layer of the application */
export interface IPresenter {

    /**
     * Dims the canvas and pauses any canvas animations.
     * This is used for modal dialogs.
     */
    pauseCanvas(): void;

    /**
     * Restores the canvas to its normal state after pausing.
     */
    unpauseCanvas(): void;

    /**
     * Shows a modal dialog.
     * @param title The title of the dialog.
     * @param message The message to display.
     * @param options An array of tuples where each tuple contains a button key and its human-readable label.
     * @returns A promise that resolves with the key of the selected button.
     */
    showModal(title: string, message: string, options: [string, string][]): Promise<string>;

    /**
     * Gets the current position of the canvas.
     */
    getCanvasPan(): ScreenCoords;

    /**
     * Sets the position of the canvas.
     * @param position The new x and y coordinates.
     */
    setCanvasPan(position: ScreenCoords): void;

    /**
     * Gets the current scale of the canvas.
     */
    getCanvasScale(): number;

    /**
     * Sets the scale of the canvas.
     * @param scale The new scale factor.
     * @param center The center point to scale around. If omitted, the center of the viewport is used.
     */
    setCanvasScale(scale: number, center?: ScreenCoords): void;

    /**
     * Gets the size of the canvas on the screen.
     */
    toggleSpinner(visible: boolean): void;

    /**
     * Gets the current position of a task element in canvas space.
     * @param task The task to get the position of.
     */
    getTaskPositionOnCanvas(task: ITask): CanvasCoords;

    /**
     * Toggles the visual highlight on a task element.
     * @param task The task to highlight.
     * @param highlight If true, adds the highlight; if false, removes it.
     */
    toggleTaskHighlight(task: ITask, highlight: boolean): void;

    /**
     * Toggles the visual highlights on all task elements.
     * @param highlight If true, adds the highlight; if false, removes it.
     */
    toggleAllTaskHighlights(highlight: boolean): void;

    /**
     * Creates and displays a selection box on the canvas.
     * This box is used for selecting multiple tasks.
     * @throws Error if the canvas is not initialized.
     */
    showSelectionBox(): void;

    /**
     * Updates the location of the selection box.
     * @param start The first point defining the selection area (in screen space).
     * @param end The current point defining the selection area (in screen space).
     */
    moveSelectionBox(start: ScreenCoords, end: ScreenCoords): void;

    /**
     * Hides and removes the selection box element from the canvas.
     */
    hideSelectionBox(): void;

    /**
     * Gets all task elements on the canvas.
     * @returns An array of all tasks on the canvas.
     */
    getAllTasks(): ITask[];

    /**
     * Finds all task elements on the canvas that intersect the provided selection area.
     * @param start The first point defining the selection area (in screen space).
     * @param end The ending point of the selection area (in screen space).
     * @returns An array of tasks within the selection area.
     */
    getTasksInArea(start: ScreenCoords, end: ScreenCoords): ITask[];

    /**
     * Displays the context menu at a specified position with provided options.
     * @param position The x and y coordinates where the menu should appear in screen space.
     * @param options An array of tuples where each tuple contains an option key and its human-readable label.
     */
    showContextMenu(position: ScreenCoords, options: [string, string][]): void;

    /**
     * Hides the context menu.
     */
    hideContextMenu(): void;

    /**
     * Adds a new task element to the canvas with the provided data.
     * @param task  An object containing task details such as id, title, description, position, completion, and collapsed state.
     */
    addTaskToCanvas(task: ITask): void;

    /**
     * Moves a task element to a new position on the canvas.
     * Optionally adjusts the z-index ordering.
     * @param task The task to move.
     * @param position The new x and y coordinates.
     * @param autoAdjustZPosition If true, reorders the task in the DOM based on position.
     */
    moveTask(task: ITask, position: CanvasCoords, autoAdjustZPosition?: boolean): void;

    /**
     * Adjusts the z-index ordering of a task element based on its position.
     * @param task The task to adjust.
     * @param position The new x and y coordinates.
     */
    adjustTaskZPosition(task: ITask, position: CanvasCoords): void;

    /**
     * Toggles the inline editing mode for a task's title.
     * @param task The task to edit.
     * @param enable True to enable editing; false to disable.
     */
    toggleEditModeForTaskTitle(task: ITask, enable: boolean): void;

    /**
     * Gets the title of a task element.
     * @param task The task to get the title of.
     * @returns The title text or null if not found.
     */
    getTaskTitle(task: ITask): string | null;

    /**
     * Updates the visual representation of a task's title.
     * @param task The task to update.
     * @param title The new title to display.
     */
    setTaskTitle(task: ITask, title: string): void;

    /**
     * Toggles the inline editing mode for a task's description.
     * @param task The task to edit.
     * @param enable True to enable editing; false to disable.
     */
    toggleEditModeForTaskDescription(task: ITask, enable: boolean): void;

    /**
     * Gets the description of a task element.
     * @param task The task to get the description of.
     * @returns The description text or null if not found.
     */
    getTaskDescription(task: ITask): string | null;

    /**
     * Updates the visual representation of a task's description.
     * @param task The task to update.
     * @param description The new description to display.
     */
    setTaskDescription(task: ITask, description: string): void;

    /**
     * Updates the visual representation of a task's completion status.
     * @param task The task to update.
     * @param completed True if the task is completed; otherwise, false.
     */
    toggleTaskCompletion(task: ITask, completed: boolean): void;

    /**
     * Toggles the expansion (collapse/expand) visual state of a task.
     * @param task The task to toggle.
     * @param collapsed True if the task should be collapsed; otherwise, expanded.
     */
    toggleTaskExpansion(task: ITask, collapsed: boolean): void;

    /**
     * Removes a task from the canvas.
     * @param task The task to be removed.
     */
    removeTask(task: ITask): void;

    /**
     * Adds a dependency arrow to the canvas.
     * @param dependency The dependency object containing the source and target tasks.
     */
    addDependency(dependency: IDependency): Arrow;

    /**
     * Removes a dependency arrow from the canvas.
     * @param dependency The dependency object to remove.
     */
    removeDependency(dependency: IDependency): void;

    /**
     * Creates a custom arrow on the canvas.
     * @param source The source task or position.
     * @param target The target task or position.
     * @returns The arrow representing the connection.
     */
    createArrow(source: ITask | CanvasCoords, target: ITask | CanvasCoords): Arrow;

    /**
     * Updates a custom arrow on the canvas.
     * @param arrow The dependency arrow to update.
     * @param options The source and target tasks or positions. Omitting the source or target will leave it unchanged.
     */
    updateArrow(
        arrow: Arrow,
        options?: {
            source?: ITask | CanvasCoords;
            target?: ITask | CanvasCoords;
            isGhostArrow?: boolean;
        } | undefined
    ): void;

    /**
     * Removes a custom arrow from the canvas.
     * @param arrow The arrow to remove.
     */
    removeArrow(arrow: Arrow): void;

}

/** An extension of the IPresenter interface that allow the controller to exchange DOM references for app data */
export interface IControllerPresenter extends IPresenter {
    
    /** Retrieves the task and task component associated with a provided element.
     * @param element The element to check.
     * @returns An object containing the task and component type or null if not found.
     */
    getTaskInfo(element: Element): { task: ITask, component: TaskComponent } | null;

    /** Retrieves the task associated with a provided element.
     * @param element The element to check.
     * @returns The task or null if not found.
     */
    getTask(element: Element): ITask | null;

    /** Retrieves the dependency associated with a provided element.
     * @param element The element to check.
     * @returns The dependency or null if not found.
     */
    getDependency(element: Element): IDependency | null;

    /** Retrieves the option key from a clicked context menu item.
     * @param element The clicked element.
     * @returns The option key string or null if not found.
     */
    getContextMenuOption(element: Element): string | null;

}

/** Represents an arrow drawn on the canvas */
export interface Arrow {

    /** Gets what the arrow is pointed at. It could be a task or a position on the canvas */
    getTarget(): ITask | CanvasCoords;

    /** Gets what the arrow is extending from. It could be a task or a position on the canvas */
    getSource(): ITask | CanvasCoords;

}

/** Represents a sub-component of a task (or the task itself) */
export enum TaskComponent {
    Task = "task",
    Header = "header",
    Title = "title",
    Description = "description",
    Completion = "completion",
    Collapse = "collapse"
}