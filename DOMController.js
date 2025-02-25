const DOMController = (function () {
    const orderedTasks = [];

    let canvas = null;
    let didInit = false;
    
    // Internal element for the selection box.
    let selectionBoxElement = null;
    
    // Unified context menu element.
    let contextMenuElement = null;

    function init()  {
        if (didInit) return;
        canvas = document.getElementById('canvas');
        // Try to grab an existing unified context menu element; if not present, create one.
        contextMenuElement = document.getElementById('contextMenu');
        if (!contextMenuElement) {
            contextMenuElement = document.createElement('div');
            contextMenuElement.id = 'contextMenu';
            contextMenuElement.style.position = 'absolute';
            contextMenuElement.style.display = 'none';
            document.body.appendChild(contextMenuElement);
        }
        didInit = true;
    }

    function screenToCanvasPosition(screenPosition) {
        const scale = CustomPanZoom.getScale ? CustomPanZoom.getScale() : 1;
        const translateX = CustomPanZoom.getTranslateX ? CustomPanZoom.getTranslateX() : 0;
        const translateY = CustomPanZoom.getTranslateY ? CustomPanZoom.getTranslateY() : 0;
        return {
            x: (screenPosition.x - translateX) / scale,
            y: (screenPosition.y - translateY) / scale
        };
    }

    function screenToCanvasScale(screenScale) {
        const scale = CustomPanZoom.getScale ? CustomPanZoom.getScale() : 1;
        return {
            x: screenScale.x / scale,
            y: screenScale.y / scale
        }
    }

    function getCanvas() { return canvas; }

    function getTaskElementFromChild(element) {
        return element.closest('.task');
    }

    function getTaskHeaderElementFromChild(element) {
        return element.closest('.task-header');
    }

    function getTaskTitleElementFromChild(element) {
        return element.closest('[data-role="title"]');
    }

    function getTaskDescriptionElementFromChild(element) {
        return element.closest('[data-role="description"]');
    }

    function getTaskExpandElementFromChild(element) {
        return element.closest('[data-role="toggle"]');
    }

    function getTaskCompletionCheckboxFromChild(element) {
        return element.closest('[data-role="checkbox"]');
    }

    function getDependencyArrowElementFromChild(element) {
        return element.closest('svg');
    }

    function getTaskId(element) {
        const taskElement = getTaskElementFromChild(element);
        return taskElement?.getAttribute('data-id');
    }

    function getTaskPositionOnCanvas(taskElement) {
        return {
            x: taskElement.offsetLeft,
            y: taskElement.offsetTop
        };
    }
    
    // ---------------------------
    // New and Updated Implementations
    // ---------------------------

    function getAllTaskElements() {
        return canvas.querySelectorAll('.task');
    }

    // Toggles the "selected" class on a task element.
    function toggleTaskHighlight(taskElement, highlight) {
        if (highlight) {
            taskElement.classList.add('selected');
        } else {
            taskElement.classList.remove('selected');
        }
    }

    // Creates and shows a selection box element on the canvas.
    function showSelectionBox() {
        if (!selectionBoxElement) {
            selectionBoxElement = document.createElement('div');
            selectionBoxElement.style.position = 'absolute';
            selectionBoxElement.style.border = '1px dashed lightblue';
            selectionBoxElement.style.backgroundColor = 'rgba(173,216,230,0.2)';
            selectionBoxElement.style.pointerEvents = 'none';
            canvas.appendChild(selectionBoxElement);
        }
    }

    // Updates the selection box element's position and dimensions.
    function moveSelectionBox(start, current) {
        if (!selectionBoxElement) return;

        // Get the top-left corner of the selection box.
        let x = Math.min(start.x, current.x);
        let y = Math.min(start.y, current.y);

        // Retrieve the current scale and pan (translation) from the CustomPanZoom module.
        const scale = CustomPanZoom.getScale ? CustomPanZoom.getScale() : 1;
        const translateX = CustomPanZoom.getTranslateX ? CustomPanZoom.getTranslateX() : 0;
        const translateY = CustomPanZoom.getTranslateY ? CustomPanZoom.getTranslateY() : 0;

        // Compensate for the scale and translation of the canvas.
        x -= translateX;
        y -= translateY;
        x /= scale;
        y /= scale;

        // Calculate the width and height of the selection box.
        let width = Math.abs(start.x - current.x);
        let height = Math.abs(start.y - current.y);

        // Compensate for the scale of the canvas.
        width /= scale;
        height /= scale;

        // Update the selection box element's position and dimensions.
        selectionBoxElement.style.left = x + 'px';
        selectionBoxElement.style.top = y + 'px';
        selectionBoxElement.style.width = width + 'px';
        selectionBoxElement.style.height = height + 'px';
    }

    // Hides and removes the selection box element.
    function hideSelectionBox() {
        if (selectionBoxElement) {
            selectionBoxElement.remove();
            selectionBoxElement = null;
        }
    }

    // Helper function to determine if two rectangles intersect.
    function rectsIntersect(r1, r2) {
        return !(r2.x > r1.x + r1.width ||
                 r2.x + r2.width < r1.x ||
                 r2.y > r1.y + r1.height ||
                 r2.y + r2.height < r1.y);
    }

    // Returns an array of task elements that intersect the rectangular area defined by start and current.
    function getTaskElementsInArea(start, current) {
        const canvasRect = canvas.getBoundingClientRect();
        const x = Math.min(start.x, current.x) - canvasRect.left;
        const y = Math.min(start.y, current.y) - canvasRect.top;
        const width = Math.abs(start.x - current.x);
        const height = Math.abs(start.y - current.y);
        const selectionRect = { x, y, width, height };

        const tasksInArea = [];
        const taskElements = canvas.querySelectorAll('.task');
        taskElements.forEach(taskEl => {
            const taskRect = taskEl.getBoundingClientRect();
            const taskX = taskRect.left - canvasRect.left;
            const taskY = taskRect.top - canvasRect.top;
            const taskWidth = taskRect.width;
            const taskHeight = taskRect.height;
            if (rectsIntersect({ x: taskX, y: taskY, width: taskWidth, height: taskHeight }, selectionRect)) {
                tasksInArea.push(taskEl);
            }
        });
        return tasksInArea;
    }

    // Displays the unified context menu at the given position with the specified options.
    // The options parameter is an array of [optionCode, optionLabel] pairs.
    function showContextMenu(position, options) {
        if (!contextMenuElement) {
            // In case init was not yet called.
            init();
        }
        // Clear any previous content.
        contextMenuElement.innerHTML = '';
        // Create menu items for each provided option.
        options.forEach(opt => {
            let item = document.createElement('div');
            // Set an id based on the option code.
            item.textContent = opt[1];
            item.setAttribute('data-role', 'context-menu-item');
            item.setAttribute('data-key', opt[0]);
            contextMenuElement.appendChild(item);
        });
        // Position and display the menu.
        contextMenuElement.style.left = position.x + 'px';
        contextMenuElement.style.top = position.y + 'px';
        contextMenuElement.style.display = 'block';
    }

    // Returns the standardized option code based on the clicked element.
    function getContextMenuOption(element) {
        if (!element) return null;
        const eContextMenuItems = element.closest('[data-role="context-menu-item"]');
        return eContextMenuItems ? eContextMenuItems.getAttribute('data-key') : null;
    }
    
    // Hides the unified context menu.
    function hideContextMenu() {
        if (contextMenuElement) {
            contextMenuElement.style.display = 'none';
        }
    }

    // ---------------------------
    // New DOM Manipulation Functions
    // ---------------------------

    function addTaskToCanvas(taskData) {
      const eTask = document.createElement('div');
      eTask.classList.add('task');
      eTask.setAttribute('data-id', taskData.id);
      eTask.style.left = taskData.x + 'px';
      eTask.style.top = taskData.y + 'px';
      eTask.setAttribute('data-snapped', (taskData.x % 40 === 0 && taskData.y % 40 === 0) ? "true" : "false");

      // Build header with controls.
      const header = document.createElement('div');
      header.classList.add('task-header');

      const toggle = document.createElement('div');
      toggle.classList.add('toggle');
      toggle.setAttribute('data-role', 'toggle');
      toggle.textContent = taskData.collapsed ? '►' : '▼';
      header.appendChild(toggle);

      const title = document.createElement('div');
      title.classList.add('title');
      title.setAttribute('data-role', 'title');
      title.textContent = taskData.title;
      header.appendChild(title);

      // Custom Checkbox.
      const checkbox = document.createElement('div');
      checkbox.classList.add('custom-checkbox');
      checkbox.setAttribute('data-role', 'checkbox');

      const checkboxFill = document.createElement('div');
      checkboxFill.classList.add('checkbox-fill');
      checkboxFill.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" style="background: transparent;">
  <rect x="1" y="1" width="26" height="26" rx="3.75" ry="3.75" fill="none" stroke="#4d4d4d" stroke-width="2"></rect>
  <defs>
    <mask id="checkMask-${taskData.id}">
      <rect x="0" y="0" width="28" height="28" fill="white"></rect>
      <polyline points="8,15 12,19 20,9" stroke="black" stroke-width="2" stroke-linecap="round" fill="none" stroke-linejoin="round"></polyline>
    </mask>
  </defs>
  <rect x="4" y="4" width="20" height="20" rx="1.9" ry="1.9" fill="#25a599" fill-opacity="${taskData.completed ? '1' : '0.1'}" mask="url(#checkMask-${taskData.id})"></rect>
</svg>`;
      checkbox.appendChild(checkboxFill);
      header.appendChild(checkbox);

      eTask.appendChild(header);

      const taskBody = document.createElement('div');
      taskBody.classList.add('task-body');
      eTask.appendChild(taskBody);

      const description = document.createElement('div');
      description.classList.add('description');
      description.setAttribute('data-role', 'description');
      description.innerHTML = taskData.description;
      taskBody.appendChild(description);
      
      // Add the task to the canvas in the correct z-order.
      adjustTaskZPosition(eTask, { x: taskData.x, y: taskData.y });
    }

    function moveTask(taskElement, position, autoAdjustZPosition = true) {
        taskElement.style.left = position.x + 'px';
        taskElement.style.top = position.y + 'px';
        if (autoAdjustZPosition) {
            adjustTaskZPosition(taskElement, position);
        }
    }

    // Reposition the task element so that higher tasks appear on top.
    function adjustTaskZPosition(taskElement, position) {
        let taskItem;
        // See if the task already exists in our ordered list.
        const existingIndex = orderedTasks.findIndex(t => t.element === taskElement);
        if (existingIndex !== -1) {
            // Remove it and update its position.
            taskItem = orderedTasks.splice(existingIndex, 1)[0];
            taskItem.position = position;
        }
        else {
            // Create a new task item if not found.
            taskItem = {
                id: taskElement.getAttribute('data-id'),
                element: taskElement,
                position: position
            };
        }

        // Compute the proper index for the new position.
        // We want to insert the task before the first task that has a lower y value
        // or the same y but a lower x value.
        let newIndex = orderedTasks.findIndex(t => {
            return (position.y > t.position.y) ||
                (position.y === t.position.y && position.x > t.position.x);
        });
        if (newIndex === -1) newIndex = orderedTasks.length;

        // Insert the task item at the new index.
        orderedTasks.splice(newIndex, 0, taskItem);

        // Update the DOM order to match orderedTasks.
        // If the task is at the very top of our array, insert it before the next element;
        // otherwise, if it’s last in the list, just append it.
        if (newIndex === orderedTasks.length - 1) {
            canvas.appendChild(taskElement);
        }
        else {
            canvas.insertBefore(taskElement, orderedTasks[newIndex + 1].element);
        }
    }

    function editTaskTitle(taskElem, taskData, onSave) {
      const titleEl = taskElem.querySelector('[data-role="title"]');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = taskData.title;
      input.style.width = '100%';
      titleEl.replaceWith(input);
      input.focus();
      input.addEventListener('blur', () => {
        const oldValue = taskData.title;
        taskData.title = input.value || 'Untitled';
        const newTitleEl = document.createElement('div');
        newTitleEl.classList.add('title');
        newTitleEl.setAttribute('data-role', 'title');
        newTitleEl.textContent = taskData.title;
        input.replaceWith(newTitleEl);
        if (typeof onSave === 'function') {
            onSave(oldValue, taskData.title);
        }
      });
    }

    function editTaskDescription(taskElem, taskData, onSave) {
      const descEl = taskElem.querySelector('[data-role="description"]');
      const originalDesc = descEl;
      const editorContainer = document.createElement('div');
      const editorElement = document.createElement('div');
      editorContainer.appendChild(editorElement);
      editorContainer.classList.add('editor-container');
      editorContainer.style.minHeight = '50px';
      originalDesc.parentNode.replaceChild(editorContainer, originalDesc);

      const quill = new Quill(editorElement, {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'header': 1 }, { 'header': 2 }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'indent': '-1' }, { 'indent': '+1' }],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'align': [] }],
            ['clean']
          ]
        }
      });
      quill.root.innerHTML = taskData.description;
      quill.focus();
      setTimeout(() => quill.setSelection(quill.getLength(), 0), 0);

      function adjustHeight() {
        const newHeight = quill.root.scrollHeight;
        editorElement.style.height = newHeight + 'px';
      }
      quill.on('text-change', adjustHeight);
      adjustHeight();

      function saveAndCleanup() {
        const oldValue = taskData.description;
        taskData.description = quill.root.innerHTML;
        const newDescEl = document.createElement('div');
        newDescEl.classList.add('description');
        newDescEl.setAttribute('data-role', 'description');
        newDescEl.innerHTML = taskData.description;
        editorContainer.parentNode.replaceChild(newDescEl, editorContainer);
        if (typeof onSave === 'function') {
            onSave(oldValue, taskData.description);
        }
        document.removeEventListener('click', clickOutsideListener);
      }

      function clickOutsideListener(e) {
        if (!editorContainer.contains(e.target)) {
          saveAndCleanup();
        }
      }
      document.addEventListener('click', clickOutsideListener);
    }

    function updateTaskDependencies(taskId) {
      // Placeholder: In a full implementation, update dependency arrows related to the task.
    }

    function addDependency(fromId, toId, options = {}) {
      if (typeof options.skipUndo === 'undefined') {
          options.skipUndo = false;
      }
      const fromEl = canvas.querySelector(`.task[data-id="${fromId}"]`);
      const toEl = canvas.querySelector(`.task[data-id="${toId}"]`);
      if (!fromEl || !toEl) return;
      const arrow = DependencyArrow.createArrow(canvas, toEl, fromEl, { color: options.color || "#b3b3b3", pzZoomFactor: CustomPanZoom.getScale() });
      canvas.prepend(arrow.svg);
      return arrow;
    }

    function removeTask(taskId) {
      const taskEl = canvas.querySelector(`.task[data-id="${taskId}"]`);
      if (taskEl) taskEl.remove();
    }

    function removeDependency(arrow) {
      if (arrow) arrow.remove();
    }

    function updateTaskCompletionVisual(taskElem, completed) {
      const checkboxFill = taskElem.querySelector('.checkbox-fill');
      if (checkboxFill) {
        const innerRect = checkboxFill.querySelector('rect[mask]');
        if(innerRect) {
          innerRect.setAttribute('fill-opacity', completed ? '1' : '0.1');
        }
      }
    }

    function toggleTaskExpansionVisual(taskElem, collapsed) {
      const taskBody = taskElem.querySelector('.task-body');
      if (taskBody) {
        taskBody.style.display = collapsed ? 'none' : 'block';
      }
      const toggleElem = taskElem.querySelector('.toggle');
      if (toggleElem) {
        toggleElem.textContent = collapsed ? '►' : '▼';
      }
    }

    function updateGhostArrow(dependencyCreationMode, ghostArrow, dependencyCreationFixedTask, ghostSnapTarget, mousePosition) {
      const canvasRect = canvas.getBoundingClientRect();
      if(dependencyCreationMode && ghostArrow) {
        if (dependencyCreationMode === "source") {
          const fixedEl = canvas.querySelector(`.task[data-id="${dependencyCreationFixedTask}"]`);
          if (ghostSnapTarget) {
            const targetEl = canvas.querySelector(`.task[data-id="${ghostSnapTarget}"]`);
            ghostArrow.update(targetEl, fixedEl, { pzZoomFactor: CustomPanZoom.getScale() });
            ghostArrow.setColor("#55b38888"); // Valid color
          } else {
            ghostArrow.update({ x: mousePosition.x - canvasRect.left, y: mousePosition.y - canvasRect.top }, fixedEl, { pzZoomFactor: CustomPanZoom.getScale() });
            ghostArrow.setColor("#b3555588"); // Invalid color
          }
        } else if (dependencyCreationMode === "target") {
          const fixedEl = canvas.querySelector(`.task[data-id="${dependencyCreationFixedTask}"]`);
          if (ghostSnapTarget) {
            const sourceEl = canvas.querySelector(`.task[data-id="${ghostSnapTarget}"]`);
            ghostArrow.update(fixedEl, sourceEl, { pzZoomFactor: CustomPanZoom.getScale() });
            ghostArrow.setColor("#55b38888");
          } else {
            ghostArrow.update(fixedEl, { x: mousePosition.x - canvasRect.left, y: mousePosition.y - canvasRect.top }, { pzZoomFactor: CustomPanZoom.getScale() });
            ghostArrow.setColor("#b3555588");
          }
        }
      }
    }

    // ---------------------------
    // Expose the public API.
    // ---------------------------
    return {
        init,
        screenToCanvasPosition,
        screenToCanvasScale,
        getCanvas,
        getTaskElementFromChild,
        getTaskHeaderElementFromChild,
        getTaskTitleElementFromChild,
        getTaskDescriptionElementFromChild,
        getTaskExpandElementFromChild,
        getTaskCompletionCheckboxFromChild,
        getDependencyArrowElementFromChild,
        getTaskId,
        getTaskPositionOnCanvas,
        getAllTaskElements,
        toggleTaskHighlight,
        moveSelectionBox,
        showSelectionBox,
        hideSelectionBox,
        getTaskElementsInArea,
        showContextMenu,
        hideContextMenu,
        getContextMenuOption,
        addTaskToCanvas,
        moveTask,
        adjustTaskZPosition,
        editTaskTitle,
        editTaskDescription,
        updateTaskDependencies,
        addDependency,
        removeTask,
        removeDependency,
        updateTaskCompletionVisual,
        toggleTaskExpansionVisual,
        updateGhostArrow
    };
})();
