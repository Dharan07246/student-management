const pool = require('../config/db');

const SUBJECT_SELECT = `
  SELECT s.*, c.name AS course_name, u.name AS teacher_name
  FROM subjects s
  LEFT JOIN courses c ON c.id = s.course_id
  LEFT JOIN teachers t ON t.id = s.teacher_id
  LEFT JOIN users u ON u.id = t.user_id
`;

exports.getAll = async (req, res) => {
  try {
    const { course_id, teacher_id } = req.query;
    const clauses = [];
    const params = [];
    if (course_id) { clauses.push('s.course_id = ?'); params.push(course_id); }
    if (teacher_id) { clauses.push('s.teacher_id = ?'); params.push(teacher_id); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await pool.query(`${SUBJECT_SELECT} ${where} ORDER BY s.id`, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch subjects.' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await pool.query(`${SUBJECT_SELECT} WHERE s.id = ?`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Subject not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch subject.' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, code, course_id, teacher_id, max_marks } = req.body;
    if (!name || !code || !course_id) {
      return res.status(400).json({ success: false, message: 'name, code and course_id are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO subjects (name, code, course_id, teacher_id, max_marks) VALUES (?, ?, ?, ?, ?)',
      [name, code, course_id, teacher_id || null, max_marks || 100]
    );
    res.status(201).json({ success: true, message: 'Subject created successfully.', data: { id: result.insertId } });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Subject code already exists.' });
    res.status(500).json({ success: false, message: 'Failed to create subject.' });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, code, course_id, teacher_id, max_marks } = req.body;
    const [result] = await pool.query(
      `UPDATE subjects SET
        name = COALESCE(?, name), code = COALESCE(?, code),
        course_id = COALESCE(?, course_id), teacher_id = COALESCE(?, teacher_id),
        max_marks = COALESCE(?, max_marks)
       WHERE id = ?`,
      [name, code, course_id, teacher_id, max_marks, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Subject not found.' });
    res.json({ success: true, message: 'Subject updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update subject.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM subjects WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Subject not found.' });
    res.json({ success: true, message: 'Subject deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete subject.' });
  }
};
