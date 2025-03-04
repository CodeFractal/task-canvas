import { IDependency } from "../Interfaces/IDependency";
import { Arrow } from "../Interfaces/IPresenter";
import { ITask } from "../Interfaces/ITask";
import { IDependencyDataModel } from "../Storage/DataModel";

/** Represents a dependency between two tasks */
export class Dependency implements IDependency {
    public arrow?: Arrow;

    constructor(
        public readonly requiredTask: ITask,
        public readonly requiredByTask: ITask
    ) { }

    getRequiredTask(): ITask { return this.requiredTask; }
    getRequiredByTask(): ITask { return this.requiredByTask; }

    toStorageModel(): IDependencyDataModel {
        return {
            requiredTaskId: this.requiredTask.getId(),
            requiredByTaskId: this.requiredByTask.getId()
        };
    }
}
