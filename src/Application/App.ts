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

/** Object mapping task IDs to Tasks */
const allTasks: Map<string, Task> = new Map();

/** All dependencies keyed by requiredTaskId, requiredByTaskId */
const allDependencies: TwoKeyMap<string, string, Dependency> = new TwoKeyMap();

/** Stack for undo actions */
const undoStack: any[] = [];

/** Stack for redo actions */
const redoStack: any[] = [];

// --------------------------------------------------
// Core Task & Dependency Functions (Business Logic)
// --------------------------------------------------

export class App implements IApp {
    constructor(
        private readonly presenter: IPresenter
    ) { }

    createTask(position: CanvasCoords): ITask {
        const task = new Task({ position });
        allTasks.set(task.id, task);
        this.presenter.addTaskToCanvas(task);

        this.pushUndo({ type: 'addTask', task: task });
        this.save();
        return task;
    }
    toggleTaskCompletion(itask: ITask, complete: boolean | null): void {
        const task = itask instanceof Task ? itask : allTasks.get(itask.getId());
        if (!task) throw new Error('Task does not exist');

        task.completed = complete === null ? !task.completed : complete;
        this.presenter.toggleTaskCompletion(task, task.completed);

        this.pushUndo({ type: 'toggleComplete', taskId: task.id, newValue: task.completed, oldValue: !task.completed });
        this.save();
    }
    toggleTaskExpansion(itask: ITask, expand: boolean | null): void {
        const task = itask instanceof Task ? itask : allTasks.get(itask.getId());
        if (!task) throw new Error('Task does not exist');

        task.collapsed = expand === null ? !task.collapsed : !expand;
        this.presenter.toggleTaskExpansion(task, task.collapsed);

        this.pushUndo({ type: 'toggleCollapse', taskId: task.id, newValue: task.collapsed, oldValue: !task.collapsed });
        this.save();
    }
    changeTaskTitle(itask: ITask, title: string): void {
        const task = itask instanceof Task ? itask : allTasks.get(itask.getId());
        if (!task) throw new Error('Task does not exist');

        const oldTitle = task.title;
        task.title = title;
        this.presenter.setTaskTitle(task, title);

        this.pushUndo({ type: 'editTask', taskId: task.id, field: 'title', newTitle: title, oldTitle: oldTitle });
        this.save();
    }
    changeTaskDescription(itask: ITask, description: string): void {
        const task = itask instanceof Task ? itask : allTasks.get(itask.getId());
        if (!task) throw new Error('Task does not exist');

        const oldDescription = task.description;
        task.description = description;
        this.presenter.setTaskDescription(task, description);

        this.pushUndo({ type: 'editTask', taskId: task.id, field: 'description', newDescription: description, oldDescription: oldDescription });
        this.save();
    }
    moveTasks(taskMovements: { task: ITask; position: CanvasCoords; }[]): void {
        const moveLogs: { taskId: string, oldPosition: CanvasCoords, newPosition: CanvasCoords }[] = [];
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
        });

        this.pushUndo({ type: 'moveTasks', taskMovements: moveLogs });
        this.save();
    }
    deleteTasks(itasks: ITask[]): void {
        const tasks: Task[] = itasks.map((itask): Task => {
            const task = itask instanceof Task ? itask : allTasks.get(itask.getId());
            if (!task) throw new Error('Task does not exist');            
            return task;
        });
        const deletedDependencies: Set<Dependency> = new Set();

        for (const task of tasks) {
            this.presenter.removeTask(task);
            allTasks.delete(task.getId());
    
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
        this.save();
        return dependency;
    }
    deleteDependency(dependency: IDependency, detachFromTasks: boolean = true, skipUndo: boolean = false): void {
        const dep = dependency instanceof Dependency ? dependency : allDependencies.get(dependency.getRequiredTask().getId(), dependency.getRequiredByTask().getId());
        if (dep) {
            const requiredITask = dep.getRequiredTask();
            const requiredByITask = dep.getRequiredByTask();
            if (detachFromTasks) {
                const requiredTask = requiredITask instanceof Task ? requiredITask : allTasks.get(requiredITask.getId());
                if (!requiredTask) throw new Error('Required task does not exist');        
                const requiredByTask = requiredByITask instanceof Task ? requiredByITask : allTasks.get(requiredByITask.getId());
                if (!requiredByTask) throw new Error('Required by task does not exist');        
                requiredTask.requiredByDependencies.delete(requiredByTask.getId());
                requiredByTask.requiredDependencies.delete(requiredTask.getId());
            }
            allDependencies.delete(requiredITask.getId(), requiredByITask.getId());
            this.presenter.removeDependency(dep);
            
            if (!skipUndo) {
                this.pushUndo({ type: 'deleteDependency', from: requiredITask.getId(), to: requiredByITask.getId() });
            }
            this.save();
        }
    }
    undo(): boolean {
        throw new Error('Method not implemented.');
    }
    redo(): boolean {
        throw new Error('Method not implemented.');
    }

    pushUndo(action: any): void {
        // TODO: Implement undo logic
    }
    
    save(): void {
        // TODO: Implement autosave logic
    }
}
