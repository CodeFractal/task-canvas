import { IStorageProvider } from "../IStorageProvider";
import { ICanvasDataModel, ITaskDataModel, IDependencyDataModel } from "../DataModel";
import { GoogleDriveService } from "./GoogleDriveService";
import { SimpleEvent } from "../../Abstract/SimpleEvent";
import { SafeResource } from "../../Abstract/Concurrency";
import { DebounceScheduler } from "../../Abstract/Concurrency";

/** The amount of time (in ms) to wait: after a request to save, for a follow-up request to save, before actually saving */
const SAVE_DELAY = 1500;
/** The minimim amount of time (in ms) to wait: after the last save completes, before attempting another save */
const SAVE_COOLDOWN = 3500;

export class GoogleDriveStorageProvider implements IStorageProvider {
    private readonly _service: GoogleDriveService;
    private readonly canvasData: SafeResource<CanvasData>;
    private fileId: string;
    private mimeType: string;
    private saveDebouncer: DebounceScheduler;

    constructor(service: GoogleDriveService, fileId: string, mimeType: string) {
        this._service = service;
        this.fileId = fileId;
        this.mimeType = mimeType;
        this.canvasData = new SafeResource(new CanvasData());
        this.saveDebouncer = new DebounceScheduler(() => this.doSave(), SAVE_DELAY, SAVE_COOLDOWN);
    }

    public readonly isBusyChanged = new SimpleEvent<[isBusy: boolean]>();

    get isBusy(): boolean { return this.busyCount > 0; }
    get locationId(): string { return this.fileId; }

    async retrieveCanvasData(): Promise<ICanvasDataModel> {
        const data = await this.load() ?? undefined;
        const newCanvasData = new CanvasData(data);
        this.canvasData.setResource(newCanvasData);
        return data ?? newCanvasData.toStorageModel();
    }
    async saveCanvasData(canvasData: ICanvasDataModel): Promise<void> {
        const newCanvasData = new CanvasData(canvasData);
        await this.canvasData.setResource(newCanvasData);
        this.requestSave();
    }
    async saveTask(task: ITaskDataModel): Promise<void> {
        await this.canvasData.withResource(canvasData => {
            canvasData.addOrUpdateTask(new TaskDataModel(task));
        });
        this.requestSave();
    }
    async deleteTask(task: ITaskDataModel): Promise<boolean> {
        const removed = await this.canvasData.withResource(canvasData => {
            return canvasData.removeTask(new TaskDataModel(task));
        });
        if (removed) {
            this.requestSave();
            return true;
        }
        return false;
    }
    async saveDependency(dependency: IDependencyDataModel): Promise<void> {
        const added = await this.canvasData.withResource(canvasData => {
            return canvasData.addDependency(dependency);
        });
        if (added) {
            this.requestSave();
        }
    }
    async deleteDependency(dependency: IDependencyDataModel): Promise<boolean> {
        const removed = await this.canvasData.withResource(canvasData => {
            return canvasData.removeDependency(dependency);
        });
        if (removed) {
            this.requestSave();
            return true;
        }
        return false;
    }
    async saveMany(entities: ReadonlyArray<ITaskDataModel | IDependencyDataModel>): Promise<void> {
        let changed = false;
        await this.canvasData.withResource(canvasData => {
            for (const entity of entities) {
                const [task, dep] = this.resolveDataModel(entity);

                if (task) changed = canvasData.addOrUpdateTask(new TaskDataModel(task)) || changed;
                else if (dep) changed = canvasData.addDependency(dep) || changed;
            }
        });
        if (changed) {
            this.requestSave();
        }
    }
    async deleteMany(entities: ReadonlyArray<ITaskDataModel | IDependencyDataModel>): Promise<void> {
        let changed = false;
        await this.canvasData.withResource(canvasData => {
            for (const entity of entities) {
                let task: ITaskDataModel | undefined = entity as ITaskDataModel;
                if (!task.title) task = undefined;
                let dep: IDependencyDataModel | undefined = entity as IDependencyDataModel;
                if (task || !dep.requiredTaskId) dep = undefined;
    
                if (task) changed = canvasData.removeTask(new TaskDataModel(task)) || changed;
                else if (dep) changed = canvasData.removeDependency(dep) || changed;
            }
        });
        if (changed) {
            this.requestSave();
        }
    }

    private resolveDataModel(entity: ITaskDataModel | IDependencyDataModel): [ITaskDataModel | undefined, IDependencyDataModel | undefined] {
        let task: ITaskDataModel | undefined = entity as ITaskDataModel;
        if (!task.title) task = undefined;
        let dep: IDependencyDataModel | undefined = entity as IDependencyDataModel;
        if (task || !dep.requiredTaskId) dep = undefined;

        return [task, dep];
    }
    
    private async load(): Promise<ICanvasDataModel | null> {
        this.busyCount++;
        const content = await this._service.open(this.fileId);
        this.busyCount--;
        return content ? JSON.parse(content) as ICanvasDataModel : null;
    }

    private requestSave(): void {
        this.saveDebouncer.request();
    }

    private async doSave(): Promise<void> {
        const data = await this.canvasData.withResource(canvasData => canvasData);
        const content = JSON.stringify(data.toStorageModel(), null, 2);
        
        this.busyCount++;
        await this._service.save(this.fileId, content, this.mimeType);
        this.busyCount--;
    }

    private _busyCount: number = 0;
    private get busyCount(): number { return this._busyCount; }
    private set busyCount(value: number) {
        const isBusy = value > 0;
        const isBusyChanged = isBusy !== this._busyCount > 0;
        this._busyCount = value;
        if (isBusyChanged) {
            this.isBusyChanged.invoke(isBusy)
        }
    }
}

class CanvasData {
    public version: string;
    private taskMap: Map<number, TaskDataModel>;
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
    public id: number;
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
    public requiredTaskId: number;
    public requiredByTaskId: number;

    constructor(model: IDependencyDataModel) {
        this.requiredTaskId = model.requiredTaskId;
        this.requiredByTaskId = model.requiredByTaskId;
    }
}
