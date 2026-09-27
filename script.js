/* =========================================================
   TaskKeeper — a simple task manager (plain JavaScript)

   What it does:
   - Add tasks with a title, priority, due date, and note
   - Saves everything in the browser using localStorage
   - Mark tasks complete, edit them, or delete them
   - Filter the list (All / Active / Completed) via the dropdown
   - Shows live stats so your effort is visible

   Concepts used: functions, event listeners, form validation,
   dropdown toggle, and a modal popup.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

  /* ---------------------------------------------------------
     DATA + STORAGE
     "tasks" is an array of task objects. We save it to
     localStorage so it survives page reloads.
  --------------------------------------------------------- */
  const STORAGE_KEY = "taskkeeper.tasks";

  // Load saved tasks, or start with an empty list.
  let tasks = loadTasks();
  let currentFilter = "all"; // which tasks to show
  let editingId = null;      // id of the task being edited in the modal

  function loadTasks() {
    const saved = localStorage.getItem(STORAGE_KEY);
    // If nothing is saved yet, return an empty array.
    return saved ? JSON.parse(saved) : [];
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }


  /* ---------------------------------------------------------
     GRAB PAGE ELEMENTS
  --------------------------------------------------------- */
  // Navigation + dropdown
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  const dropdownBtn = document.getElementById("dropdownBtn");
  const dropdown = dropdownBtn.parentElement;
  const filterOptions = document.querySelectorAll(".filter-option");

  // Add-task form
  const taskForm = document.getElementById("taskForm");
  const titleInput = document.getElementById("title");
  const priorityInput = document.getElementById("priority");
  const dueInput = document.getElementById("due");
  const noteInput = document.getElementById("note");
  const titleError = document.getElementById("titleError");
  const noteError = document.getElementById("noteError");
  const formFeedback = document.getElementById("formFeedback");

  // Task list + stats
  const taskList = document.getElementById("taskList");
  const emptyState = document.getElementById("emptyState");
  const currentFilterLabel = document.getElementById("currentFilter");
  const statTotal = document.getElementById("statTotal");
  const statActive = document.getElementById("statActive");
  const statDone = document.getElementById("statDone");
  const statPercent = document.getElementById("statPercent");

  // Edit modal
  const modalOverlay = document.getElementById("modalOverlay");
  const modalClose = document.getElementById("modalClose");
  const editTitle = document.getElementById("editTitle");
  const editPriority = document.getElementById("editPriority");
  const editDue = document.getElementById("editDue");
  const editNote = document.getElementById("editNote");
  const editTitleError = document.getElementById("editTitleError");
  const editDueError = document.getElementById("editDueError");
  const dueError = document.getElementById("dueError");
  const saveEditBtn = document.getElementById("saveEditBtn");


  /* ---------------------------------------------------------
     1. MOBILE NAV TOGGLE
  --------------------------------------------------------- */
  navToggle.addEventListener("click", function () {
    navLinks.classList.toggle("open");
  });


  /* ---------------------------------------------------------
     2. DROPDOWN FILTER
     Open/close the menu, and pick which tasks to show.
  --------------------------------------------------------- */
  dropdownBtn.addEventListener("click", function (event) {
    event.stopPropagation();
    dropdown.classList.toggle("open");
  });

  // Close the dropdown when clicking elsewhere.
  document.addEventListener("click", function (event) {
    if (!dropdown.contains(event.target)) {
      dropdown.classList.remove("open");
    }
  });

  // Each filter option updates the current filter and re-renders.
  filterOptions.forEach(function (option) {
    option.addEventListener("click", function () {
      currentFilter = option.getAttribute("data-filter");
      dropdown.classList.remove("open");
      renderTasks();
    });
  });


  /* ---------------------------------------------------------
     3. ADD TASK (with validation)
  --------------------------------------------------------- */
  // Validate the title field. Returns true if valid.
  function validateTitle(value, input, errorEl) {
    const text = value.trim();
    if (text === "") {
      input.classList.add("invalid");
      errorEl.textContent = "Please enter a task.";
      return false;
    }
    if (text.length < 3) {
      input.classList.add("invalid");
      errorEl.textContent = "Task must be at least 3 characters.";
      return false;
    }
    input.classList.remove("invalid");
    errorEl.textContent = "";
    return true;
  }

  // Validate the due date. It's optional, but if given it can't
  // be in the past. Returns true if valid (or empty).
  function validateDue(value, input, errorEl) {
    // Empty is allowed since the due date is optional.
    if (value === "") {
      input.classList.remove("invalid");
      errorEl.textContent = "";
      return true;
    }

    // Compare against today with the time stripped off.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const chosen = new Date(value + "T00:00:00");

    if (chosen < today) {
      input.classList.add("invalid");
      errorEl.textContent = "Due date can't be in the past.";
      return false;
    }

    input.classList.remove("invalid");
    errorEl.textContent = "";
    return true;
  }

  // Clear the title error as the user types.
  titleInput.addEventListener("input", function () {
    if (titleInput.value.trim().length >= 3) {
      titleInput.classList.remove("invalid");
      titleError.textContent = "";
    }
  });

  // Re-check the due date whenever it changes.
  dueInput.addEventListener("change", function () {
    validateDue(dueInput.value, dueInput, dueError);
  });

  taskForm.addEventListener("submit", function (event) {
    event.preventDefault(); // no page reload

    // Run both checks so every problem is shown at once.
    const titleOk = validateTitle(titleInput.value, titleInput, titleError);
    const dueOk = validateDue(dueInput.value, dueInput, dueError);

    if (!titleOk || !dueOk) {
      formFeedback.textContent = "✗ Please fix the errors above.";
      formFeedback.className = "form-feedback error";
      return;
    }

    // Build a new task object with a unique id.
    const newTask = {
      id: Date.now(), // simple unique id based on time
      title: titleInput.value.trim(),
      priority: priorityInput.value,
      due: dueInput.value,           // may be empty
      note: noteInput.value.trim(),  // may be empty
      done: false
    };

    tasks.push(newTask);
    saveTasks();
    renderTasks();

    // Reset the form and show a friendly success message.
    taskForm.reset();
    priorityInput.value = "medium";
    formFeedback.textContent = "✓ Task added!";
    formFeedback.className = "form-feedback success";

    // Clear the success message after a couple seconds.
    setTimeout(function () {
      formFeedback.textContent = "";
    }, 2000);
  });


  /* ---------------------------------------------------------
     4. RENDER TASKS + STATS
     Rebuilds the list based on the current filter, and
     updates the stat cards.
  --------------------------------------------------------- */
  function renderTasks() {
    // Decide which tasks to show based on the filter.
    let visible = tasks;
    if (currentFilter === "active") {
      visible = tasks.filter(function (t) { return !t.done; });
    } else if (currentFilter === "completed") {
      visible = tasks.filter(function (t) { return t.done; });
    }

    // Update the little "Showing: ..." label.
    const labels = { all: "All", active: "Active", completed: "Completed" };
    currentFilterLabel.textContent = "Showing: " + labels[currentFilter];

    // Clear the list and rebuild it.
    taskList.innerHTML = "";

    if (visible.length === 0) {
      emptyState.style.display = "block";
      emptyState.textContent =
        tasks.length === 0
          ? "No tasks yet. Add your first one above!"
          : "No tasks in this filter.";
    } else {
      emptyState.style.display = "none";
      visible.forEach(function (task) {
        taskList.appendChild(buildTaskElement(task));
      });
    }

    updateStats();
  }

  // Create the HTML element for a single task.
  function buildTaskElement(task) {
    const li = document.createElement("li");
    li.className = "task-item priority-" + task.priority + (task.done ? " done" : "");

    // Checkbox to mark complete.
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", function () {
      toggleDone(task.id);
    });

    // Main body (title, meta badges, note).
    const body = document.createElement("div");
    body.className = "task-body";

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const badge = document.createElement("span");
    badge.className = "badge " + task.priority;
    badge.textContent = task.priority;
    meta.appendChild(badge);

    if (task.due) {
      const due = document.createElement("span");
      due.textContent = "📅 " + formatDate(task.due);
      meta.appendChild(due);
    }

    body.appendChild(title);
    body.appendChild(meta);

    if (task.note) {
      const note = document.createElement("div");
      note.className = "task-note";
      note.textContent = task.note;
      body.appendChild(note);
    }

    // Action buttons (edit + delete).
    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.title = "Edit";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", function () {
      openEditModal(task.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn";
    deleteBtn.title = "Delete";
    deleteBtn.textContent = "🗑️";
    deleteBtn.addEventListener("click", function () {
      deleteTask(task.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(checkbox);
    li.appendChild(body);
    li.appendChild(actions);
    return li;
  }

  // Turn "2026-09-10" into a friendlier "Sep 10, 2026".
  function formatDate(dateStr) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  // Update the four stat cards.
  function updateStats() {
    const total = tasks.length;
    const done = tasks.filter(function (t) { return t.done; }).length;
    const active = total - done;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    statTotal.textContent = total;
    statActive.textContent = active;
    statDone.textContent = done;
    statPercent.textContent = percent + "%";
  }


  /* ---------------------------------------------------------
     5. TASK ACTIONS: toggle, delete, edit
  --------------------------------------------------------- */
  function toggleDone(id) {
    tasks = tasks.map(function (t) {
      if (t.id === id) { t.done = !t.done; }
      return t;
    });
    saveTasks();
    renderTasks();
  }

  function deleteTask(id) {
    // Ask before deleting so nothing is lost by accident.
    const target = tasks.find(function (t) { return t.id === id; });
    const ok = confirm('Delete "' + target.title + '"?');
    if (!ok) return;

    tasks = tasks.filter(function (t) { return t.id !== id; });
    saveTasks();
    renderTasks();
  }


  /* ---------------------------------------------------------
     6. EDIT MODAL
  --------------------------------------------------------- */
  function openEditModal(id) {
    const task = tasks.find(function (t) { return t.id === id; });
    if (!task) return;

    editingId = id;
    editTitle.value = task.title;
    editPriority.value = task.priority;
    editDue.value = task.due;
    editNote.value = task.note;
    editTitle.classList.remove("invalid");
    editTitleError.textContent = "";
    editDue.classList.remove("invalid");
    editDueError.textContent = "";

    modalOverlay.classList.add("open");
  }

  function closeEditModal() {
    modalOverlay.classList.remove("open");
    editingId = null;
  }

  // Re-check the edit due date whenever it changes.
  editDue.addEventListener("change", function () {
    validateDue(editDue.value, editDue, editDueError);
  });

  saveEditBtn.addEventListener("click", function () {
    // Validate title and due date before saving.
    const titleOk = validateTitle(editTitle.value, editTitle, editTitleError);
    const dueOk = validateDue(editDue.value, editDue, editDueError);
    if (!titleOk || !dueOk) {
      return;
    }

    tasks = tasks.map(function (t) {
      if (t.id === editingId) {
        t.title = editTitle.value.trim();
        t.priority = editPriority.value;
        t.due = editDue.value;
        t.note = editNote.value.trim();
      }
      return t;
    });

    saveTasks();
    renderTasks();
    closeEditModal();
  });

  // Ways to close the modal: X button, overlay click, Escape key.
  modalClose.addEventListener("click", closeEditModal);
  modalOverlay.addEventListener("click", function (event) {
    if (event.target === modalOverlay) { closeEditModal(); }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { closeEditModal(); }
  });


  // Set the earliest selectable date to today on both date inputs.
  const todayStr = new Date().toISOString().split("T")[0];
  dueInput.setAttribute("min", todayStr);
  editDue.setAttribute("min", todayStr);


  /* ---------------------------------------------------------
     START: draw the tasks that were loaded from storage.
  --------------------------------------------------------- */
  renderTasks();

});
