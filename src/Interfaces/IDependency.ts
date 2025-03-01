import { ITask } from "./ITask";

/** Represents a dependency between two tasks */
export interface IDependency {

    /** Gets the task being required */
    getRequiredTask(): ITask;

    /** Gets the task requiring another */
    getRequiredByTask(): ITask;

}