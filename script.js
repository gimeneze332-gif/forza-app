/* ==================================================
   FORZA V6.2
   GYM TRACKER
================================================== */

/* ==================================================
   STORAGE KEYS
================================================== */

const STORAGE = {

    workouts: "forza_workouts",
    routines: "forza_routines",
    body: "forza_body",
    goal: "forza_goal",
    darkMode: "forza_darkmode"

};

/* ==================================================
   DATA
================================================== */

function readStorage(key, fallback) {

    try {

        const storedValue = localStorage.getItem(key);

        return storedValue === null
            ? fallback
            : JSON.parse(storedValue);

    } catch (error) {

        console.warn(`No se pudo leer ${key}. El resto de la app seguirá disponible.`, error);

        return fallback;

    }

}

let workouts =
readStorage(STORAGE.workouts, []);

let routines =
readStorage(STORAGE.routines, null) || {

    "Día 1": [],
    "Día 2": [],
    "Día 3": [],
    "Día 4": []

};

let bodyMeasurements =
readStorage(STORAGE.body, []);

let goalWeight =
readStorage(STORAGE.goal, null);

/* ==================================================
   GLOBALS
================================================== */

let progressChart = null;
let editingWorkout = null;

let timerSeconds = 90;
let timerInterval = null;

let calendarCursor = new Date();
calendarCursor.setDate(1);

let selectedCalendarDate = null;

/* ==================================================
   DOM
================================================== */

const tabs =
document.querySelectorAll(".tab");

const menuButtons =
document.querySelectorAll(".menu-btn");

const darkModeBtn =
document.getElementById("darkModeBtn");
/* ==================================================
   DASHBOARD
================================================== */

const todayWorkout =
document.getElementById("todayWorkout");

const lastWorkout =
document.getElementById("lastWorkout");

const prContainer =
document.getElementById("prContainer");

const weeklySessions =
document.getElementById("weeklySessions");

const weeklyVolume =
document.getElementById("weeklyVolume");

/* ==================================================
   RUTINAS
================================================== */

const routineDay =
document.getElementById("routineDay");

const routineList =
document.getElementById("routineList");

const newExercise =
document.getElementById("newExercise");

const addExerciseBtn =
document.getElementById("addExerciseBtn");

/* ==================================================
   ENTRENAMIENTO
================================================== */

const workoutForm =
document.getElementById("workoutForm");

const trainingDay =
document.getElementById("trainingDay");

const exerciseSelect =
document.getElementById("exercise");

const weightInput =
document.getElementById("weight");

const setsInput =
document.getElementById("sets");

const repsInput =
document.getElementById("reps");

const notesInput =
document.getElementById("notes");

/* ==================================================
   HISTORIAL
================================================== */

const historyBody =
document.getElementById("historyBody");

const searchExercise =
document.getElementById("searchExercise");

const searchDate =
document.getElementById("searchDate");

/* ==================================================
   CALENDARIO
================================================== */

const calendarMonthTitle =
document.getElementById("calendarMonthTitle");

const calendarGrid =
document.getElementById("calendarGrid");

const calendarDayDetail =
document.getElementById("calendarDayDetail");

const previousMonthBtn =
document.getElementById("previousMonth");

const nextMonthBtn =
document.getElementById("nextMonth");

/* ==================================================
   ESTADISTICAS
================================================== */

const exerciseFilter =
document.getElementById("exerciseFilter");

const selectedExerciseInfo =
document.getElementById("selectedExerciseInfo");

const statisticsPeriod =
document.getElementById("statisticsPeriod");

const statisticsMetric =
document.getElementById("statisticsMetric");

/* ==================================================
   CORPORAL
================================================== */

const bodyForm =
document.getElementById("bodyForm");

const bodyHistoryBody =
document.getElementById("bodyHistoryBody");
const bodyWeightInput =
document.getElementById("bodyWeight");

const armInput =
document.getElementById("arm");

const chestInput =
document.getElementById("chest");

const waistInput =
document.getElementById("waist");

const legInput =
document.getElementById("leg");

/* ==================================================
   EXTRAS
================================================== */

const goalWeightInput =
document.getElementById("goalWeight");

const saveGoalBtn =
document.getElementById("saveGoalBtn");

const goalProgressBar =
document.getElementById("goalProgressBar");

const goalProgressText =
document.getElementById("goalProgressText");

const exportCSVBtn =
document.getElementById("exportCSV");

const backupJSONBtn =
document.getElementById("backupJSON");

const restoreBackupInput =
document.getElementById("restoreBackup");

const timerDisplay =
document.getElementById("timerDisplay");

const startTimerBtn =
document.getElementById("startTimer");

const resetTimerBtn =
document.getElementById("resetTimer");

/* ==================================================
   SAVE FUNCTIONS
================================================== */

function saveWorkouts() {

    localStorage.setItem(
        STORAGE.workouts,
        JSON.stringify(workouts)
    );

}

function saveRoutines() {

    localStorage.setItem(
        STORAGE.routines,
        JSON.stringify(routines)
    );

}

function saveBody() {

    localStorage.setItem(
        STORAGE.body,
        JSON.stringify(bodyMeasurements)
    );

}

