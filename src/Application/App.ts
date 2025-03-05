/**
 * Main application file for task management.
 * This file sets up global configurations, maintains application state,
 * and registers event listeners for task and dependency management.
 */

import { TwoKeyMap } from '../Abstract/Collections';
import { IApp } from '../Interfaces/IApp';
import { IDependency } from '../Interfaces/IDependency';
import { ITask } from '../Interfaces/ITask';
import { IPresenter } from '../Interfaces/IPresenter';
import { CanvasCoords } from '../Presenter/CoordinateSystem';
import { Task } from './Task';
import { Dependency } from './Dependency';
import { IStorageProvider } from '../Storage/IStorageProvider';
import { IStorageConnectionProvider } from '../Storage/IStorageConnectionProvider';

/** Object mapping task IDs to Tasks */
const allTasks: Map<number, Task> = new Map();

/** All dependencies keyed by requiredTaskId, requiredByTaskId */
const allDependencies: TwoKeyMap<number, number, Dependency> = new TwoKeyMap();

/** Stack for undo actions */
const undoStack: any[] = [];

/** Stack for redo actions */
const redoStack: any[] = [];

// --------------------------------------------------
// Core Task & Dependency Functions (Business Logic)
// --------------------------------------------------

export class App implements IApp {
    private storageProvider: IStorageProvider | null = null;
    private canvasIsPaused: boolean = false;

    constructor(
        private readonly presenter: IPresenter,
        private readonly storageConnectionProviders: IStorageConnectionProvider[]
    ) { }

