/* variables */
const dayToNumber = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
};

const numberToDay = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
};

const tableBody = document.querySelector('#scheduleTable tbody');
const tableCells = []; // contains cells for the days of the week
let eventBoxes = []; // contains objects with event box data {taskName, day, startTime, endTime, description, eventId}
// form elements
const addEventForm = document.getElementById('scheduleForm');
const editEventForm = document.getElementById('editForm');
const saveScheduleForm = document.getElementById('saveScheduleForm');

/* site intialization functions */

function initSite() {

    initCreateEventForm();

    const startHour = 0;
    const endHour = 24;

    // create tbody table
    for (let i = startHour; i < endHour; i++) {
        let row = document.createElement('tr');
        const rowCells = [];

        for (let j = 0; j < 8; j++) {
            let col = document.createElement('td');
            if (j == 0) {
                col.innerText = i + ":00";
            } else {
                rowCells.push(col);
            }
            row.appendChild(col);
        }
        tableCells.push(rowCells);
        tableBody.appendChild(row);
    }

    // load default schedule if available
    const defaultSchedule = localStorage.getItem('defaultSchedule');
    if (defaultSchedule != null) {
        loadSchedule(defaultSchedule);
    }

    // load view schedules list
    updateViewSchedulesList();


}

function initCreateEventForm() {
    const minuteInterval = 15; // event time intervals
    generateTimeOptions(minuteInterval); // generate time options for create event form

    // Form day of the week buttons
    const buttons = document.querySelectorAll(".toggle-btn");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            if (button.value == 'All' && !button.classList.contains('btn-selected')) {
                document.querySelectorAll('.toggle-btn.btn-selected').forEach((btn) => {
                    btn.classList.toggle('btn-selected');
                })
            } else if (!(button.value == 'All') && document.querySelector('button[value=All]').classList.contains('btn-selected')) {
                document.querySelector('button[value=All]').classList.toggle('btn-selected');
            }
            button.classList.toggle("btn-selected");
        });
    });
}


/* Event box manipulation functions */

function createEventBox(day, taskName, startTime, endTime, description, eventId) {


    // get bounding rectangle for container and top starting cell for parameter value calculations
    const row = parseInt(startTime.substring(0, 2));
    const col = dayToNumber[day];
    const startingCellRect = tableCells[row][col].getBoundingClientRect();
    const containerRect = document.getElementById('scheduleTable').getBoundingClientRect();

    // event box parameters
    let boxHeight = (timeToNum(endTime) - timeToNum(startTime)) * startingCellRect.height;
    let boxWidth = startingCellRect.width;
    let boxLeft = startingCellRect.left;
    let boxTop = parseInt(startTime.substring(3, 5)) == 0 ? startingCellRect.top : startingCellRect.top + startingCellRect.height * (parseInt(startTime.substring(3, 5)) / 60);

    // set position of event box
    const box = document.createElement('div');
    const boxBottomMargin = 2;
    const boxLeftMargin = 0.2;
    box.classList.add('eventBox');
    box.style.height = boxHeight - boxBottomMargin + 'px';
    box.style.width = (boxWidth * 100 / containerRect.width) - boxLeftMargin + '%';
    box.style.left = ((boxLeft - containerRect.left) * 100 / containerRect.width) + boxLeftMargin + '%';
    box.style.top = ((boxTop - containerRect.top) * 100 / containerRect.height) + '%';



    // display text in event box
    const taskNameText = document.createElement('div');
    const timeText = document.createElement('div');
    const descText = document.createElement('div');

    taskNameText.innerText = taskName;
    taskNameText.style.fontWeight = "bold";
    timeText.innerText = startTime + " - " + endTime;
    descText.innerText = description;

    box.appendChild(taskNameText);
    box.appendChild(timeText);
    box.appendChild(descText);

    // set eventid attribute 
    box.setAttribute('data-eventid', eventId);

    // event box drag and drop functionality
    const minuteInterval = 15;
    dragOrSelectEventBox(box, minuteInterval);

    document.getElementById('scheduleTable').appendChild(box);
}

