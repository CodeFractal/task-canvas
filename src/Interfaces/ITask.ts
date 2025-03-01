import { CanvasCoords } from "../Presenter/CoordinateSystem";
import { IDependency } from "./IDependency";

/** Represents a task */
export interface ITask {

    /** Gets the Id of the task */
    getId(): string;

    /** Gets the title of the task */
    getTitle(): string;

    /** Gets the description of the task */
    getDescription(): string;

    /** Gets whether the task is complete */
    isComplete(): boolean;

    /** Gets the tasks that this task requires
     * @returns A map of required tasks, with the task Id as the key and the dependency as the value
    */
    getRequired(): ReadonlyMap<string, IDependency>;

    /** Gets the tasks that require this task
     * @returns A map of requiring tasks, with the task Id as the key and the dependency as the value
    */
    getRequiredBy(): ReadonlyMap<string, IDependency>;

    /** Gets the position of the task on the canvas */
    getPosition(): CanvasCoords | null;

    /** Gets whether the task is expanded */
    isExpanded(): boolean;

};