import { IStorageProvider } from "../IStorageProvider";
import { ICanvasDataModel, ITaskDataModel, IDependencyDataModel } from "../DataModel";
import { GoogleDriveService } from "./GoogleDriveService";

export class GoogleDriveStorageProvider implements IStorageProvider {
    private readonly _service: GoogleDriveService;
    private canvasData: CanvasData;
    private fileId: string;
    private mimeType: string;

    constructor(service: GoogleDriveService, fileId: string, mimeType: string) {
        this._service = service;
        this.fileId = fileId;
        this.mimeType = mimeType;
        this.canvasData = new CanvasData();
    }

    get locationId(): string { return this.fileId; }

    async retrieveCanvasData(): Promise<ICanvasDataModel> {
        const content = await this._service.open(this.fileId);
        const data = content ? JSON.parse(content) as ICanvasDataModel : undefined;
        this.canvasData = new CanvasData(data);
        return data ?? this.canvasData.toStorageModel();
    }
    saveCanvasData(canvasData: ICanvasDataModel): Promise<void> {
        this.canvasData = new CanvasData(canvasData);
        return this.save();
    }
    saveTask(task: ITaskDataModel): Promise<void> {
        this.canvasData.addOrUpdateTask(new TaskDataModel(task));
        return this.save();
    }
    async deleteTask(task: ITaskDataModel): Promise<boolean> {
        if (this.canvasData.removeTask(new TaskDataModel(task))) {
            await this.save();
            return true;
        }
        return false;
    }
    async saveDependency(dependency: IDependencyDataModel): Promise<void> {
        if (this.canvasData.addDependency(dependency)) {
            await this.save();
        }
    }
    async deleteDependency(dependency: IDependencyDataModel): Promise<boolean> {
        if (this.canvasData.removeDependency(dependency)) {
            await this.save();
            return true;
        }
        return false;
    }
    async saveMany(entities: ReadonlyArray<ITaskDataModel | IDependencyDataModel>): Promise<void> {
        let changed = false;
        for (const entity of entities) {
            const [task, dep] = this.resolveDataModel(entity);

            if (task) changed = this.canvasData.addOrUpdateTask(new TaskDataModel(task)) || changed;
            else if (dep) changed = this.canvasData.addDependency(dep) || changed;
        }
        if (changed) {
            await this.save();
        }
    }
    async deleteMany(entities: ReadonlyArray<ITaskDataModel | IDependencyDataModel>): Promise<void> {
        let changed = false;
        for (const entity of entities) {
            let task: ITaskDataModel | undefined = entity as ITaskDataModel;
            if (!task.title) task = undefined;
            let dep: IDependencyDataModel | undefined = entity as IDependencyDataModel;
            if (task || !dep.requiredTaskId) dep = undefined;

            if (task) changed = this.canvasData.removeTask(new TaskDataModel(task)) || changed;
            else if (dep) changed = this.canvasData.removeDependency(dep) || changed;
        }
        if (changed) {
            await this.save();
        }
    }

    private resolveDataModel(entity: ITaskDataModel | IDependencyDataModel): [ITaskDataModel | undefined, IDependencyDataModel | undefined] {
        let task: ITaskDataModel | undefined = entity as ITaskDataModel;
        if (!task.title) task = undefined;
        let dep: IDependencyDataModel | undefined = entity as IDependencyDataModel;
        if (task || !dep.requiredTaskId) dep = undefined;

        return [task, dep];
    }
    
    private async save(): Promise<void> {
        const content = JSON.stringify(this.canvasData.toStorageModel(), null, 2);
        return this._service.save(this.fileId, content, this.mimeType);
    }
}

class CanvasData {
    public version: string;
    private taskMap: Map<string, TaskDataModel>;
    private depMap: Map<string, DependencyDataModel>;
    public pan: { x: number; y: number; };
    public zoom: number;

    constructor(options?: Partial<ICanvasDataModel>) {
        this.version = options?.version || '1.0';
        this.taskMap = options?.tasks ? new Map(options.tasks.map(t => [t.id, new TaskDataModel(t)])) : new Map();
        this.depMap = options?.dependencies ? new Map(options.dependencies.map(d => [`${d.requiredTaskId}->${d.requiredByTaskId}`, d])) : new Map();
        this.pan = options?.pan || { x: 0, y: 0 };
        this.zoom = options?.zoom || 1;
    }

    public addOrUpdateTask(task: TaskDataModel): boolean {
        this.taskMap.set(task.id, task);
        return true;
    }
    public removeTask(task: TaskDataModel): boolean {
        return this.taskMap.delete(task.id);
    }
    public addDependency(dep: IDependencyDataModel): boolean {
        const key = `${dep.requiredTaskId}->${dep.requiredByTaskId}`;
        if (this.depMap.has(key)) return false;

        this.depMap.set(key, dep);
        return true;
    }
    public removeDependency(dep: IDependencyDataModel): boolean {
        return this.depMap.delete(`${dep.requiredTaskId}->${dep.requiredByTaskId}`);
    }

    toStorageModel(): ICanvasDataModel {
        return {
            version: this.version,
            tasks: [...this.taskMap.values()],
            dependencies: [...this.depMap.values()],
            pan: this.pan,
            zoom: this.zoom
        };
    }
}

class TaskDataModel implements ITaskDataModel {
    public id: string;
    public title: string;
    public description: string;
    public completed: boolean;
    public position: { x: number; y: number; };
    public collapsed: boolean;

    constructor(model: ITaskDataModel) {
        this.id = model.id;
        this.title = model.title;
        this.description = model.description;
        this.completed = model.completed;
        this.position = {
            x: model.position.x,
            y: model.position.y
        };
        this.collapsed = model.collapsed;
    }
}

class DependencyDataModel implements IDependencyDataModel {
    public requiredTaskId: string;
    public requiredByTaskId: string;

    constructor(model: IDependencyDataModel) {
        this.requiredTaskId = model.requiredTaskId;
        this.requiredByTaskId = model.requiredByTaskId;
    }
}