// creates an event box for some string 'day' and appends it to schedule table
function createNewEventBox(day, taskName, startTime, endTime, description) {

    // add event box details to array of events
    const eventId = '' + dayToNumber[day] + timeToNum(startTime) + timeToNum(endTime)
    eventBoxes.push({ 'taskName': taskName, 'day': day, 'startTime': startTime, 'endTime': endTime, 'description': description, 'eventId': eventId });

    // create event box
    createEventBox(day, taskName, startTime, endTime, description, eventId);
}

// delete event box
function deleteSelectedEventBoxes() {
    const selected = document.querySelectorAll(".eventBox-selected");
    selected.forEach((box) => {
        const eventId = box.dataset.eventid;
        eventBoxes = eventBoxes.filter(boxes => boxes.eventId != eventId);
        document.getElementById('scheduleTable').removeChild(box);
    })
}

// edit event box taskname and description
function editSelectedEventBoxes(taskName, description) {
    const selected = document.querySelectorAll(".eventBox-selected");
    selected.forEach((box) => {
        const eventId = box.dataset.eventid;

        let eventBoxInfo = eventBoxes.find((element) => {
            if (element.eventId == eventId) {
                return element;
            }
        })

        eventBoxInfo.taskName = taskName;
        eventBoxInfo.description = description;
        const startTime = eventBoxInfo.startTime;
        const endTime = eventBoxInfo.endTime;

        // update box

        // remove children from box
        box.textContent = '';
        // display text in event box
        const taskNameText = document.createElement('div');
        const timeText = document.createElement('div');
        const descText = document.createElement('div');

        taskNameText.innerText = eventBoxInfo.taskName;
        taskNameText.style.fontWeight = "bold";
        timeText.innerText = startTime + " - " + endTime;
        descText.innerText = eventBoxInfo.description;

        box.appendChild(taskNameText);
        box.appendChild(timeText);
        box.appendChild(descText);

        // unselect box
        box.classList.toggle('eventBox-selected');
    })
}

