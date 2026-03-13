let globalStudentsList = [];
let globalAttendanceData = [];
let overallChartInstance = null;
let currentBase64Photo = '';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('attendanceDate').valueAsDate = new Date();
    fetchData(); // Fetch all data on load
    
    document.getElementById('studentPhoto').addEventListener('change', async (e) => {
        if(e.target.files[0]) currentBase64Photo = await getBase64(e.target.files[0]);
    });

    document.querySelectorAll('a[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', refreshApp);
    });
});

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// -----------------------------------------------------
// 1. DATA FETCHING & STATE MANAGEMENT
// -----------------------------------------------------
async function fetchData() {
    const [studentsRes, analyticsRes] = await Promise.all([
        fetch('/api/students'),
        fetch('/api/analytics') // Gets all historical attendance
    ]);
    globalStudentsList = await studentsRes.json();
    globalAttendanceData = await analyticsRes.json();
    refreshApp();
}

// The "Single Source of Truth" Filter Function
function getFilteredStudents() {
    const branch = document.getElementById('globalBranch').value;
    const sem = document.getElementById('globalSem').value;
    const search = document.getElementById('globalSearch').value.toLowerCase();

    return globalStudentsList.filter(s => {
        const matchBranch = branch === 'ALL' || s.branch === branch;
        const matchSem = sem === 'ALL' || s.semester.toString() === sem;
        const matchSearch = s.name.toLowerCase().includes(search) || s.rollNo.toLowerCase().includes(search);
        return matchBranch && matchSem && matchSearch;
    });
}

// Master function to update all UI components based on state
function refreshApp() {
    const filteredStudents = getFilteredStudents();
    renderAttendanceTable(filteredStudents);
    renderStudentsDirectory(filteredStudents);
    populateAnalyticsDropdown(filteredStudents);
    renderOverallAnalytics(filteredStudents);
}

// -----------------------------------------------------
// 2. UI RENDERING
// -----------------------------------------------------
async function renderAttendanceTable(students) {
    const date = document.getElementById('attendanceDate').value;
    const res = await fetch(`/api/attendance/${date}`);
    const data = await res.json();
    const existingRecords = data.records || [];

    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = '';

    if(students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No students match the current filters.</td></tr>`;
        return;
    }

    students.forEach(student => {
        const record = existingRecords.find(r => r.studentId === student._id);
        const isPresent = record ? (record.status === 'Present') : true;

        tbody.innerHTML += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${student.photoBase64 || 'https://via.placeholder.prompt/50'}" class="student-img me-3">
                        <span class="fw-bold">${student.name}</span>
                    </div>
                </td>
                <td class="fw-medium text-primary">${student.rollNo}</td>
                <td><span class="badge bg-secondary">${student.branch} (Sem ${student.semester})</span></td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="form-check form-switch m-0">
                            <input class="form-check-input attendance-checkbox" type="checkbox" role="switch" 
                                data-id="${student._id}" ${isPresent ? 'checked' : ''} onchange="toggleLabel(this)">
                        </div>
                        <span class="status-text ${isPresent ? 'text-success' : 'text-danger'}">
                            ${isPresent ? 'Present' : 'Absent'}
                        </span>
                    </div>
                </td>
            </tr>
        `;
    });
}

function renderStudentsDirectory(students) {
    const dirBody = document.getElementById('studentDirectoryBody');
    dirBody.innerHTML = '';

    if(students.length === 0) {
        dirBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No students found.</td></tr>`;
        return;
    }

    students.forEach(s => {
        dirBody.innerHTML += `
            <tr>
                <td><img src="${s.photoBase64 || 'https://via.placeholder.prompt/50'}" class="student-img"></td>
                <td><div class="fw-bold">${s.name}</div><div class="text-primary small fw-medium">${s.rollNo}</div></td>
                <td><div class="small">${s.branch}</div><span class="badge bg-light text-dark border">Semester ${s.semester}</span></td>
                <td>
                    <button class="btn btn-sm btn-light border text-primary me-1" onclick="viewStudentStats('${s._id}')" title="View Analytics"><i class="fa-solid fa-chart-simple"></i></button>
                    <button class="btn btn-sm btn-light border text-secondary me-1" onclick="editStudent('${s._id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-light border text-danger" onclick="deleteStudent('${s._id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
    });
}

function toggleLabel(checkbox) {
    const label = checkbox.parentElement.nextElementSibling;
    if (checkbox.checked) {
        label.innerText = 'Present';
        label.className = 'status-text text-success';
    } else {
        label.innerText = 'Absent';
        label.className = 'status-text text-danger';
    }
}

// -----------------------------------------------------
// 3. CRUD OPERATIONS
// -----------------------------------------------------
document.getElementById('studentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editStudentId').value;
    const studentData = {
        name: document.getElementById('studentName').value,
        rollNo: document.getElementById('studentRoll').value,
        branch: document.getElementById('studentBranch').value,
        semester: document.getElementById('studentSem').value,
    };
    if (currentBase64Photo) studentData.photoBase64 = currentBase64Photo;

    const url = id ? `/api/students/${id}` : '/api/students';
    await fetch(url, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentData)
    });

    resetForm();
    fetchData(); // Refresh all data from DB
});

