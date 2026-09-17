const pool = require('../config/db');

// POST /api/marks (teacher/admin) - add or update a mark
exports.upsert = async (req, res) => {
  try {
    const { student_id, subject_id, exam_type, marks_obtained, max_marks } = req.body;
    if (!student_id || !subject_id || !exam_type || marks_obtained === undefined) {
      return res.status(400).json({ success: false, message: 'student_id, subject_id, exam_type and marks_obtained are required.' });
    }
    if (max_marks && Number(marks_obtained) > Number(max_marks)) {
      return res.status(400).json({ success: false, message: 'marks_obtained cannot exceed max_marks.' });
    }

    let enteredBy = null;
    if (req.user.role === 'teacher') {
      const [t] = await pool.query('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
      enteredBy = t[0]?.id || null;
    }

    await pool.query(
      `INSERT INTO marks (student_id, subject_id, exam_type, marks_obtained, max_marks, entered_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained), max_marks = VALUES(max_marks), entered_by = VALUES(entered_by)`,
      [student_id, subject_id, exam_type, marks_obtained, max_marks || 100, enteredBy]
    );

    res.status(201).json({ success: true, message: 'Marks saved successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to save marks.' });
  }
};

// GET /api/marks?student_id=&subject_id=&exam_type=
exports.getAll = async (req, res) => {
  try {
    const { student_id, subject_id, exam_type } = req.query;
    const clauses = [];
    const params = [];
    if (student_id) { clauses.push('m.student_id = ?'); params.push(student_id); }
    if (subject_id) { clauses.push('m.subject_id = ?'); params.push(subject_id); }
    if (exam_type) { clauses.push('m.exam_type = ?'); params.push(exam_type); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT m.*, sub.name AS subject_name, u.name AS student_name, s.roll_number
       FROM marks m
       JOIN subjects sub ON sub.id = m.subject_id
       JOIN students s ON s.id = m.student_id
       JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY m.id DESC`,
      params
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch marks.' });
  }
};

// GET /api/marks/result/:studentId/:examType  -> full result card with total/average/percentage
exports.getResult = async (req, res) => {
  try {
    const { studentId, examType } = req.params;

    const [rows] = await pool.query(
      `SELECT m.marks_obtained, m.max_marks, sub.name AS subject_name, sub.code
       FROM marks m
       JOIN subjects sub ON sub.id = m.subject_id
       WHERE m.student_id = ? AND m.exam_type = ?`,
      [studentId, examType]
    );

    const totalObtained = rows.reduce((sum, r) => sum + Number(r.marks_obtained), 0);
    const totalMax = rows.reduce((sum, r) => sum + Number(r.max_marks), 0);
    const percentage = totalMax ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
    const average = rows.length ? Number((totalObtained / rows.length).toFixed(2)) : 0;

    let grade = 'F';
    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B';
    else if (percentage >= 60) grade = 'C';
    else if (percentage >= 50) grade = 'D';
    else if (percentage >= 35) grade = 'E';

    res.json({
      success: true,
      data: {
        exam_type: examType,
        subjects: rows,
        total_obtained: totalObtained,
        total_max: totalMax,
        average,
        percentage,
        grade,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to generate result.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM marks WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Mark record not found.' });
    res.json({ success: true, message: 'Mark record deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete mark record.' });
  }
};
