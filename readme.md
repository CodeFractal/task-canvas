# What is Task Canvas?
Task Canvas is exactly what it sounds like. It's a canvas for tasks. It is a small web-based application that allows you to organize tasks and dependencies graphically.

# How do I use it?
When you start the app, you're greeted with the canvas, and a dialog box requesting you to open an existing canvas or start a new one.

## Selecting a File / Auto-save
Which ever option you choose, you'll need to specify a file to save to. As you modify the canvas, your changes will automatically be saved to the file you selected.

***Note**: Currently, the app only supports loading and saving to Google Drive.*

Once you select a file, you can start populating the canvas.

## Controls
The best way to learn to use the app is just by playing around. Many keyboard shortcuts that you use in other applications apply here.

### Create a Task
You can create a task by:
- Double-clicking on the canvas;
- OR: Right-clicking on the canvas, and selecting "Add Task".

### Expand/Collapse a Task
A task's description is hidden when the task is collapsed.
Expand or collapse the task by:
- Clicking on the arrow in the top-left corner of the task;
- OR: Clicking in an empty area in the task's header

### Navigate
Pan the canvas by:
- Right-clicking and dragging the canvas;
- OR: Middle-clicking and dragging the canvas;
Scroll the canvas up/down snapping to grid lines by:
- Scrolling the mouse wheel up or down
Scroll the canvas left/right snapping to grid lines by:
- Holding Shift and scrolling the mouse wheel up or down
Zoom in and out by:
- Holding Ctrl and scrolling up (to zoom in) or down (to zoom out)

### Move Tasks
Move a task by:
- Clicking and dragging the task header around the canvas
  *Note: Tasks are like sticky-notes... higher tasks may cover lower tasks*
Move multiple tasks by:
- Selecting the tasks that should be moved
- Clicking and dragging anywhere on one of the selected tasks
Cancel the move operation by:
- Right clicking (while still dragging);
- OR: Pressing Esc (while still dragging)

### Change a Task Title
Begin editing a task's title by:
- Clicking on the task's title
Apply the modified title by:
- Pressing Enter;
- OR: Clicking away from the title
Cancel the modification by:
- Pressing Esc (while editing)

### Change a Task Description
Tasks have rich text descriptions.
Begin editing a task's description by:
- Expanding the task, then clicking on the task's description
Apply the modified description by:
- Clicking away from the description
Cancel the modification by:
- Pressing Esc (while editing)

### Complete a Task
A task's completion status is represented by a green checkbox in the top-right corner of the task.
Toggle the task complete/incomplete by:
- Clicking the checkbox in the top-right corner of the task

### Delete Tasks
Of course you can delete tasks from the canvas, but be careful - once it's gone, it's gone.
Delete a task by:
- Right-clicking the tasks, and selecting "Delete Task";
Delete multiple tasks by:
- Selecting the tasks that should be deleted
- Then either:
	- Pressing the Delete key;
	- OR: Right-clicking one of the selected tasks and selecting "Delete Selected Tasks"

### Add a Dependency
Tasks can have any number of dependencies. Dependencies are represented by an arrow extending from (the right side of) the required task to (the left side of) the task that requires it.
Add a dependency to a task by:
- Right-clicking a task that depends on another, and selecting "Requires ..."
- Clicking on the task that is required
Add a task as a dependency of another task by:
- Right-clicking the task that must be completed first, and selecting "Required by ..."
- Clicking on the task that the first task is required by

### Delete a Dependency
Delete a dependency by:
- Right-clicking on the dependency arrow, and selecting "Delete Dependency";
- OR: Delete either of the dependency's associated tasks

### Selecting Tasks
Multiple tasks can be selected to perform actions on multiple tasks simultaneously.
#### One at a time
Select a single task by:
- Left-clicking in the margin of a task
#### Selection Area
Drawing a selection area that intersects tasks is a great way to select (or deselect) multiple tasks that are in the same area
Draw a selection area by:
- Holding the left mouse button down on the canvas and dragging
#### Select All
Select all tasks on the canvas by:
- Pressing Ctrl+A
#### Build a Selection
By default, the selection operations above will overwrite the existing selection.
Add a single task to the selection by:
- Shift-clicking anywhere on a (deselected) task
Remove a single task from the selection by:
- Shift-clicking anywhere on a (selected) task
Add multiple tasks to the selection by:
- Holding Shift and drawing a selection area over the desired tasks
Remove multiple tasks from the selection by:
- Holding Shift+Alt, while drawing a selection area over the desired tasks
#### Deselect All
Deselect all tasks by:
- Left-clicking on the canvas;
- OR: Interacting with an individual task