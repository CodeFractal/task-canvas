import { ICanvasDataModel, IDependencyDataModel, ITaskDataModel } from "./DataModel";

export interface IStorageProvider {

    /** The unique ID of the location this provider is connected to */
    readonly locationId: string | null;

    /** Loads the canvas data from storage
     * @returns The canvas data model
    */
    retrieveCanvasData(): Promise<ICanvasDataModel>;

    /** Saves the canvas data to storage (overwriting any existing data)
     * @param canvasData The canvas data to save
     */
    saveCanvasData(canvasData: ICanvasDataModel): Promise<void>;

    /** Adds or updates an existing task in storage
     * @param task The task to save
     * @returns true if the task existed and was updated, false if the task did not exist
    */
    saveTask(task: ITaskDataModel): Promise<void>;

    /** Removes a task from storage
     * @param task The task to delete
     * @returns true if the task existed and was removed, false if the task did not exist
    */
    deleteTask(task: ITaskDataModel): Promise<boolean>;

    /** Saves a new dependency to storage
     * @param dependency The dependency to save
    */
    saveDependency(dependency: IDependencyDataModel): Promise<void>;

    /** Removes a dependency from storage
     * @param dependency The dependency to remove
     * @returns true if the dependency existed and was removed, false if the dependency did not exist
    */
    deleteDependency(dependency: IDependencyDataModel): Promise<boolean>;

    /** Adds or updates multiple entities in storage
     * @param entities The entities to save
    */
    saveMany(entities: ReadonlyArray<ITaskDataModel | IDependencyDataModel>): Promise<void>;

    /** Removes multiple entities from storage
     * @param entities The entities to remove
    */
    deleteMany(entities: ReadonlyArray<ITaskDataModel | IDependencyDataModel>): Promise<void>;

}