// event box drag or select
function dragOrSelectEventBox(boxObject, minuteInterval) {
    var mouseX = 0, mouseY = 0, mouseYToBoxTop = 0;
    let day = null, startTime = null, endTime = null, previewBoxObject = null, eventBoxId = null, eventBoxInfo = null;
    let validPlacement = true, selectedEventBox = true;
    const container = document.getElementById('scheduleTable');
    boxObject.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        // create preview boxObject
        previewBoxObject = boxObject.cloneNode(true);
        previewBoxObject.classList.toggle('eventBox-dragging');
        container.appendChild(previewBoxObject);
        // make box transparent
        boxObject.classList.toggle('eventBox-afterimage');
        eventBoxId = boxObject.dataset.eventid;

        eventBoxInfo = eventBoxes.find((element) => {
            if (element.eventId == eventBoxId) {
                return element;
            }
        })
        // set default day, starttime, endtime
        day = eventBoxInfo.day;
        startTime = eventBoxInfo.startTime;
        endTime = eventBoxInfo.endTime;

        // get cursor positions
        mouseX = e.clientX;
        mouseY = e.clientY;
        mouseYToBoxTop = mouseY - boxObject.getBoundingClientRect().top;
        document.onmouseup = closeDragElement;

        // call a function whenever the cursor moves
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        // variables
        const eventLengthHours = timeToNum(eventBoxInfo.endTime) - timeToNum(eventBoxInfo.startTime);
        const containerRect = document.getElementById('scheduleTableBody').getBoundingClientRect();
        let tempDay = null, tempStartTime = null, tempEndTime = null;

        // calculate day, starttime, endtime
        tempDay = Math.floor((mouseX - containerRect.left) * 8 / containerRect.width - 1);
        if (tempDay < 0)
            tempDay = 0;
        else if (tempDay > 6)
            tempDay = 6;
        tempDay = numberToDay[tempDay];

        tempStartTime = Math.floor((mouseY - mouseYToBoxTop - containerRect.top) * 24 * (60 / minuteInterval) / containerRect.height) / (60 / minuteInterval); // split table by interval
        if (tempStartTime < 0)
            tempStartTime = 0;
        if (tempStartTime > (24 - eventLengthHours))
            tempStartTime = 24 - eventLengthHours;

        tempEndTime = tempStartTime + eventLengthHours;

        // check drag location is valid
        eventBoxes.forEach((box) => {
            const boxStartTime = timeToNum(box.startTime);
            const boxEndTime = timeToNum(box.endTime);
            // check for valid event box parameters
            if (box.day == tempDay && tempStartTime >= boxStartTime && tempStartTime < boxEndTime && eventBoxId != box.eventId) {
                validPlacement = false;
            } else if (box.day == tempDay && tempEndTime > boxStartTime && tempEndTime <= boxEndTime && eventBoxId != box.eventId) {
                validPlacement = false;
            } else if (box.day == tempDay && tempStartTime < boxStartTime && tempEndTime > boxEndTime && eventBoxId != box.eventId) {
                validPlacement = false;
            }
        })

        // convert starttime and endtime to string
        h = Math.floor(tempStartTime);
        m = (tempStartTime - h) * 60
        tempStartTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        h = Math.floor(tempEndTime);
        m = (tempEndTime - h) * 60
        tempEndTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        // move preview event box
        if (validPlacement) {
            updateEventBox(previewBoxObject, startTime, endTime);

            if (day != tempDay || startTime != tempStartTime || endTime != tempEndTime)
                selectedEventBox = false;

            // update day, starttime, endtime
            day = tempDay;
            startTime = tempStartTime;
            endTime = tempEndTime;
        }

        // get new cursor positions
        mouseX = e.clientX;
        mouseY = e.clientY;
        validPlacement = true;

    }

    function closeDragElement() {
        // stop moving when mouse button is released
        document.onmouseup = null;
        document.onmousemove = null;
        // remove previewBoxObject from container
        container.removeChild(previewBoxObject);
        // update boxObject
        const eventId = '' + dayToNumber[day] + timeToNum(startTime) + timeToNum(endTime);
        updateEventBox(boxObject, startTime, endTime);
        boxObject.classList.toggle('eventBox-afterimage');
        boxObject.dataset.eventid = eventId;
        // update eventBoxInfo for boxObject
        eventBoxInfo.day = day;
        eventBoxInfo.startTime = startTime;
        eventBoxInfo.endTime = endTime;
        eventBoxInfo.eventId = eventId;
        // toggle selected
        if (selectedEventBox)
            boxObject.classList.toggle('eventBox-selected');
        selectedEventBox = true;
    }

    function updateEventBox(box, startTime, endTime) {
        // get bounding rectangle for container and top starting cell for parameter value calculations
        const row = parseInt(startTime.substring(0, 2));
        const col = dayToNumber[day];
        const startingCellRect = tableCells[row][col].getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // event box parameters
        let boxHeight = (timeToNum(endTime) - timeToNum(startTime)) * startingCellRect.height;
        let boxWidth = startingCellRect.width;
        let boxLeft = startingCellRect.left;
        let boxTop = parseInt(startTime.substring(3, 5)) == 0 ? startingCellRect.top : startingCellRect.top + startingCellRect.height * (parseInt(startTime.substring(3, 5)) / 60);

        // set position of event box
        const boxBottomMargin = 2;
        const boxLeftMargin = 0.2;
        box.style.height = boxHeight - boxBottomMargin + 'px';
        box.style.width = (boxWidth * 100 / containerRect.width) - boxLeftMargin + '%';
        box.style.left = ((boxLeft - containerRect.left) * 100 / containerRect.width) + boxLeftMargin + '%';
        box.style.top = ((boxTop - containerRect.top) * 100 / containerRect.height) + '%';

        // remove children from box
        box.textContent = '';
        // display text in event box
        const taskNameText = document.createElement('div');
        const timeText = document.createElement('div');
        const descText = document.createElement('div');

        taskNameText.innerText = eventBoxInfo.taskName;
        taskNameText.style.fontWeight = "bold";
        timeText.innerText = startTime + " - " + endTime;
        descText.innerText = eventBoxInfo.description;

        box.appendChild(taskNameText);
        box.appendChild(timeText);
        box.appendChild(descText);
    }
}