    isCanvasPaused(): boolean {
        return this.canvasIsPaused;
    }
    createTask(position: CanvasCoords): ITask {
        const task = new Task({ position });
        allTasks.set(task.id, task);
        this.presenter.addTaskToCanvas(task);

        this.pushUndo({ type: 'addTask', task: task });
        this.saveToStorage(task);
        return task;
    }
    toggleTaskCompletion(itask: ITask, complete: boolean | null): void {
        const task = itask instanceof Task ? itask : allTasks.get(itask.getId());
        if (!task) throw new Error('Task does not exist');

        task.completed = complete === null ? !task.completed : complete;
        this.presenter.toggleTaskCompletion(task, task.completed);

        this.pushUndo({ type: 'toggleComplete', taskId: task.id, newValue: task.completed, oldValue: !task.completed });
        this.saveToStorage(task);
    }
    toggleTaskExpansion(itask: ITask, expand: boolean | null, skipUndo: boolean = false): void {
        const task = itask instanceof Task ? itask : allTasks.get(itask.getId());
        if (!task) throw new Error('Task does not exist');

        task.collapsed = expand === null ? !task.collapsed : !expand;
        this.presenter.toggleTaskExpansion(task, task.collapsed);

        if (!skipUndo) {
            this.pushUndo({ type: 'toggleCollapse', taskId: task.id, newValue: task.collapsed, oldValue: !task.collapsed });
        }
        this.saveToStorage(task);
    }
    changeTaskTitle(itask: ITask, title: string): void {
        const task = itask instanceof Task ? itask : allTasks.get(itask.getId());
        if (!task) throw new Error('Task does not exist');

        const oldTitle = task.title;
        task.title = title;
        this.presenter.setTaskTitle(task, title);

        this.pushUndo({ type: 'editTask', taskId: task.id, field: 'title', newTitle: title, oldTitle: oldTitle });
        this.saveToStorage(task);
    }
    changeTaskDescription(itask: ITask, description: string): void {
        const task = itask instanceof Task ? itask : allTasks.get(itask.getId());
        if (!task) throw new Error('Task does not exist');

        const oldDescription = task.description;
        task.description = description;
        this.presenter.setTaskDescription(task, description);

        if (!description) {
            this.toggleTaskExpansion(task, false);
        }

        this.pushUndo({ type: 'editTask', taskId: task.id, field: 'description', newDescription: description, oldDescription: oldDescription });
        this.saveToStorage(task);
    }
    moveTasks(taskMovements: { task: ITask; position: CanvasCoords; }[]): void {
        const moveLogs: { taskId: number, oldPosition: CanvasCoords, newPosition: CanvasCoords }[] = [];
        const movedTasks: Task[] = [];
        taskMovements.forEach((taskMovement): void => {
            const { task: itask, position } = taskMovement;

            const task = itask instanceof Task ? itask : allTasks.get(itask.getId());
            if (!task) throw new Error('Task does not exist');
    
            const oldPosition = task.getPosition() || CanvasCoords.zero;

            task.position = position;

            this.presenter.moveTask(task, position);

            // Update dependencies
            task.requiredByDependencies.forEach((idep: IDependency): void => {
                const dep = idep instanceof Dependency ? idep : allDependencies.get(idep.getRequiredTask().getId(), idep.getRequiredByTask().getId());
                if (!dep?.arrow) return;

                this.presenter.updateArrow(dep.arrow);
            });
            task.requiredDependencies.forEach((idep: IDependency): void => {
                const dep = idep instanceof Dependency ? idep : allDependencies.get(idep.getRequiredTask().getId(), idep.getRequiredByTask().getId());
                if (!dep?.arrow) return;

                this.presenter.updateArrow(dep.arrow);
            });

            moveLogs.push({ taskId: task.getId(), oldPosition: oldPosition, newPosition: position });
            movedTasks.push(task);
        });

        this.pushUndo({ type: 'moveTasks', taskMovements: moveLogs });
        this.saveToStorage(movedTasks);
    }
    deleteTasks(itasks: ITask[]): void {
        const tasks: Task[] = itasks.map((itask): Task => {
            const task = itask instanceof Task ? itask : allTasks.get(itask.getId());
            if (!task) throw new Error('Task does not exist');            
            return task;
        });
        const deletedTasks: Set<Task> = new Set();
        const deletedDependencies: Set<Dependency> = new Set();

        for (const task of tasks) {
            this.presenter.removeTask(task);
            allTasks.delete(task.getId());
            deletedTasks.add(task);
    
            // Remove dependencies from both sides, but leave them on the task for undo
            task.requiredByDependencies.forEach((idep: IDependency): void => {
                const dep = idep instanceof Dependency ? idep : allDependencies.get(idep.getRequiredTask().getId(), idep.getRequiredByTask().getId());
                if (!dep || deletedDependencies.has(dep)) return;

                this.deleteDependency(dep, false, true);
                deletedDependencies.add(dep);
            });
            task.requiredDependencies.forEach((idep: IDependency): void => {
                const dep = idep instanceof Dependency ? idep : allDependencies.get(idep.getRequiredTask().getId(), idep.getRequiredByTask().getId());
                if (!dep || deletedDependencies.has(dep)) return;

                this.deleteDependency(dep, false, true);
                deletedDependencies.add(dep);
            });
        }

        this.pushUndo({ type: 'deleteTasks', tasks: tasks, dependencies: [...deletedDependencies] });
        this.deleteFromStorage([...deletedTasks, ...deletedDependencies])
    }
    createDependency(requiredITask: ITask, requiredByITask: ITask): IDependency {
        if (requiredITask.getRequired().has(requiredByITask.getId())) {
            return requiredITask.getRequired().get(requiredByITask.getId())!;
        }

        const requiredTask = requiredITask instanceof Task ? requiredITask : allTasks.get(requiredITask.getId());
        if (!requiredTask) throw new Error('Required task does not exist');

        const requiredByTask = requiredByITask instanceof Task ? requiredByITask : allTasks.get(requiredByITask.getId());
        if (!requiredByTask) throw new Error('Required by task does not exist');

        const dependency = new Dependency(requiredTask, requiredByTask);
        allDependencies.set(requiredTask.id, requiredByTask.id, dependency);
        requiredTask.requiredByDependencies.set(requiredByTask.id, dependency);
        requiredByTask.requiredDependencies.set(requiredTask.id, dependency);

        const arrow = this.presenter.addDependency(dependency);
        dependency.arrow = arrow;

        this.pushUndo({ type: 'addDependency', from: requiredTask.getId(), to: requiredByTask.getId() });
        this.saveToStorage(dependency);
        return dependency;
    }
    deleteDependency(iDependency: IDependency, detachFromTasks: boolean = true, skipUndo: boolean = false): void {
        const dependency = iDependency instanceof Dependency ? iDependency : allDependencies.get(iDependency.getRequiredTask().getId(), iDependency.getRequiredByTask().getId());
        if (dependency) {
            const requiredITask = dependency.getRequiredTask();
            const requiredByITask = dependency.getRequiredByTask();
            if (detachFromTasks) {
                const requiredTask = requiredITask instanceof Task ? requiredITask : allTasks.get(requiredITask.getId());
                if (!requiredTask) throw new Error('Required task does not exist');        
                const requiredByTask = requiredByITask instanceof Task ? requiredByITask : allTasks.get(requiredByITask.getId());
                if (!requiredByTask) throw new Error('Required by task does not exist');        
                requiredTask.requiredByDependencies.delete(requiredByTask.getId());
                requiredByTask.requiredDependencies.delete(requiredTask.getId());
            }
            allDependencies.delete(requiredITask.getId(), requiredByITask.getId());
            this.presenter.removeDependency(dependency);
            
            if (!skipUndo) {
                this.pushUndo({ type: 'deleteDependency', from: requiredITask.getId(), to: requiredByITask.getId() });
            }
            this.deleteFromStorage(dependency);
        }
    }