function saveGoal() {

    localStorage.setItem(
        STORAGE.goal,
        JSON.stringify(goalWeight)
    );

}

/* ==================================================
   UTILS
================================================== */

function getTodayDate() {

    return new Date()
    .toLocaleDateString("es-AR");

}

function parseWorkoutDate(value) {

    if (typeof value !== "string") return null;

    const parts = value.split("/").map(Number);

    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;

    const [day, month, year] = parts;
    const date = new Date(year, month - 1, day);

    return Number.isNaN(date.getTime()) ? null : date;

}

function calculateVolume(
    weight,
    sets,
    reps
){

    return weight * sets * reps;

}

function calculate1RM(
    weight,
    reps
){

    return Math.round(

        weight *

        (1 + reps / 30)

    );

}

function escapeHTML(value) {

    const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    return String(value ?? "").replace(
        /[&<>"']/g,
        character => entities[character]
    );

}

/* ==================================================
   TAB NAVIGATION
================================================== */

function activateTab(tabId){

    tabs.forEach(tab => {

        tab.classList.remove(
            "active-tab"
        );

    });

    menuButtons.forEach(btn => {

        btn.classList.remove(
            "active"
        );

    });

    document
        .getElementById(tabId)
        ?.classList.add(
            "active-tab"
        );

    document
        .querySelector(
            `[data-tab="${tabId}"]`
        )
        ?.classList.add(
            "active"
        );

}

menuButtons.forEach(button => {

    button.addEventListener(

        "click",

        () => {

            activateTab(

                button.dataset.tab

            );

        }

    );

});

/* ==================================================
   DARK MODE
================================================== */

function loadDarkMode(){

    const enabled =

    localStorage.getItem(
        STORAGE.darkMode
    );

    if(enabled === "true"){

        document.body.classList.add(
            "dark-mode"
        );

    }

}

function toggleDarkMode(){

    document.body.classList.toggle(
        "dark-mode"
    );

    localStorage.setItem(

        STORAGE.darkMode,

        document.body.classList.contains(
            "dark-mode"
        )

    );

}

if(darkModeBtn){

    darkModeBtn.addEventListener(

        "click",

        toggleDarkMode

    );

}

/* ==================================================
   QUICK STATS
================================================== */

function getTotalWorkouts(){

    return workouts.length;

}

function getTotalVolume(){

    let total = 0;

    workouts.forEach(item => {

        total += item.volume;

    });

    return total;

}

function getUniqueExercises(){

    return [

        ...new Set(

            workouts.map(

                item => item.exercise

            )

        )

    ].length;

}

function updateQuickStats(){

    const workoutsCard =
    document.getElementById(
        "totalWorkoutsCard"
    );

    const exercisesCard =
    document.getElementById(
        "totalExercisesCard"
    );

    const volumeCard =
    document.getElementById(
        "totalVolumeCard"
    );

    if(workoutsCard){

        workoutsCard.textContent =

        getTotalWorkouts();

    }

    if(exercisesCard){

        exercisesCard.textContent =

        getUniqueExercises();

    }

    if(volumeCard){

        volumeCard.textContent =

        getTotalVolume()
        .toLocaleString();

    }

}
/* ==================================================
   RUTINAS
================================================== */

function renderRoutineList() {

    if (!routineList || !routineDay) return;

    const day = routineDay.value;

    routineList.innerHTML = "";

    const exercises = routines[day] || [];

    if (exercises.length === 0) {

        routineList.innerHTML = `
            <div class="empty-state">
                <span>🏋️</span>
                <p>No hay ejercicios cargados</p>
            </div>
        `;

        return;
    }

    exercises.forEach((exercise, index) => {

        const item = document.createElement("div");

        item.className = "routine-item";

        item.innerHTML = `
            <div class="routine-name">
                ${exercise}
            </div>

            <div class="routine-actions">

                <button
                    class="btn-icon"
                    onclick="editExercise('${day}', ${index})">
                    ✏️
                </button>

                <button
                    class="btn-icon danger"
                    onclick="deleteExercise('${day}', ${index})">
                    🗑️
                </button>

            </div>
        `;

        routineList.appendChild(item);

    });

}

/* ==================================================
   AGREGAR EJERCICIO
================================================== */

function addExercise() {

    const day = routineDay.value;

    const exercise = newExercise.value.trim();

    if (!exercise) {

        alert("Ingresá un ejercicio");

        return;
    }

    const exists = routines[day].some(

        item => item.toLowerCase() === exercise.toLowerCase()

    );

    if (exists) {

        alert("Ese ejercicio ya existe");

        return;
    }

    routines[day].push(exercise);

    saveRoutines();

    newExercise.value = "";

    renderRoutineList();

    updateExerciseOptions();

    updateTodayWorkout();

}

/* ==================================================
   EDITAR
================================================== */

function editExercise(day, index) {

    const current = routines[day][index];

    const updated = prompt(

        "Editar ejercicio",

        current

    );

    if (!updated) return;

    routines[day][index] = updated.trim();

    saveRoutines();

    renderRoutineList();

    updateExerciseOptions();

    updateTodayWorkout();

}

/* ==================================================
   ELIMINAR
================================================== */

function deleteExercise(day, index) {

    const confirmDelete = confirm(

        "¿Eliminar ejercicio?"

    );

    if (!confirmDelete) return;

    routines[day].splice(index, 1);

    saveRoutines();

    renderRoutineList();

    updateExerciseOptions();

    updateTodayWorkout();

}

/* ==================================================
   EVENTOS RUTINAS
================================================== */

if (addExerciseBtn) {

    addExerciseBtn.addEventListener(

        "click",

        addExercise

    );

}

if (newExercise) {

    newExercise.addEventListener(

        "keydown",

        e => {

            if (e.key === "Enter") {

                e.preventDefault();

                addExercise();

            }

        }

    );

}

if (routineDay) {

    routineDay.addEventListener(

        "change",

        renderRoutineList

    );

}

/* ==================================================
   SELECT EJERCICIOS
================================================== */

function updateExerciseOptions() {

    if (!exerciseSelect || !trainingDay) return;

    const day = trainingDay.value;

    exerciseSelect.innerHTML = "";

    const exercises = routines[day] || [];

    if (exercises.length === 0) {

        exerciseSelect.innerHTML = `
            <option value="">
                Sin ejercicios
            </option>
        `;

        return;
    }

    exercises.forEach(exercise => {

        exerciseSelect.innerHTML += `
            <option value="${exercise}">
                ${exercise}
            </option>
        `;

    });

}

/* ==================================================
   ENTRENAMIENTO DEL DIA
================================================== */

function updateTodayWorkout() {

    if (!todayWorkout) return;

    const day = trainingDay
        ? trainingDay.value
        : "Día 1";

    const exercises = routines[day] || [];

    if (exercises.length === 0) {

        todayWorkout.innerHTML = `
            <div class="empty-state">
                <span>📋</span>
                <p>No hay ejercicios cargados</p>
            </div>
        `;

        return;
    }

    todayWorkout.innerHTML = exercises
        .map(exercise => `
            <div class="today-item">
                <span>🏋️</span>
                ${exercise}
            </div>
        `)
        .join("");

}

/* ==================================================
   CAMBIO DIA ENTRENAMIENTO
================================================== */

if (trainingDay) {

    trainingDay.addEventListener(

        "change",

        () => {

            updateExerciseOptions();

            updateTodayWorkout();

        }

    );

}

/* ==================================================
   INIT RUTINAS
================================================== */

function initializeRoutines() {

    renderRoutineList();

    updateExerciseOptions();

    updateTodayWorkout();

}
/* ==================================================
   ENTRENAMIENTOS
================================================== */

function isNewPR(exercise, weight) {

    const exerciseData =

    workouts.filter(

        item => item.exercise === exercise

    );

    if(exerciseData.length === 0){

        return true;

    }

    const currentPR = Math.max(

        ...exerciseData.map(
            item => item.weight
        )

    );

    return weight > currentPR;

}

function showPRAlert(exercise, weight){

    alert(

`🏆 NUEVO RÉCORD PERSONAL

${exercise}

${weight} kg`

    );

}

/* ==================================================
   GUARDAR ENTRENAMIENTO
================================================== */

function saveWorkout(event){

    event.preventDefault();

    const exercise =
    exerciseSelect.value;

    const weight =
    Number(weightInput.value);

    const sets =
    Number(setsInput.value);

    const reps =
    Number(repsInput.value);

    const notes =
    notesInput.value.trim();

    if(

        !exercise ||
        !weight ||
        !sets ||
        !reps

    ){

        alert(
            "Completa todos los campos"
        );

        return;

    }

    const workout = {

        id: Date.now(),

        date: getTodayDate(),

        trainingDay:
        trainingDay.value,

        exercise,

        weight,

        sets,

        reps,

        notes,

        volume:

        calculateVolume(

            weight,
            sets,
            reps

        )

    };

    const newPR =

    isNewPR(
        exercise,
        weight
    );

    if(editingWorkout !== null){

        workout.id =
        workouts[editingWorkout].id;

        workouts[editingWorkout] =
        workout;

        editingWorkout = null;

    }

    else{

        workouts.push(workout);

    }

    saveWorkouts();

    workoutForm.reset();

    renderHistory();

    updateDashboard();

    updateQuickStats();

    updateExerciseFilter();

    updateProgressChart();

    if(newPR){

        showPRAlert(
            exercise,
            weight
        );

    }

}

/* ==================================================
   FORM
================================================== */

if(workoutForm){

    workoutForm.addEventListener(

        "submit",

        saveWorkout

    );

}

/* ==================================================
   EDITAR
================================================== */

function editWorkout(index){

    const workout =
    workouts[index];

    trainingDay.value =
    workout.trainingDay;

    updateExerciseOptions();

    exerciseSelect.value =
    workout.exercise;

    weightInput.value =
    workout.weight;

    setsInput.value =
    workout.sets;

    repsInput.value =
    workout.reps;

    notesInput.value =
    workout.notes || "";

    editingWorkout =
    index;

    activateTab(
        "training"
    );

}

/* ==================================================
   ELIMINAR
================================================== */

function deleteWorkout(index){

    const confirmDelete =

    confirm(
        "¿Eliminar entrenamiento?"
    );

    if(!confirmDelete){
        return;
    }

    workouts.splice(
        index,
        1
    );

    saveWorkouts();

    renderHistory();

    updateDashboard();

    updateQuickStats();

    updateExerciseFilter();

    updateProgressChart();

}

/* ==================================================
   DASHBOARD
================================================== */

function updateLastWorkout(){

    if(!lastWorkout) return;

    if(workouts.length === 0){

        lastWorkout.innerHTML =

        `
        <p>
            Sin entrenamientos
        </p>
        `;

        return;

    }

    const workout =

    workouts[
        workouts.length - 1
    ];

    lastWorkout.innerHTML =

    `
    <div class="last-card">

        <strong>
            ${workout.exercise}
        </strong>

        <p>
            ${workout.weight} kg
        </p>

        <small>
            ${workout.date}
        </small>

    </div>
    `;

}

/* ==================================================
   RECORDS PERSONALES
================================================== */

function getAllPRs(){

    const records = {};

    workouts.forEach(workout=>{

        if(

            !records[
                workout.exercise
            ]

        ){

            records[
                workout.exercise
            ] = workout.weight;

        }

        else{

            if(

                workout.weight >

                records[
                    workout.exercise
                ]

            ){

                records[
                    workout.exercise
                ] = workout.weight;

            }

        }

    });

    return records;

}

function updatePRs(){

    if(!prContainer){
        return;
    }

    prContainer.innerHTML = "";

    const records =
    getAllPRs();

    const entries =
    Object.entries(records);

    if(entries.length === 0){

        prContainer.innerHTML =

        `
        <p>
            Sin récords
        </p>
        `;

        return;

    }

    entries.forEach(

        ([exercise, weight]) => {

            prContainer.innerHTML +=

            `
            <div class="pr-card">

                <span>
                    🏆
                </span>

                <div>

                    <strong>
                        ${exercise}
                    </strong>

                    <p>
                        ${weight} kg
                    </p>

                </div>

            </div>
            `;

        }

    );

}

/* ==================================================
   RESUMEN SEMANAL
================================================== */

function updateWeeklySummary(){

    if(
        !weeklySessions ||
        !weeklyVolume
    ){
        return;
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    const mondayOffset = (now.getDay() + 6) % 7;

    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - mondayOffset);

    const weeklyWorkouts = workouts.filter(workout => {

        const date = parseWorkoutDate(workout.date);

        return date && date >= startOfWeek && date <= now;

    });

    weeklySessions.textContent = weeklyWorkouts.length;

    weeklyVolume.textContent = weeklyWorkouts
        .reduce((total, workout) => total + Number(workout.volume || 0), 0)
        .toLocaleString() + " kg";

}

/* ==================================================
   DASHBOARD MASTER
================================================== */

function updateDashboard(){

    updateTodayWorkout();

    updateLastWorkout();

    updatePRs();

    updateWeeklySummary();

    renderCalendar();

}
/* ==================================================
   HISTORIAL
================================================== */

function renderHistory() {

    if (!historyBody) return;

    historyBody.innerHTML = "";

    let filtered = [...workouts];

    const exerciseSearch =
        searchExercise?.value
            .toLowerCase()
            .trim();

    const dateSearch =
        searchDate?.value;

    if (exerciseSearch) {

        filtered = filtered.filter(

            workout =>

                workout.exercise
                .toLowerCase()
                .includes(exerciseSearch)

        );

    }

    if (dateSearch) {

        filtered = filtered.filter(

            workout =>

                workout.date ===

                new Date(dateSearch)
                .toLocaleDateString("es-AR")

        );

    }

    if (filtered.length === 0) {

        historyBody.innerHTML = `
            <tr>
                <td colspan="8">
                    Sin registros
                </td>
            </tr>
        `;

        return;
    }

    filtered
        .slice()
        .reverse()
        .forEach((workout, index) => {

            historyBody.innerHTML += `
                <tr>

                    <td>${workout.date}</td>

                    <td>${workout.trainingDay || "-"}</td>

                    <td>${workout.exercise}</td>

                    <td>${workout.weight}</td>

                    <td>${workout.sets}</td>

                    <td>${workout.reps}</td>

                    <td>${workout.volume}</td>

                    <td>

                        <button
                            class="btn-icon"
                            onclick="editWorkout(${workouts.indexOf(workout)})">

                            ✏️

                        </button>

                        <button
                            class="btn-icon danger"
                            onclick="deleteWorkout(${workouts.indexOf(workout)})">

                            🗑️

                        </button>

                    </td>

                </tr>
            `;

        });

}

/* ==================================================
   CALENDARIO DE ENTRENAMIENTOS
================================================== */

function formatCalendarDate(year, month, day) {

    return new Date(year, month, day)
        .toLocaleDateString("es-AR");

}

function getWorkoutsByDate(date) {

    return workouts.filter(workout => workout.date === date);

}

function renderCalendarDayDetail(date) {

    if (!calendarDayDetail) return;

    calendarDayDetail.innerHTML = "";

    const title = document.createElement("h3");
    title.textContent = date || "Detalle del día";
    calendarDayDetail.appendChild(title);

    if (!date) {

        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = "Seleccioná un día para ver el entrenamiento.";
        calendarDayDetail.appendChild(emptyMessage);
        return;

    }

    const dayWorkouts = getWorkoutsByDate(date);

    if (dayWorkouts.length === 0) {

        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = "No hay entrenamientos registrados este día.";
        calendarDayDetail.appendChild(emptyMessage);
        return;

    }

    const totalVolume = dayWorkouts.reduce(
        (total, workout) => total + Number(workout.volume || 0),
        0
    );

    const summary = document.createElement("div");
    summary.className = "calendar-day-total";
    summary.textContent =
        `${dayWorkouts.length} ejercicio${dayWorkouts.length === 1 ? "" : "s"} · ` +
        `${totalVolume.toLocaleString()} kg de volumen`;
    calendarDayDetail.appendChild(summary);

    const list = document.createElement("div");
    list.className = "calendar-detail-list";

    dayWorkouts.forEach(workout => {

        const session = document.createElement("article");
        session.className = "calendar-session";

        const exercise = document.createElement("strong");
        exercise.textContent = workout.exercise;

        const data = document.createElement("p");
        data.textContent =
            `${workout.trainingDay || "Rutina"} · ` +
            `${workout.sets} × ${workout.reps} · ${workout.weight} kg`;

        session.append(exercise, data);

        if (workout.notes) {

            const notes = document.createElement("p");
            notes.textContent = workout.notes;
            session.appendChild(notes);

        }

        list.appendChild(session);

    });

    calendarDayDetail.appendChild(list);

}

function renderCalendar() {

    if (!calendarGrid || !calendarMonthTitle) return;

    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = getTodayDate();

    calendarMonthTitle.textContent = calendarCursor.toLocaleDateString(
        "es-AR",
        { month: "long", year: "numeric" }
    );

    calendarGrid.innerHTML = "";

    for (let index = 0; index < firstWeekday; index += 1) {

        const emptyCell = document.createElement("span");
        emptyCell.className = "calendar-day empty";
        emptyCell.setAttribute("aria-hidden", "true");
        calendarGrid.appendChild(emptyCell);

    }

    for (let day = 1; day <= daysInMonth; day += 1) {

        const date = formatCalendarDate(year, month, day);
        const dayWorkouts = getWorkoutsByDate(date);
        const button = document.createElement("button");

        button.type = "button";
        button.className = "calendar-day";
        button.textContent = day;
        button.setAttribute("aria-label", `${date}: ${dayWorkouts.length} ejercicios`);

        if (dayWorkouts.length > 0) button.classList.add("has-workout");
        if (date === today) button.classList.add("today");
        if (date === selectedCalendarDate) button.classList.add("selected");

        button.addEventListener("click", () => {

            selectedCalendarDate = date;
            renderCalendar();
            renderCalendarDayDetail(date);

        });

        calendarGrid.appendChild(button);

    }

    if (selectedCalendarDate) {

        const selectedDate = parseWorkoutDate(selectedCalendarDate);

        if (
            !selectedDate ||
            selectedDate.getFullYear() !== year ||
            selectedDate.getMonth() !== month
        ) {

            selectedCalendarDate = null;
            renderCalendarDayDetail(null);

        }

    }

}

if (previousMonthBtn) {

    previousMonthBtn.addEventListener("click", () => {

        calendarCursor.setMonth(calendarCursor.getMonth() - 1);
        renderCalendar();

    });

}

if (nextMonthBtn) {

    nextMonthBtn.addEventListener("click", () => {

        calendarCursor.setMonth(calendarCursor.getMonth() + 1);
        renderCalendar();

    });

}

/* ==================================================
   FILTROS HISTORIAL
================================================== */

if (searchExercise) {

    searchExercise.addEventListener(

        "input",

        renderHistory

    );

}

if (searchDate) {

    searchDate.addEventListener(

        "change",

        renderHistory

    );

}

/* ==================================================
   FILTRO ESTADISTICAS
================================================== */

function normalizeExerciseName(value) {

    return String(value || "")
        .trim()
        .toLocaleLowerCase("es-AR");

}

function getSelectedExerciseRecords(applyPeriod = true) {

    const selectedExercise = exerciseFilter?.value;

    if (!selectedExercise) return [];

    let records = workouts.filter(
        workout => normalizeExerciseName(workout.exercise) === selectedExercise
    );

    if (applyPeriod && statisticsPeriod?.value !== "all") {

        const days = Number(statisticsPeriod.value);
        const limit = new Date();
        limit.setHours(0, 0, 0, 0);
        limit.setDate(limit.getDate() - days + 1);

        records = records.filter(workout => {

            const date = parseWorkoutDate(workout.date);
            return date && date >= limit;

        });

    }

    return records.slice().sort((first, second) => {

        const firstDate = parseWorkoutDate(first.date)?.getTime() || 0;
        const secondDate = parseWorkoutDate(second.date)?.getTime() || 0;
        return firstDate - secondDate;

    });

}

function updateExerciseFilter() {

    if (!exerciseFilter) return;

    const currentSelection = exerciseFilter.value;
    const exercises = new Map();

    workouts.forEach(workout => {

        const normalizedName = normalizeExerciseName(workout.exercise);

        if (normalizedName && !exercises.has(normalizedName)) {

            exercises.set(normalizedName, String(workout.exercise).trim());

        }

    });

    exerciseFilter.innerHTML = `
        <option value="">
            Seleccionar ejercicio
        </option>
    `;

    [...exercises.entries()]
        .sort((first, second) => first[1].localeCompare(second[1], "es-AR"))
        .forEach(([value, label]) => {

            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            exerciseFilter.appendChild(option);

        });

    const normalizedSelection = normalizeExerciseName(currentSelection);

    if (exercises.has(normalizedSelection)) {

        exerciseFilter.value = normalizedSelection;

    }

}

/* ==================================================
   INFO EJERCICIO
================================================== */

function updateExerciseInfo() {

    if (
        !exerciseFilter ||
        !selectedExerciseInfo
    ) {
        return;
    }

    const records = getSelectedExerciseRecords();

    if (!exerciseFilter.value) {

        selectedExerciseInfo.innerHTML = "";

        return;
    }

    if (records.length === 0) {

        selectedExerciseInfo.innerHTML = `
            <p>No hay registros de este ejercicio en el período seleccionado.</p>
        `;
        return;

    }

    const exercise = String(records[0].exercise).trim();
    const maxWeight = Math.max(...records.map(item => Number(item.weight || 0)));
    const maxVolume = Math.max(...records.map(item => Number(item.volume || 0)));
    const maxOneRM = Math.max(...records.map(item =>
        calculate1RM(Number(item.weight || 0), Number(item.reps || 0))
    ));
    const averageWeight = records.reduce(
        (total, item) => total + Number(item.weight || 0),
        0
    ) / records.length;
    const bestSet = records.reduce((best, item) => {

        const score = calculate1RM(
            Number(item.weight || 0),
            Number(item.reps || 0)
        );
        const bestScore = calculate1RM(
            Number(best.weight || 0),
            Number(best.reps || 0)
        );

        return score > bestScore || (
            score === bestScore && Number(item.weight) > Number(best.weight)
        ) ? item : best;

    }, records[0]);
    const firstWeight = Number(records[0].weight || 0);
    const lastWeight = Number(records[records.length - 1].weight || 0);
    const variation = firstWeight > 0
        ? ((lastWeight - firstWeight) / firstWeight) * 100
        : 0;
    const variationClass = variation > 0
        ? "positive"
        : variation < 0
            ? "negative"
            : "neutral";

    selectedExerciseInfo.innerHTML = `
        <div class="exercise-progress-header">
            <div>
                <p class="exercise-progress-label">Progreso de</p>
                <h3>${escapeHTML(exercise)}</h3>
            </div>
            <span class="exercise-record-count">
                ${records.length} registro${records.length === 1 ? "" : "s"}
            </span>
        </div>

        <div class="exercise-stats-grid">
            <div class="exercise-stat">
                <span>PR de peso</span>
                <strong>${maxWeight.toLocaleString("es-AR")} kg</strong>
            </div>
            <div class="exercise-stat">
                <span>Mejor serie</span>
                <strong>${bestSet.weight} kg × ${bestSet.reps}</strong>
            </div>
            <div class="exercise-stat">
                <span>Mejor volumen</span>
                <strong>${maxVolume.toLocaleString("es-AR")} kg</strong>
            </div>
            <div class="exercise-stat">
                <span>1RM estimado</span>
                <strong>${maxOneRM.toLocaleString("es-AR")} kg</strong>
            </div>
            <div class="exercise-stat">
                <span>Peso promedio</span>
                <strong>${averageWeight.toLocaleString("es-AR", {
                    maximumFractionDigits: 1
                })} kg</strong>
            </div>
            <div class="exercise-stat">
                <span>Evolución del período</span>
                <strong class="${variationClass}">
                    ${variation > 0 ? "+" : ""}${variation.toLocaleString("es-AR", {
                        maximumFractionDigits: 1
                    })}%
                </strong>
            </div>
        </div>
    `;

}

/* ==================================================
   CHART
================================================== */

function updateProgressChart() {

    const canvas =
    document.getElementById(
        "progressChart"
    );

    if (!canvas) return;

    const exercise = exerciseFilter?.value;

    if (!exercise) {

        if (progressChart) {

            progressChart.destroy();

            progressChart = null;

        }

        return;
    }

    const data = getSelectedExerciseRecords();

    const labels =

    data.map(
        item => item.date
    );

    const metric = statisticsMetric?.value || "weight";
    const metricConfig = {
        weight: {
            label: "Peso (kg)",
            values: data.map(item => Number(item.weight || 0))
        },
        volume: {
            label: "Volumen (kg)",
            values: data.map(item => Number(item.volume || 0))
        },
        oneRM: {
            label: "1RM estimado (kg)",
            values: data.map(item =>
                calculate1RM(Number(item.weight || 0), Number(item.reps || 0))
            )
        }
    }[metric];

    if (progressChart) {

        progressChart.destroy();

    }

    if (typeof Chart === "undefined") {

        console.warn("Chart.js no está disponible.");
        return;

    }

    progressChart = new Chart(

        canvas,

        {

            type: "line",

            data: {

                labels,

                datasets: [

                    {

                        label: metricConfig.label,

                        data: metricConfig.values,

                        borderColor: "#2F6B3D",

                        backgroundColor: "rgba(47, 107, 61, .15)",

                        pointBackgroundColor: "#2F6B3D",

                        fill: true,

                        tension: 0.3

                    }

                ]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                interaction: {
                    intersect: false,
                    mode: "index"
                },

                scales: {
                    y: {
                        beginAtZero: false
                    }
                }

            }

        }

    );

}

/* ==================================================
   EVENTOS ESTADISTICAS
================================================== */

if (exerciseFilter) {

    exerciseFilter.addEventListener(

        "change",

        () => {

            updateExerciseInfo();

            updateProgressChart();

        }

    );

}

if (statisticsPeriod) {

    statisticsPeriod.addEventListener("change", () => {

        updateExerciseInfo();
        updateProgressChart();

    });

}

if (statisticsMetric) {

    statisticsMetric.addEventListener("change", updateProgressChart);

}
/* ==================================================
   SEGUIMIENTO CORPORAL
================================================== */

function saveBodyMeasurement(event) {

    event.preventDefault();

    const bodyData = {

        id: Date.now(),

        date: getTodayDate(),

        weight:
        Number(bodyWeightInput.value),

        arm:
        Number(armInput.value),

        chest:
        Number(chestInput.value),

        waist:
        Number(waistInput.value),

        leg:
        Number(legInput.value)

    };

    bodyMeasurements.push(
        bodyData
    );

    saveBody();

    bodyForm.reset();

    renderBodyHistory();

    updateGoalProgress();

}

/* ==================================================
   FORM CORPORAL
================================================== */

if(bodyForm){

    bodyForm.addEventListener(

        "submit",

        saveBodyMeasurement

    );

}

/* ==================================================
   TABLA CORPORAL
================================================== */

function renderBodyHistory(){

    if(!bodyHistoryBody){

        return;

    }

    bodyHistoryBody.innerHTML = "";

    if(bodyMeasurements.length === 0){

        bodyHistoryBody.innerHTML = `
            <tr>
                <td colspan="7">
                    Sin registros
                </td>
            </tr>
        `;

        return;

    }

    bodyMeasurements
    .slice()
    .reverse()
    .forEach(record => {

        bodyHistoryBody.innerHTML += `

            <tr>

                <td>
                    ${record.date}
                </td>

                <td>
                    ${record.weight}
                </td>

                <td>
                    ${record.arm}
                </td>

                <td>
                    ${record.chest}
                </td>

                <td>
                    ${record.waist}
                </td>

                <td>
                    ${record.leg}
                </td>

                <td>

                    <button
                        class="btn-icon danger"
                        onclick="deleteBodyMeasurement(${record.id})">

                        🗑️

                    </button>

                </td>

            </tr>

        `;

    });

}

/* ==================================================
   ELIMINAR REGISTRO CORPORAL
================================================== */

function deleteBodyMeasurement(id){

    const confirmDelete = confirm(

        "¿Eliminar medición?"

    );

    if(!confirmDelete){

        return;

    }

    bodyMeasurements =
    bodyMeasurements.filter(

        item => item.id !== id

    );

    saveBody();

    renderBodyHistory();

    updateGoalProgress();

}

/* ==================================================
   ULTIMO PESO
================================================== */

function getCurrentWeight(){

    if(

        bodyMeasurements.length === 0

    ){

        return null;

    }

    return bodyMeasurements[
        bodyMeasurements.length - 1
    ].weight;

}

/* ==================================================
   CAMBIO DE PESO
================================================== */

function getWeightDifference(){

    if(

        bodyMeasurements.length < 2

    ){

        return 0;

    }

    const first =

    bodyMeasurements[0].weight;

    const last =

    bodyMeasurements[
        bodyMeasurements.length - 1
    ].weight;

    return (

        last - first

    ).toFixed(1);

}

/* ==================================================
   RESUMEN CORPORAL
================================================== */

function updateBodySummary(){

    const currentWeightEl =
    document.getElementById(
        "currentWeight"
    );

    const weightChangeEl =
    document.getElementById(
        "weightChange"
    );

    if(currentWeightEl){

        currentWeightEl.textContent =

        getCurrentWeight() || "-";

    }

    if(weightChangeEl){

        const diff =

        getWeightDifference();

        weightChangeEl.textContent =

        diff + " kg";

    }

}
/* ==================================================
   OBJETIVO DE PESO
================================================== */

function saveWeightGoal() {

    const value = Number(

        goalWeightInput.value

    );

    if (!value) {

        alert(
            "Ingresá un peso objetivo"
        );

        return;

    }

    goalWeight = value;

    saveGoal();

    updateGoalProgress();

}

/* ==================================================
   PROGRESO OBJETIVO
================================================== */

function updateGoalProgress() {

    if (
        !goalProgressBar ||
        !goalProgressText
    ) {
        return;
    }

    const currentWeight =
    getCurrentWeight();

    if (
        !goalWeight ||
        !currentWeight
    ) {

        goalProgressBar.style.width =
        "0%";

        goalProgressText.textContent =
        "Sin datos";

        return;
    }

    let progress =

        (currentWeight / goalWeight)
        * 100;

    progress = Math.min(
        progress,
        100
    );

    goalProgressBar.style.width =
    progress + "%";

    goalProgressText.textContent =

    `${currentWeight} kg / ${goalWeight} kg`;

}

if(saveGoalBtn){

    saveGoalBtn.addEventListener(

        "click",

        saveWeightGoal

    );

}

/* ==================================================
   EXPORTAR CSV
================================================== */

function exportCSV() {

    if(workouts.length === 0){

        alert(
            "No hay datos"
        );

        return;

    }

    const escapeCSV = value =>
        `"${String(value ?? "").replaceAll('"', '""')}"`;

    const rows = [[
        "Fecha", "Dia", "Ejercicio", "Peso",
        "Series", "Reps", "Volumen", "Notas"
    ]];

    workouts.forEach(item => {

        rows.push([
            item.date,
            item.trainingDay,
            item.exercise,
            item.weight,
            item.sets,
            item.reps,
            item.volume,
            item.notes || ""
        ]);

    });

    const csv = rows
        .map(row => row.map(escapeCSV).join(","))
        .join("\r\n");

    const blob = new Blob(

        [csv],

        {
            type:
            "text/csv;charset=utf-8;"
        }

    );

    const url =
    URL.createObjectURL(blob);

    const link =
    document.createElement("a");

    link.href = url;

    link.download =
    "forza-workouts.csv";

    link.click();

    URL.revokeObjectURL(url);

}

if(exportCSVBtn){

    exportCSVBtn.addEventListener(

        "click",

        exportCSV

    );

}

/* ==================================================
   BACKUP JSON
================================================== */

function backupJSON() {

    const backup = {

        app: "FORZA",

        schemaVersion: 1,

        exportedAt: new Date().toISOString(),

        workouts,

        routines,

        bodyMeasurements,

        goalWeight

    };

    const blob = new Blob(

        [

            JSON.stringify(

                backup,
                null,
                2

            )

        ],

        {

            type:
            "application/json"

        }

    );

    const url =

    URL.createObjectURL(blob);

    const link =

    document.createElement("a");

    link.href = url;

    link.download =
    "forza-backup.json";

    link.click();

    URL.revokeObjectURL(url);

}

if(backupJSONBtn){

    backupJSONBtn.addEventListener(

        "click",

        backupJSON

    );

}

/* ==================================================
   RESTAURAR BACKUP
================================================== */

function restoreBackup(event){

    const file =

    event.target.files[0];

    if(!file){

        return;

    }

    const reader =
    new FileReader();

    reader.onload = function(e){

        try{

            const backup =

            JSON.parse(

                e.target.result

            );

            if(
                !backup ||
                !Array.isArray(backup.workouts) ||
                !backup.routines ||
                typeof backup.routines !== "object" ||
                !Array.isArray(backup.bodyMeasurements)
            ){

                throw new Error("Estructura de backup inválida");

            }

            workouts =
            backup.workouts;

            routines =
            backup.routines || {

                "Día 1": [],
                "Día 2": [],
                "Día 3": [],
                "Día 4": []

            };

            bodyMeasurements =
            backup.bodyMeasurements;

            goalWeight =
            backup.goalWeight ?? null;

            saveWorkouts();
            saveRoutines();
            saveBody();
            saveGoal();

            initializeApp();

            alert(
                "Backup restaurado"
            );

            event.target.value = "";

        }

        catch(error){

            console.error("No se pudo restaurar el backup", error);

            alert(
                "Archivo inválido"
            );

            event.target.value = "";

        }

    };

    reader.readAsText(file);

}

if(restoreBackupInput){

    restoreBackupInput.addEventListener(

        "change",

        restoreBackup

    );

}
/* ==================================================
   TEMPORIZADOR
================================================== */

function updateTimerDisplay(){

    if(!timerDisplay){

        return;

    }

    const minutes =

    Math.floor(

        timerSeconds / 60

    );

    const seconds =

    timerSeconds % 60;

    timerDisplay.textContent =

    `${minutes}:${
        seconds
        .toString()
        .padStart(2,"0")
    }`;

}

function startTimer(){

    clearInterval(
        timerInterval
    );

    timerInterval =

    setInterval(()=>{

        timerSeconds--;

        updateTimerDisplay();

        if(timerSeconds <= 0){

            clearInterval(
                timerInterval
            );

            alert(
                "⏱️ Descanso terminado"
            );

        }

    },1000);

}

function resetTimer(){

    clearInterval(
        timerInterval
    );

    timerSeconds = 90;

    updateTimerDisplay();

}

if(startTimerBtn){

    startTimerBtn.addEventListener(

        "click",

        startTimer

    );

}

if(resetTimerBtn){

    resetTimerBtn.addEventListener(

        "click",

        resetTimer

    );

}

/* ==================================================
   INITIALIZE APP
================================================== */



/* ==================================================
   INICIALIZACION GENERAL
================================================== */

function initializeApp() {

    loadDarkMode();

    initializeRoutines();

    updateDashboard();

    updateQuickStats();

    renderHistory();

    renderBodyHistory();

    updateExerciseFilter();

    updateProgressChart();

    updateGoalProgress();

    updateTimerDisplay();

}
document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);