/* Event Listeners */

// delete event btn
document.getElementById('delete-eventbox-btn').addEventListener("click", deleteSelectedEventBoxes);

/* Form Submit btn listeners */
addEventForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const errors = validateAddEventForm(); // check for errors

    if (errors.length > 0) {
        alert(errors)
    } else {

        // variables
        const taskName = document.getElementById('taskName').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const description = document.getElementById('description').value;

        // create event boxes
        const days = this.querySelectorAll(".btn-selected");
        days.forEach((day) => {
            if (day.value == 'All') {
                for (let key in dayToNumber) {
                    createNewEventBox(key, taskName, startTime, endTime, description);
                }
            } else {
                createNewEventBox(day.value, taskName, startTime, endTime, description);
            }
        })

        // hide modal
        $('#eventCreate').modal('toggle');

        // reset form
        this.reset()
        days.forEach((btn) => {
            btn.classList.toggle('btn-selected');
        })

    }
})

editEventForm.addEventListener('submit', function (event) {
    event.preventDefault();

    const taskName = document.getElementById('editTaskName').value;
    const description = document.getElementById('editDescription').value;

    editSelectedEventBoxes(taskName, description);

    // hide modal
    $('#eventEdit').modal('toggle');

    // reset edit form
    this.reset();
})

saveScheduleForm.addEventListener('submit', function (event) {
    /* Saves schedule data onto local browser storage 
        Local browser storage will contain the following items:
         {UNIQUE SCHEDULE NAME SET BY USER} - contains array of eventbox objects containing eventbox data for the schedule
         defaultSchedule - contains default schedule by name being displayed
         scheduleNames - contains array of schedule names
         numSchedules - number of schedules saved
    */
    event.preventDefault();

    const errors = validateSaveScheduleForm();

    if (errors.length > 0) {
        alert(errors)
    } else {

        const scheduleName = document.getElementById('scheduleName').value;

        // check if this is the first schedule being added
        if (localStorage.getItem('numSchedules') == null || parseInt(localStorage.getItem('numSchedules')) <= 0) {
            localStorage.setItem('numSchedules', 1);
            localStorage.setItem('defaultSchedule', scheduleName);
            localStorage.setItem('scheduleNames', JSON.stringify([scheduleName]));
            localStorage.setItem(scheduleName, JSON.stringify(eventBoxes));
        } else {
            // update browser stored data
            let numSchedules = parseInt(localStorage.getItem('numSchedules')) + 1;
            let scheduleNames = JSON.parse(localStorage.getItem('scheduleNames'))
            scheduleNames.push(scheduleName);

            localStorage.setItem('numSchedules', numSchedules);
            localStorage.setItem('scheduleNames', JSON.stringify(scheduleNames));
            localStorage.setItem(scheduleName, JSON.stringify(eventBoxes));

        }

        // add schedule to view schedule modal
        updateViewSchedulesList();

        // hide modal
        $('#saveSchedule').modal('toggle');

        // reset form
        this.reset();
    }
})



/* Error handling functions */

