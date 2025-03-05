import { IDependency } from "../Interfaces/IDependency";
import { ITask } from "../Interfaces/ITask";
import { CanvasCoords } from "../Presenter/CoordinateSystem";
import { ITaskDataModel } from "../Storage/DataModel";

/** Represents the data for a task */
export class Task implements ITask {
    private static taskIdCounter: number = 1;

    public readonly id: number;
    public title: string;
    public description: string;
    public position: CanvasCoords | null;
    public completed: boolean;
    public collapsed: boolean;

    public requiredDependencies: Map<number, IDependency> = new Map();
    public requiredByDependencies: Map<number, IDependency> = new Map();

    constructor(
        options: Partial<Task> = {}
    ) {
        if (options.id) {
            Task.taskIdCounter = Math.max(Task.taskIdCounter, options.id + 1);
        }
        this.id = options.id || Task.taskIdCounter++;
        this.title = options.title || 'New Task';
        this.description = options.description || '';
        this.position = options.position || null;
        this.completed = options.completed || false;
        this.collapsed = options.collapsed || true;
    }

    getId(): number { return this.id; }
    getTitle(): string { return this.title; }
    getDescription(): string { return this.description; }
    isComplete(): boolean { return this.completed; }
    getRequired(): ReadonlyMap<number, IDependency> { return this.requiredDependencies; }
    getRequiredBy(): ReadonlyMap<number, IDependency> { return this.requiredByDependencies; }
    getPosition(): CanvasCoords | null { return this.position; }
    isExpanded(): boolean { return !this.collapsed; }

    toStorageModel(): ITaskDataModel {
        if (!this.position) { throw new Error('Task must have a position to be saved'); }
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            completed: this.completed,
            position: this.position,
            collapsed: this.collapsed
        };
    }
}