    //----------------------------------------------
    // Pause & Unpause
    //----------------------------------------------
    pauseCanvas(): void {
        this.presenter.pauseCanvas();
        this.canvasIsPaused = true;
    }
    unpauseCanvas(): void {
        this.presenter.unpauseCanvas();
        this.canvasIsPaused = false;
    }

    //----------------------------------------------
    // Undo & Redo
    //----------------------------------------------
    pushUndo(action: any): void {
        // TODO: Implement undo logic
    }
    undo(): boolean {
        throw new Error('Method not implemented.');
    }
    redo(): boolean {
        throw new Error('Method not implemented.');
    }

    //----------------------------------------------
    // Save & Load
    //----------------------------------------------
    async requestConnectionToStorage(doPause: boolean = true): Promise<IStorageProvider | null> {
        if (this.storageConnectionProviders.length === 1) {
            const storageConnectionProvider = this.storageConnectionProviders[0];

            // Pause canvas if requested
            if (doPause) this.pauseCanvas();

            // New or existing canvas
            const newOrExisting = await this.presenter.showModal("New or Existing Canvas", "Would you like to create a new canvas or load an existing one?", [
                ['NEW', "New Canvas"],
                ['LOAD', "Open Canvas"]
            ]);
            const isNew = newOrExisting === 'NEW';
            
            // Authenticate
            const authenticated = await storageConnectionProvider.requestAuthentication();
            if (authenticated) {
                this.storageProvider = await storageConnectionProvider.requestConnection(isNew);
            }

            // Unpause canvas if paused
            if (doPause) this.unpauseCanvas();

            return this.storageProvider;
        }
        if (this.storageConnectionProviders.length === 0) {
            throw new Error('No storage connection providers available');
        }
        throw new Error('Multiple storage connection providers - not yet implemented');
    }    
    async load(doPause: boolean = true): Promise<void> {
        if (!this.storageProvider) throw new Error('No storage provider connected');

        // Pause canvas if requested
        if (doPause) this.pauseCanvas();
        
        // Load tasks
        const data = await this.storageProvider.retrieveCanvasData();
        data.tasks.forEach((taskData): void => {
            const task = new Task({
                id: taskData.id,
                title: taskData.title,
                description: taskData.description,
                position: CanvasCoords.new(taskData.position.x, taskData.position.y),
                completed: taskData.completed,
                collapsed: taskData.collapsed
            });
            allTasks.set(task.id, task);
            this.presenter.addTaskToCanvas(task);
        });

        // Load dependencies
        data.dependencies.forEach((depData): void => {
            const requiredTask = allTasks.get(depData.requiredTaskId);
            const requiredByTask = allTasks.get(depData.requiredByTaskId);
            if (!requiredTask || !requiredByTask) return;

            const dependency = new Dependency(requiredTask, requiredByTask);
            allDependencies.set(requiredTask.id, requiredByTask.id, dependency);
            requiredTask.requiredByDependencies.set(requiredByTask.id, dependency);
            requiredByTask.requiredDependencies.set(requiredTask.id, dependency);

            const arrow = this.presenter.addDependency(dependency);
            dependency.arrow = arrow;
        });

        // TODO: Implement saving and loading of canvas pan and zoom
        //this.presenter.setCanvasPan(data.pan);
        //this.presenter.setCanvasZoom(data.zoom);

        // Unpause canvas if paused
        if (doPause) this.unpauseCanvas();

    }
    private saveToStorage(entities: Task | Dependency | ReadonlyArray<Task | Dependency>): void {
        if (!this.storageProvider) console.warn('No storage provider connected');
        else if (Array.isArray(entities)) this.storageProvider.saveMany(entities.map(e => e.toStorageModel()));
        else if (entities instanceof Task) this.storageProvider.saveTask(entities.toStorageModel());
        else if (entities instanceof Dependency) this.storageProvider.saveDependency(entities.toStorageModel());
    }
    private deleteFromStorage(entities: Task | Dependency | ReadonlyArray<Task | Dependency>): void {
        if (!this.storageProvider) console.warn('No storage provider connected');
        else if (Array.isArray(entities)) this.storageProvider.deleteMany(entities.map(e => e.toStorageModel()));
        else if (entities instanceof Task) this.storageProvider.deleteTask(entities.toStorageModel());
        else if (entities instanceof Dependency) this.storageProvider.deleteDependency(entities.toStorageModel());
    }

}
