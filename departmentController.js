const pool = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT d.*,
        (SELECT COUNT(*) FROM students WHERE department_id = d.id) AS student_count,
        (SELECT COUNT(*) FROM teachers WHERE department_id = d.id) AS teacher_count,
        (SELECT COUNT(*) FROM courses WHERE department_id = d.id) AS course_count
      FROM departments d ORDER BY d.id
    `);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch departments.' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM departments WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Department not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch department.' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required.' });

    const [result] = await pool.query('INSERT INTO departments (name, description) VALUES (?, ?)', [name, description || null]);
    res.status(201).json({ success: true, message: 'Department created successfully.', data: { id: result.insertId } });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Department name already exists.' });
    res.status(500).json({ success: false, message: 'Failed to create department.' });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, description } = req.body;
    const [result] = await pool.query(
      'UPDATE departments SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?',
      [name, description, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Department not found.' });
    res.json({ success: true, message: 'Department updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update department.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Department not found.' });
    res.json({ success: true, message: 'Department deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete department (it may still have courses, teachers or students attached).' });
  }
};