function editStudent(id) {
    const student = globalStudentsList.find(s => s._id === id);
    document.getElementById('editStudentId').value = student._id;
    document.getElementById('studentName').value = student.name;
    document.getElementById('studentRoll').value = student.rollNo;
    document.getElementById('studentBranch').value = student.branch;
    document.getElementById('studentSem').value = student.semester;
    currentBase64Photo = student.photoBase64; 

    document.getElementById('formTitle').innerText = 'Edit Student Profile';
    document.getElementById('submitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Update Profile';
    document.getElementById('cancelEditBtn').classList.remove('d-none');
    
    // Switch to Students tab if not there
    new bootstrap.Tab(document.querySelector('a[href="#studentsTab"]')).show();
}

async function deleteStudent(id) {
    if(confirm("Permanently delete this student and their records?")) {
        await fetch(`/api/students/${id}`, { method: 'DELETE' });
        fetchData();
    }
}

function resetForm() {
    document.getElementById('studentForm').reset();
    document.getElementById('editStudentId').value = '';
    currentBase64Photo = '';
    document.getElementById('formTitle').innerText = 'Enroll New Student';
    document.getElementById('submitBtn').innerHTML = '<i class="fa-solid fa-user-plus me-1"></i> Save Student';
    document.getElementById('cancelEditBtn').classList.add('d-none');
}

async function submitAttendance() {
    const date = document.getElementById('attendanceDate').value;
    const checkboxes = document.querySelectorAll('.attendance-checkbox');
    
    const records = Array.from(checkboxes).map(checkbox => ({
        studentId: checkbox.getAttribute('data-id'),
        status: checkbox.checked ? 'Present' : 'Absent'
    }));

    const res = await fetch(`/api/attendance/${date}`);
    const existingData = await res.json();
    let allRecordsForDay = existingData.records || [];

    records.forEach(newRec => {
        const index = allRecordsForDay.findIndex(r => r.studentId === newRec.studentId);
        if (index > -1) allRecordsForDay[index] = newRec; 
        else allRecordsForDay.push(newRec); 
    });

    await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, records: allRecordsForDay })
    });
    alert(`Attendance for ${date} safely saved!`);
    fetchData(); // Refresh analytics
}

// -----------------------------------------------------
// 4. ANALYTICS & EXPORT
// -----------------------------------------------------
function renderOverallAnalytics(filteredStudents) {
    let p = 0, a = 0;
    const studentIds = filteredStudents.map(s => s._id);

    // Calculate totals ONLY for students currently visible in the filter
    globalAttendanceData.forEach(day => {
        day.records.forEach(rec => {
            if(rec.studentId && studentIds.includes(rec.studentId._id)) {
                if(rec.status === 'Present') p++;
                else a++;
            }
        });
    });
    
    document.getElementById('classStatsText').innerText = `Total Records Analysed: ${p + a}`;

    const ctx = document.getElementById('overallChart').getContext('2d');
    if (overallChartInstance) overallChartInstance.destroy();
    overallChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Present', 'Absent'],
            datasets: [{ data: [p, a], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function populateAnalyticsDropdown(filteredStudents) {
    const select = document.getElementById('studentSelect');
    const currentValue = select.value; // Remember selection
    select.innerHTML = '<option value="">-- Search / Select Student --</option>';
    
    filteredStudents.forEach(s => {
        select.innerHTML += `<option value="${s._id}">${s.rollNo} - ${s.name}</option>`;
    });
    select.value = currentValue; // Restore if still in filtered list
}

// Triggered from Roster table directly
function viewStudentStats(id) {
    new bootstrap.Tab(document.querySelector('a[href="#analyticsTab"]')).show();
    document.getElementById('studentSelect').value = id;
    renderIndividualAnalytics();
}

function renderIndividualAnalytics() {
    const studentId = document.getElementById('studentSelect').value;
    const placeholder = document.getElementById('placeholderText');
    const statsContainer = document.getElementById('individualStats');

    if (!studentId) {
        placeholder.style.display = 'block';
        statsContainer.style.display = 'none';
        return;
    }

    placeholder.style.display = 'none';
    statsContainer.style.display = 'block';

    const student = globalStudentsList.find(s => s._id === studentId);
    document.getElementById('statImg').src = student.photoBase64 || 'https://via.placeholder.prompt/150';
    document.getElementById('statName').innerText = student.name;
    document.getElementById('statRoll').innerText = `${student.rollNo} | ${student.branch} (Sem ${student.semester})`;

    let p = 0, a = 0, total = 0;
    globalAttendanceData.forEach(day => {
        const record = day.records.find(r => r.studentId && r.studentId._id === studentId);
        if (record) {
            total++;
            if (record.status === 'Present') p++;
            else a++;
        }
    });

    const percentage = total === 0 ? 0 : Math.round((p / total) * 100);
    document.getElementById('statP').innerText = p;
    document.getElementById('statA').innerText = a;
    document.getElementById('statPerc').innerText = percentage + '%';
}

function exportCSV() {
    const date = document.getElementById('attendanceDate').value;
    const tbody = document.getElementById('attendanceTableBody');
    const rows = tbody.querySelectorAll('tr');
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `Date:,${date}\n\n`;
    csvContent += "Roll No,Name,Branch & Sem,Status\n";

    rows.forEach(row => {
        if(row.cells.length < 4) return; // Skip "No students" message
        const roll = row.cells[1].innerText;
        const name = row.cells[0].innerText;
        const branch = row.cells[2].innerText;
        const statusText = row.querySelector('.status-text').innerText;
        
        // Escape commas in strings
        csvContent += `"${roll}","${name}","${branch}","${statusText}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}