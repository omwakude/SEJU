const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer'); 

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); 
app.use(express.static(path.join(__dirname, 'public')));

// Email Transporter Setup 
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: 'your-email@gmail.com', 
        pass: 'your-app-password'     
    }
});

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
    parentEmail: String, 
    photoBase64: String
});
const Student = mongoose.model('Student', StudentSchema);

const AttendanceSchema = new mongoose.Schema({
    date: { type: String, required: true },
    branch: { type: String, required: true }, 
    semester: { type: String, required: true }, 
    subject: { type: String, required: true }, 
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

app.get('/api/attendance/specific', async (req, res) => {
    const { date, branch, semester, subject } = req.query;
    const attendance = await Attendance.findOne({ date, branch, semester, subject });
    res.json(attendance || { records: [] });
});

app.post('/api/attendance', async (req, res) => {
    const { date, branch, semester, subject, records } = req.body;
    const attendance = await Attendance.findOneAndUpdate(
        { date: date, branch: branch, semester: semester, subject: subject }, 
        { records: records }, 
        { new: true, upsert: true } 
    );
    res.json(attendance);
});

app.get('/api/analytics', async (req, res) => {
    const attendances = await Attendance.find().populate('records.studentId');
    res.json(attendances);
});

app.post('/api/notify', async (req, res) => {
    const { absentees, date, subject } = req.body;
    
    try {
        for (let student of absentees) {
            if (student.parentEmail) {
                const mailOptions = {
                    from: 'your-email@gmail.com',
                    to: student.parentEmail,
                    subject: `Attendance Alert: ${student.name} marked Absent`,
                    text: `Dear Parent,\n\nThis is to inform you that your ward, ${student.name} (Roll No: ${student.rollNo}), was marked absent today (${date}) for the subject: ${subject}.\n\nRegards,\nCollege Administration`
                };
                // await transporter.sendMail(mailOptions); 
                console.log(`Mock Email sent to ${student.parentEmail} for ${student.name}`);
            }
        }
        res.json({ success: true, message: 'Emails sent successfully!' });
    } catch (error) {
        console.error("Email Error:", error);
        res.status(500).json({ success: false, error: 'Failed to send emails' });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));