/**
 * Seed script - populates demo login accounts and sample data.
 * Run AFTER creating the schema (database/schema.sql):
 *
 *   cd backend
 *   npm install
 *   npm run seed
 *
 * Safe to re-run: it clears the previously-seeded rows first.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

const DEMO_PASSWORD = 'Password123!';

async function seed() {
  const conn = await pool.getConnection();
  try {
    console.log('Seeding demo data...');

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    // Clean out any previous seed run (order matters due to FKs)
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('DELETE FROM marks');
    await conn.query('DELETE FROM attendance');
    await conn.query('DELETE FROM subjects');
    await conn.query('DELETE FROM students');
    await conn.query('DELETE FROM teachers');
    await conn.query('DELETE FROM users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // --- Users ---------------------------------------------------------
    const [adminRes] = await conn.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['System Admin', 'admin@sms.edu', passwordHash, 'admin']
    );
    const [teacherUserRes] = await conn.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Dr. Alan Turing', 'teacher@sms.edu', passwordHash, 'teacher']
    );
    const [studentUserRes] = await conn.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Ada Lovelace', 'student@sms.edu', passwordHash, 'student']
    );

    // --- Teacher profile -------------------------------------------------
    const [teacherRes] = await conn.query(
      `INSERT INTO teachers (user_id, employee_code, phone, department_id, qualification, joined_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [teacherUserRes.insertId, 'EMP001', '9990001111', 1, 'Ph.D. Computer Science', '2020-06-01']
    );

    // --- Student profile -------------------------------------------------
    const [studentRes] = await conn.query(
      `INSERT INTO students (user_id, roll_number, phone, address, date_of_birth, gender, department_id, course_id, year_of_study, admission_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentUserRes.insertId, 'CS2023001', '9990002222', '12 Baker Street, Springfield', '2004-05-12', 'female', 1, 1, 2, '2023-07-15']
    );

    // --- Subjects ----------------------------------------------------------
    const subjectNames = [
      ['Data Structures', 'CS201'],
      ['Database Management Systems', 'CS202'],
      ['Operating Systems', 'CS203'],
    ];
    const subjectIds = [];
    for (const [name, code] of subjectNames) {
      const [res] = await conn.query(
        'INSERT INTO subjects (name, code, course_id, teacher_id, max_marks) VALUES (?, ?, ?, ?, ?)',
        [name, code, 1, teacherRes.insertId, 100]
      );
      subjectIds.push(res.insertId);
    }

    // --- Attendance ----------------------------------------------------------
    const attendanceRows = [
      [subjectIds[0], '2026-09-01', 'present'],
      [subjectIds[0], '2026-09-02', 'present'],
      [subjectIds[0], '2026-09-03', 'absent'],
      [subjectIds[1], '2026-09-01', 'present'],
      [subjectIds[1], '2026-09-02', 'absent'],
    ];
    for (const [subjectId, date, status] of attendanceRows) {
      await conn.query(
        'INSERT INTO attendance (student_id, subject_id, attendance_date, status, marked_by) VALUES (?, ?, ?, ?, ?)',
        [studentRes.insertId, subjectId, date, status, teacherRes.insertId]
      );
    }

    // --- Marks ----------------------------------------------------------
    const markRows = [
      [subjectIds[0], 78],
      [subjectIds[1], 85],
      [subjectIds[2], 69],
    ];
    for (const [subjectId, score] of markRows) {
      await conn.query(
        'INSERT INTO marks (student_id, subject_id, exam_type, marks_obtained, max_marks, entered_by) VALUES (?, ?, ?, ?, ?, ?)',
        [studentRes.insertId, subjectId, 'midterm', score, 100, teacherRes.insertId]
      );
    }

    console.log('Seed complete!');
    console.log('---------------------------------------------');
    console.log('Demo login credentials (password for all):', DEMO_PASSWORD);
    console.log('  Admin:   admin@sms.edu');
    console.log('  Teacher: teacher@sms.edu');
    console.log('  Student: student@sms.edu');
    console.log('---------------------------------------------');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    conn.release();
    await pool.end();
  }
}

seed();
