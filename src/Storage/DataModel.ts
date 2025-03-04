export interface ICanvasDataModel {
    
    /** The version of the app */
    readonly version: string;

    /** All the tasks on the canvas */
    readonly tasks: ReadonlyArray<ITaskDataModel>;

    /** All the dependencies on the canvas */
    readonly dependencies: ReadonlyArray<IDependencyDataModel>;

    /** The canvas coords at the center of the viewport */
    readonly pan: { x: number, y: number };

    /** The zoom level of the viewport */
    readonly zoom: number;

}

export interface ITaskDataModel {    
    readonly id: number;
    readonly title: string;
    readonly description: string;
    readonly completed: boolean;
    readonly position: { readonly x: number, readonly y: number };
    readonly collapsed: boolean;
}

export interface IDependencyDataModel {
    readonly requiredTaskId: number;
    readonly requiredByTaskId: number;
}