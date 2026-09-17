const pool = require('../config/db');

const COURSE_SELECT = `
  SELECT c.*, d.name AS department_name,
    (SELECT COUNT(*) FROM students WHERE course_id = c.id) AS student_count
  FROM courses c
  LEFT JOIN departments d ON d.id = c.department_id
`;

exports.getAll = async (req, res) => {
  try {
    const { department_id } = req.query;
    const clauses = [];
    const params = [];
    if (department_id) { clauses.push('c.department_id = ?'); params.push(department_id); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await pool.query(`${COURSE_SELECT} ${where} ORDER BY c.id`, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch courses.' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await pool.query(`${COURSE_SELECT} WHERE c.id = ?`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Course not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch course.' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, code, department_id, duration_years } = req.body;
    if (!name || !code || !department_id) {
      return res.status(400).json({ success: false, message: 'name, code and department_id are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO courses (name, code, department_id, duration_years) VALUES (?, ?, ?, ?)',
      [name, code, department_id, duration_years || 4]
    );
    res.status(201).json({ success: true, message: 'Course created successfully.', data: { id: result.insertId } });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Course code already exists.' });
    res.status(500).json({ success: false, message: 'Failed to create course.' });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, code, department_id, duration_years } = req.body;
    const [result] = await pool.query(
      `UPDATE courses SET
        name = COALESCE(?, name), code = COALESCE(?, code),
        department_id = COALESCE(?, department_id), duration_years = COALESCE(?, duration_years)
       WHERE id = ?`,
      [name, code, department_id, duration_years, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Course not found.' });
    res.json({ success: true, message: 'Course updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update course.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM courses WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Course not found.' });
    res.json({ success: true, message: 'Course deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete course (it may still have students or subjects attached).' });
  }
};

// PUT /api/courses/:id/assign-student - assign a student to this course
exports.assignStudent = async (req, res) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ success: false, message: 'student_id is required.' });

    const course = await pool.query('SELECT department_id FROM courses WHERE id = ?', [req.params.id]);
    if (!course[0][0]) return res.status(404).json({ success: false, message: 'Course not found.' });

    await pool.query(
      'UPDATE students SET course_id = ?, department_id = ? WHERE id = ?',
      [req.params.id, course[0][0].department_id, student_id]
    );
    res.json({ success: true, message: 'Student assigned to course successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to assign student.' });
  }
};