function validateAddEventForm() {
    const days = document.querySelectorAll(".btn-selected");
    const startTime = timeToNum(document.getElementById('startTime').value);
    const endTime = timeToNum(document.getElementById('endTime').value);
    const selectedButtons = document.querySelectorAll(".toggle-btn.btn-selected");
    let errorMessage = "";

    if (selectedButtons.length == 0) {
        errorMessage = "Please select at least one day.";
        return errorMessage;
    }

    if (startTime >= endTime) {
        errorMessage = "Invalid times seleted. The End Time MUST be greater than your Start Time.";
        return errorMessage;
    }

    for (let i = 0; i < days.length; i++) {

        let day = days[i].value;

        if (day != 'All') {
            day = dayToNumber[day];

            eventBoxes.forEach((box) => {
                const boxStartTime = timeToNum(box.startTime);
                const boxEndTime = timeToNum(box.endTime);
                // event box parameters
                if (box.day == day && startTime >= boxStartTime && startTime < boxEndTime) {
                    errorMessage = "Overlapping with Existing Event.";
                } else if (box.day == day && endTime > boxStartTime && endTime <= boxEndTime) {
                    errorMessage = "Overlapping with Existing Event.";
                } else if (box.day == day && startTime < boxStartTime && endTime > boxEndTime) {
                    errorMessage = "Overlapping with Existing Event.";
                }

            })
        } else {
            eventBoxes.forEach((box) => {
                const boxStartTime = timeToNum(box.startTime);
                const boxEndTime = timeToNum(box.endTime);
                // event box parameters
                if (startTime >= boxStartTime && startTime < boxEndTime) {
                    errorMessage = "Overlapping with Existing Event.";
                } else if (endTime > boxStartTime && endTime <= boxEndTime) {
                    errorMessage = "Overlapping with Existing Event.";
                } else if (startTime < boxStartTime && endTime > boxEndTime) {
                    errorMessage = "Overlapping with Existing Event.";
                }

            })
        }

    }

    return errorMessage;

}

function validateSaveScheduleForm() {

    let errorMessage = '';
    const scheduleName = document.getElementById('scheduleName').value;
    const unavailableNames = ['defaultSchedule', 'scheduleNames', 'numSchedules'];
    let scheduleNames = localStorage.getItem('scheduleNames');
    const maxScheduleCount = 10;

    if (eventBoxes.length == 0) {
        errorMessage = 'Your schedule is empty.';
    }
    // check if scheduleName exists 
    else if (scheduleNames != null) {
        scheduleNames = JSON.parse(scheduleNames);

        if (parseInt(localStorage.getItem('numSchedules')) >= maxScheduleCount) {
            errorMessage = 'You have reached the max schedule count.'
        } else if (scheduleNames.includes(scheduleName) && !confirm('You already have a schedule with this name. Do you want to overwrite this schedule?')) {
            errorMessage = 'Use a unique schedule name.';
        } else if (unavailableNames.includes(scheduleName)) {
            errorMessage = 'Use a different schedule name, the following name is unavailable.';
        } 
    }


    return errorMessage;
}

/* Helper functions */

// converts time string in form 'XX:XX' to a float b/w 0 and 24 
function timeToNum(time) {
    return (parseInt(time.substring(0, 2)) + parseInt(time.substring(3, 5)) / 60)
}

// Generate start/end time options in 24-hour format for create event form
function generateTimeOptions(minuteInterval) {
    const selectElements = [document.getElementById('startTime'), document.getElementById('endTime')];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += minuteInterval) {
            const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const option = new Option(time, time);
            selectElements.forEach(select => select.add(option.cloneNode(true)));
        }
        if (h == 23) {
            h = 24
            m = 0
            const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const option = new Option(time, time);
            selectElements.forEach(select => select.add(option.cloneNode(true)));
        }
    }
}

// replace current schedule with new schedule
function loadSchedule(scheduleName) {

    // delete eventBoxes
    const table = document.querySelector('#scheduleTable');
    const events = document.querySelectorAll('#scheduleTable div.eventBox');
    events.forEach(event => table.removeChild(event));

    if (scheduleName != null) {
        // update eventBoxes array
        eventBoxes = JSON.parse(localStorage.getItem(scheduleName));

        // add new eventBoxes
        eventBoxes.forEach(event => {
            createEventBox(event.day, event.taskName, event.startTime, event.endTime, event.description, event.eventId);
        })
    }
}

