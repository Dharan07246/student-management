const pool = require('../config/db');

// POST /api/attendance  (teacher/admin) - mark attendance for one student
// Body: { student_id, subject_id, attendance_date, status }
exports.mark = async (req, res) => {
  try {
    const { student_id, subject_id, attendance_date, status } = req.body;
    if (!student_id || !subject_id || !attendance_date || !status) {
      return res.status(400).json({ success: false, message: 'student_id, subject_id, attendance_date and status are required.' });
    }
    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be "present" or "absent".' });
    }

    let markedBy = null;
    if (req.user.role === 'teacher') {
      const [t] = await pool.query('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
      markedBy = t[0]?.id || null;
    }

    await pool.query(
      `INSERT INTO attendance (student_id, subject_id, attendance_date, status, marked_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by)`,
      [student_id, subject_id, attendance_date, status, markedBy]
    );

    res.status(201).json({ success: true, message: 'Attendance marked successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to mark attendance.' });
  }
};

// POST /api/attendance/bulk  (teacher/admin) - mark a whole class in one call
// Body: { subject_id, attendance_date, records: [{ student_id, status }, ...] }
exports.markBulk = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { subject_id, attendance_date, records } = req.body;
    if (!subject_id || !attendance_date || !Array.isArray(records) || !records.length) {
      return res.status(400).json({ success: false, message: 'subject_id, attendance_date and a non-empty records array are required.' });
    }

    let markedBy = null;
    if (req.user.role === 'teacher') {
      const [t] = await pool.query('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
      markedBy = t[0]?.id || null;
    }

    await conn.beginTransaction();
    for (const rec of records) {
      await conn.query(
        `INSERT INTO attendance (student_id, subject_id, attendance_date, status, marked_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by)`,
        [rec.student_id, subject_id, attendance_date, rec.status, markedBy]
      );
    }
    await conn.commit();

    res.status(201).json({ success: true, message: `Attendance recorded for ${records.length} students.` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to mark bulk attendance.' });
  } finally {
    conn.release();
  }
};

// GET /api/attendance?student_id=&subject_id=&from=&to=
exports.getHistory = async (req, res) => {
  try {
    const { student_id, subject_id, from, to } = req.query;
    const clauses = [];
    const params = [];
    if (student_id) { clauses.push('a.student_id = ?'); params.push(student_id); }
    if (subject_id) { clauses.push('a.subject_id = ?'); params.push(subject_id); }
    if (from) { clauses.push('a.attendance_date >= ?'); params.push(from); }
    if (to) { clauses.push('a.attendance_date <= ?'); params.push(to); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT a.*, sub.name AS subject_name, u.name AS student_name, s.roll_number
       FROM attendance a
       JOIN subjects sub ON sub.id = a.subject_id
       JOIN students s ON s.id = a.student_id
       JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY a.attendance_date DESC`,
      params
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance history.' });
  }
};

// GET /api/attendance/percentage/:studentId  -> overall + per-subject percentage
exports.getPercentage = async (req, res) => {
  try {
    const { studentId } = req.params;

    const [overall] = await pool.query(
      `SELECT
         COUNT(*) AS total_classes,
         SUM(status = 'present') AS present_count
       FROM attendance WHERE student_id = ?`,
      [studentId]
    );

    const [perSubject] = await pool.query(
      `SELECT sub.id AS subject_id, sub.name AS subject_name,
         COUNT(*) AS total_classes,
         SUM(a.status = 'present') AS present_count,
         ROUND(SUM(a.status = 'present') / COUNT(*) * 100, 2) AS percentage
       FROM attendance a
       JOIN subjects sub ON sub.id = a.subject_id
       WHERE a.student_id = ?
       GROUP BY sub.id, sub.name`,
      [studentId]
    );

    const total = overall[0].total_classes || 0;
    const present = overall[0].present_count || 0;
    const overallPercentage = total ? Number(((present / total) * 100).toFixed(2)) : 0;

    res.json({
      success: true,
      data: {
        total_classes: total,
        present_count: present,
        overall_percentage: overallPercentage,
        per_subject: perSubject,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to calculate attendance percentage.' });
  }
};
