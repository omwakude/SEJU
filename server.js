const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); 
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const dbURI = 'mongodb+srv://startup1technologymanager_db_user:ZfLsGc7zhxXEexCr@startup1.c0eqhmi.mongodb.net/Startup1?retryWrites=true&w=majority&appName=Startup1';
mongoose.connect(dbURI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log('DB Connection Error: ', err));

// Models
const StudentSchema = new mongoose.Schema({
    name: String,
    rollNo: String,
    branch: String,
    semester: Number,
    photoBase64: String
});
const Student = mongoose.model('Student', StudentSchema);

const AttendanceSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true },
    records: [{
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
        status: { type: String, enum: ['Present', 'Absent'] }
    }]
});
const Attendance = mongoose.model('Attendance', AttendanceSchema);

// API Routes
app.post('/api/students', async (req, res) => {
    const student = new Student(req.body);
    await student.save();
    res.json(student);
});

app.get('/api/students', async (req, res) => {
    const students = await Student.find();
    res.json(students);
});

app.put('/api/students/:id', async (req, res) => {
    const updatedStudent = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedStudent);
});

app.delete('/api/students/:id', async (req, res) => {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: 'Student deleted' });
});

app.post('/api/attendance', async (req, res) => {
    const { date, records } = req.body;
    const attendance = await Attendance.findOneAndUpdate(
        { date: date }, { records: records }, { new: true, upsert: true } 
    );
    res.json(attendance);
});

app.get('/api/attendance/:date', async (req, res) => {
    const attendance = await Attendance.findOne({ date: req.params.date });
    res.json(attendance || { records: [] });
});

app.get('/api/analytics', async (req, res) => {
    const attendances = await Attendance.find().populate('records.studentId');
    res.json(attendances);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));