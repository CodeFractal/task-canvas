import { IDependency } from "../Interfaces/IDependency";
import { ITask } from "../Interfaces/ITask";
import { CanvasCoords } from "../Presenter/CoordinateSystem";

/** Represents the data for a task */
export class Task implements ITask {
    private static taskIdCounter: number = 0;

    public readonly id: string;
    public title: string;
    public description: string;
    public position: CanvasCoords | null;
    public completed: boolean;
    public collapsed: boolean;

    public requiredDependencies: Map<string, IDependency> = new Map();
    public requiredByDependencies: Map<string, IDependency> = new Map();

    constructor(
        options: Partial<Task> = {}
    ) {
        this.id = options.id || `task-${Task.taskIdCounter++}`;
        this.title = options.title || 'New Task';
        this.description = options.description || '<p>Description</p>';
        this.position = options.position || null;
        this.completed = options.completed || false;
        this.collapsed = options.collapsed || false;
    }

    getId(): string { return this.id; }
    getTitle(): string { return this.title; }
    getDescription(): string { return this.description; }
    isComplete(): boolean { return this.completed; }
    getRequired(): ReadonlyMap<string, IDependency> { return this.requiredDependencies; }
    getRequiredBy(): ReadonlyMap<string, IDependency> { return this.requiredByDependencies; }
    getPosition(): CanvasCoords | null { return this.position; }
    isExpanded(): boolean { return !this.collapsed; }
}
