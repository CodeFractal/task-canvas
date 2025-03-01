import { Vector2D } from "../../Abstract/Math";
import { Arrow } from "../../Interfaces/IPresenter";
import { ITask } from "../../Interfaces/ITask";
import { CanvasCoords, ScreenCoords, SizeOnScreen } from "../../Presenter/CoordinateSystem";

export class ControlStateManager {
  public mousePosition: ScreenCoords = ScreenCoords.zero;
  public mouseMovement: SizeOnScreen = new SizeOnScreen(Vector2D.zero);
  public leftPressed: boolean = false;
  public rightPressed: boolean = false;
  public middlePressed: boolean = false;
  public leftDownScreenPosition: ScreenCoords = ScreenCoords.zero;
  public rightDownScreenPosition: ScreenCoords = ScreenCoords.zero;
  public middleDownScreenPosition: ScreenCoords = ScreenCoords.zero;
  public leftDownCanvasPosition: CanvasCoords | null = null;
  public rightDownCanvasPosition: CanvasCoords | null = null;
  public middleDownCanvasPosition: CanvasCoords | null = null;
  public keys: { [key: string]: boolean } = {};
  public lastEvent: Event | null = null;
  public target: EventTarget | null = null;
  public taskInTitleEditMode: ITask | null = null;
  public taskInDescriptionEditMode: ITask | null = null;
  public taskHeldByMouse: ITask | null = null;
  public taskHeldByMouseOriginalCanvasPosition: CanvasCoords = CanvasCoords.zero;
  public taskHeldByMouseCurrentCanvasPosition: CanvasCoords = CanvasCoords.zero;
  public selectedTasks: Set<ITask> = new Set<ITask>();
  public selectionBoxStart: ScreenCoords = ScreenCoords.zero;
  public contextMenuContext: ContextMenuContext | null = null;
  public dependencyCreationContext: DependencyCreationContext | null = null;
  public taskTitleEditContext: TaskTitleEditContext | null = null;
  public taskDescriptionEditContext: TaskDescriptionEditContext | null = null;
  public mouseIsHoldingDependencyArrow: boolean = false;
  public mouseIsHoldingSingleTask: boolean = false;
  public mouseIsHoldingTaskGroup: boolean = false;
  public mouseIsHoldingCanvas: boolean = false;
  public mouseIsDrawingSelectionBox: boolean = false;
  public taskGroupAnchor?: ITask;
  public taskGroupOriginalPositions?: Map<ITask, CanvasCoords>;
  public taskGroupAnchorOriginalMouseCanvasPosition?: CanvasCoords;
}

/** Holds context for an open context menu. */
export interface ContextMenuContext {
  /** The target of the event that triggered the context menu */
  target: EventTarget | null;
  /** The screen position where the context menu was opened */
  position: ScreenCoords;
  /** The task associated with the context menu */
  task?: ITask;
  /** The dependency associated with the context menu */
  dependency?: any;
}

/** Holds context for a dependency creation operation. */
export interface DependencyCreationContext {
  /** The first task in the dependency creation operation */
  firstTask: ITask;
  /** Whether the first task is required by the second task */
  firstTaskIsRequiredTask: boolean;
  /** A reference to the ghost arrow being dragged */
  ghostArrow: Arrow;
}

/** Holds context for a task title edit operation. */
export interface TaskTitleEditContext {
  /** The task being edited */
  task: ITask;
  /** The original title of the task */
  originalTitle: string;
}

/** Holds context for a task description edit operation. */
export interface TaskDescriptionEditContext {
  /** The task being edited */
  task: ITask;
  /** The original description of the task */
  originalDescription: string;
}