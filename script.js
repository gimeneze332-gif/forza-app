/* ==================================================
   FORZA V5
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

let workouts =
JSON.parse(
    localStorage.getItem(STORAGE.workouts)
) || [];

let routines =
JSON.parse(
    localStorage.getItem(STORAGE.routines)
) || {

    "Día 1": [],
    "Día 2": [],
    "Día 3": [],
    "Día 4": []

};

let bodyMeasurements =
JSON.parse(
    localStorage.getItem(STORAGE.body)
) || [];

let goalWeight =
JSON.parse(
    localStorage.getItem(STORAGE.goal)
) || null;

/* ==================================================
   GLOBALS
================================================== */

let progressChart = null;
let editingWorkout = null;

let timerSeconds = 90;
let timerInterval = null;

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
   ESTADISTICAS
================================================== */

const exerciseFilter =
document.getElementById("exerciseFilter");

const selectedExerciseInfo =
document.getElementById("selectedExerciseInfo");

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

    weeklySessions.textContent =

    workouts.length;

    weeklyVolume.textContent =

    getTotalVolume()
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

function updateExerciseFilter() {

    if (!exerciseFilter) return;

    const exercises = [

        ...new Set(

            workouts.map(

                item => item.exercise

            )

        )

    ];

    exerciseFilter.innerHTML = `
        <option value="">
            Seleccionar ejercicio
        </option>
    `;

    exercises.forEach(exercise => {

        exerciseFilter.innerHTML += `
            <option value="${exercise}">
                ${exercise}
            </option>
        `;

    });

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

    const exercise =
        exerciseFilter.value;

    if (!exercise) {

        selectedExerciseInfo.innerHTML = "";

        return;
    }

    const records = workouts.filter(

        item =>
            item.exercise === exercise

    );

    const maxWeight = Math.max(

        ...records.map(
            item => item.weight
        )

    );

    const maxVolume = Math.max(

        ...records.map(
            item => item.volume
        )

    );

    selectedExerciseInfo.innerHTML = `
        <div class="stat-box">

            <h4>${exercise}</h4>

            <p>
                PR:
                <strong>
                    ${maxWeight} kg
                </strong>
            </p>

            <p>
                Mejor volumen:
                <strong>
                    ${maxVolume}
                </strong>
            </p>

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

    const exercise =
    exerciseFilter?.value;

    if (!exercise) {

        if (progressChart) {

            progressChart.destroy();

            progressChart = null;

        }

        return;
    }

    const data = workouts.filter(

        item =>

        item.exercise === exercise

    );

    const labels =

    data.map(
        item => item.date
    );

    const weights =

    data.map(
        item => item.weight
    );

    if (progressChart) {

        progressChart.destroy();

    }

    progressChart = new Chart(

        canvas,

        {

            type: "line",

            data: {

                labels,

                datasets: [

                    {

                        label:
                        "Peso",

                        data: weights,

                        tension: 0.3

                    }

                ]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false

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

    let csv =

`Fecha,Dia,Ejercicio,Peso,Series,Reps,Volumen,Notas
`;

    workouts.forEach(item => {

        csv +=

`${item.date},
${item.trainingDay},
${item.exercise},
${item.weight},
${item.sets},
${item.reps},
${item.volume},
${item.notes || ""}
\n`;

    });

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

            workouts =
            backup.workouts || [];

            routines =
            backup.routines || {

                "Día 1": [],
                "Día 2": [],
                "Día 3": [],
                "Día 4": []

            };

            bodyMeasurements =
            backup.bodyMeasurements || [];

            goalWeight =
            backup.goalWeight || null;

            saveWorkouts();
            saveRoutines();
            saveBody();
            saveGoal();

            initializeApp();

            alert(
                "Backup restaurado"
            );

        }

        catch(error){

            alert(
                "Archivo inválido"
            );

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
   HISTORIAL
================================================== */

function renderHistory(){

    if(!historyBody){

        return;

    }

    historyBody.innerHTML = "";

    let filtered = [...workouts];

    if(searchExercise?.value){

        filtered = filtered.filter(

            item =>

            item.exercise
            .toLowerCase()
            .includes(

                searchExercise.value
                .toLowerCase()

            )

        );

    }

    if(searchDate?.value){

        filtered = filtered.filter(

            item =>

            item.date ===
            searchDate.value

        );

    }

    filtered
    .slice()
    .reverse()
    .forEach((item,index)=>{

        historyBody.innerHTML += `

        <tr>

            <td>${item.date}</td>

            <td>${item.trainingDay}</td>

            <td>${item.exercise}</td>

            <td>${item.weight}</td>

            <td>${item.sets}</td>

            <td>${item.reps}</td>

            <td>${item.volume}</td>

            <td>

                <button
                class="btn-icon"
                onclick="editWorkout(${workouts.indexOf(item)})">

                    ✏️

                </button>

                <button
                class="btn-icon danger"
                onclick="deleteWorkout(${workouts.indexOf(item)})">

                    🗑️

                </button>

            </td>

        </tr>

        `;

    });

}

if(searchExercise){

    searchExercise.addEventListener(

        "input",

        renderHistory

    );

}

if(searchDate){

    searchDate.addEventListener(

        "change",

        renderHistory

    );

}

/* ==================================================
   FILTRO ESTADISTICAS
================================================== */

function updateExerciseFilter(){

    if(!exerciseFilter){

        return;

    }

    exerciseFilter.innerHTML =

    `<option value="">
        Seleccionar ejercicio
    </option>`;

    const uniqueExercises = [

        ...new Set(

            workouts.map(

                item => item.exercise

            )

        )

    ];

    uniqueExercises.forEach(exercise=>{

        exerciseFilter.innerHTML +=

        `

        <option value="${exercise}">

            ${exercise}

        </option>

        `;

    });

}

/* ==================================================
   INFO EJERCICIO
================================================== */

function updateExerciseInfo(){

    if(
        !exerciseFilter ||
        !selectedExerciseInfo
    ){

        return;

    }

    const exercise =
    exerciseFilter.value;

    if(!exercise){

        selectedExerciseInfo.innerHTML =

        `<p>Seleccioná un ejercicio</p>`;

        return;

    }

    const data =

    workouts.filter(

        item =>

        item.exercise === exercise

    );

    const pr = Math.max(

        ...data.map(
            item => item.weight
        )

    );

    const volume =

    data.reduce(

        (acc,item)=>

        acc + item.volume,

        0

    );

    selectedExerciseInfo.innerHTML =

    `

    <div class="stats-card">

        <h4>${exercise}</h4>

        <p>

            PR:
            <strong>
                ${pr} kg
            </strong>

        </p>

        <p>

            Volumen Total:
            <strong>
                ${volume}
            </strong>

        </p>

    </div>

    `;

}

/* ==================================================
   CHART
================================================== */

function updateProgressChart(){

    const canvas =

    document.getElementById(
        "progressChart"
    );

    if(!canvas){

        return;

    }

    const exercise =
    exerciseFilter?.value;

    if(!exercise){

        return;

    }

    const data =

    workouts.filter(

        item =>

        item.exercise === exercise

    );

    const labels =

    data.map(
        item => item.date
    );

    const weights =

    data.map(
        item => item.weight
    );

    if(progressChart){

        progressChart.destroy();

    }

    progressChart =

    new Chart(

        canvas,

        {

            type: "line",

            data: {

                labels,

                datasets: [

                    {

                        label:
                        "Peso",

                        data:
                        weights,

                        tension: 0.3

                    }

                ]

            },

            options: {

                responsive: true,

                maintainAspectRatio:
                false

            }

        }

    );

}

if(exerciseFilter){

    exerciseFilter.addEventListener(

        "change",

        ()=>{

            updateExerciseInfo();

            updateProgressChart();

        }

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