// update schedule modal displaying new default schedule at the top 
function updateViewSchedulesList() {

    // remove all list items
    const scheduleItems = document.querySelectorAll('.item');
    const scheduleList = document.querySelector('.scheduleList');
    scheduleItems.forEach(item => {
        scheduleList.removeChild(item);
    })

    // add updated item list

    let scheduleNames = JSON.parse(localStorage.getItem('scheduleNames'));


    if (scheduleNames != null && scheduleNames.length > 0) {

        const defaultSchedule = localStorage.getItem('defaultSchedule');
        const createListItem = (scheduleName, defaultTrue) => {

            let rowElement = document.createElement('li');
            rowElement.classList.add('item');
            rowElement.setAttribute('data-schedulename', scheduleName);
            rowElement.addEventListener('click', viewScheduleItemSelect);
            // add selection functionality
            let nameElement = document.createElement('div');

            if (defaultTrue) {
                nameElement.innerText = scheduleName + ' (default)';
            } else {
                nameElement.innerText = scheduleName;
            }

            let actionElement = document.createElement('div');

            let deleteBtn = document.createElement('div');
            deleteBtn.classList.add('round-button');
            deleteBtn.setAttribute('data-schedulename', scheduleName);
            deleteBtn.addEventListener('click', viewScheduleDeleteBtn);
            let deleteIcon = document.createElement('img');
            deleteIcon.src = "images/delete.svg";
            deleteIcon.alt = 'delete'
            deleteIcon.classList.add('icon');

            let editBtn = document.createElement('div');
            editBtn.classList.add('round-button');
            editBtn.setAttribute('data-schedulename', scheduleName);
            let editIcon = document.createElement('img');
            editIcon.src = "images/edit.svg";
            editIcon.alt = 'edit'
            editIcon.classList.add('icon');
            // add btn func

            deleteBtn.appendChild(deleteIcon);
            // editBtn.appendChild(editIcon);
            //actionElement.appendChild(editBtn);
            actionElement.appendChild(deleteBtn);
            rowElement.appendChild(nameElement);
            rowElement.appendChild(actionElement);
            scheduleList.appendChild(rowElement);

        }

        // display default schedule at the top of the list
        createListItem(defaultSchedule, true);

        // display rest of schedule
        scheduleNames.sort();
        scheduleNames.forEach(schedule => {
            if (schedule != defaultSchedule) {
                createListItem(schedule, false);
            }
        })
    } else {


    }
}

// viewSchedule list delete btn

function viewScheduleDeleteBtn(event) {

    const scheduleName = event.currentTarget.dataset.schedulename;
    let numSchedules = parseInt(localStorage.getItem('numSchedules')) - 1;
    let scheduleNames = JSON.parse(localStorage.getItem('scheduleNames')).filter(x => x != scheduleName);
    let defaultSchedule = localStorage.getItem('defaultSchedule');

    // stop event bubbling
    event.stopPropagation();

    // remove default schedule if scheduleName is the same

    if (scheduleName == defaultSchedule && numSchedules > 0) {
        // set default as first schedule in alphabetical order
        scheduleNames.sort();
        defaultSchedule = scheduleNames[0];
        localStorage.setItem('defaultSchedule', defaultSchedule);

        // load default again 
        loadSchedule(defaultSchedule);
    } else if (scheduleName == defaultSchedule && numSchedules <= 0) {
        localStorage.removeItem("defaultSchedule");
        defaultSchedule = null

        eventBoxes = [];

        // load default again 
        loadSchedule(defaultSchedule);
    }


    // update data in local storage
    localStorage.setItem('numSchedules', numSchedules);
    localStorage.setItem('scheduleNames', JSON.stringify(scheduleNames));
    localStorage.removeItem(scheduleName);

    // update view schedule list

    updateViewSchedulesList();
}

// viewSchedule list selection

function viewScheduleItemSelect(event) {

    const scheduleName = event.currentTarget.dataset.schedulename;
    // update local data
    localStorage.setItem('defaultSchedule', scheduleName);

    loadSchedule(scheduleName);

    // update view schedule list
    updateViewSchedulesList();

}



initSite();


/**
 * TODO
 * Saving, exporting, importing schedule as a file
 * Clear events from form
 * Edit event btn and delete btn error msgs
**/ 