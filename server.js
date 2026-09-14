require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt'); // 1. เพิ่มไลบรารีสำหรับเข้ารหัสรหัสผ่าน

const app = express();
const port = process.env.PORT || 3089;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // รองรับรูป base64 ขนาดใหญ่ขึ้น

// MySQL Connection
const pool = mysql.createPool({
  host: process.env.DB_HOST === 'localhost' ? '127.0.0.1' : (process.env.DB_HOST || '127.0.0.1'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+07:00'
});

// Test Connection
(async function testMySQL() {
  try {
    const conn = await pool.getConnection();
    console.log('Connected to MySQL:', process.env.DB_NAME);
    conn.release();
  } catch (err) {
    console.error('MySQL Failed:', err.message);
    process.exit(1);
  }
})();

// ===== Authentication / Login API (ตรวจสอบรหัสผ่านด้วย bcrypt.compare) =====
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'กรุณากรอก Username และ Password' });
    }

    const [rows] = await pool.query(
      'SELECT id, username, password, name, role FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = rows[0];

    // ตรวจสอบรหัสผ่านที่ส่งมาเทียบกับรหัสผ่านที่ถูก Hash ไว้ในฐานข้อมูล
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    return res.json({
      success: true,
      token: `token-${user.id}-${Date.now()}`,
      user: {
        id: user.id,
        username: user.username,
        name: user.name || user.username,
        role: user.role || 'user',
      },
    });
  } catch (err) {
    console.error('Login Database Error:', err.message);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// ===== Register API (เข้ารหัสรหัสผ่านด้วย bcrypt.hash ก่อนบันทึก) =====
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'กรุณากรอก Username และ Password' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username นี้ถูกใช้งานแล้ว' });
    }

    // ทำการเข้ารหัสรหัสผ่านก่อนบันทึกลง MySQL
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const [result] = await pool.query(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, name || username, 'user']
    );

    res.status(201).json({
      success: true,
      message: 'สมัครสมาชิกสำเร็จ!',
      userId: result.insertId,
    });
  } catch (err) {
    console.error('Register Error:', err.message);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// ===== Orders API (ประวัติการสั่งซื้อ) =====
app.get('/api/orders', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders ORDER BY id DESC');
    res.json(rows);
  } catch (e) {
    console.error('Fetch Orders Error:', e.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const {
      username,
      product_name,
      price,
      image_url,
      tracking_no,
      shipping_address,
      recipient_phone,
      shipping_method,
      order_date
    } = req.body;

    if (!product_name || !tracking_no) {
      return res.status(400).json({ error: 'Product name and tracking number are required' });
    }

    const [result] = await pool.query(
      `INSERT INTO orders (username, product_name, price, image_url, tracking_no, shipping_address, recipient_phone, shipping_method, order_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username || 'Guest',
        product_name,
        price || 0,
        image_url || '',
        tracking_no,
        shipping_address || '',
        recipient_phone || '',
        shipping_method || '',
        order_date || ''
      ]
    );

    res.status(201).json({ success: true, orderId: result.insertId });
  } catch (e) {
    console.error('Create Order Error:', e.message);
    res.status(500).json({ error: 'Failed to create order: ' + e.message });
  }
});

// ===== Products API =====
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM inventory ORDER BY id DESC');
    res.json(rows);
  } catch (e) {
    console.error('Products Error:', e.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ===== Add + Edit Product =====
const TABLE = 'inventory';

const ALLOWED_FIELDS = ['name', 'price', 'quantity', 'image_url'];

function isUnknownColumn(err) {
  return err && (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054);
}

function getUnknownColumnName(err) {
  const match = err && err.sqlMessage && err.sqlMessage.match(/Unknown column '(.+?)'/);
  return match ? match[1] : null;
}

function pickFields(body) {
  const fields = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      fields[key] = body[key];
    }
  }
  return fields;
}

async function insertWithFallback(fields) {
  let columns = Object.keys(fields);
  while (columns.length > 0) {
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((c) => fields[c]);
    const sql = `INSERT INTO \`${TABLE}\` (${columns.join(', ')}) VALUES (${placeholders})`;
    try {
      const [result] = await pool.query(sql, values);
      return result;
    } catch (err) {
      const badCol = isUnknownColumn(err) ? getUnknownColumnName(err) : null;
      if (badCol && columns.includes(badCol)) {
        console.warn(`Column "${badCol}" not found in ${TABLE}, skipping it.`);
        columns = columns.filter((c) => c !== badCol);
        continue;
      }
      throw err;
    }
  }
  throw new Error('No valid columns to insert');
}

async function updateWithFallback(id, fields) {
  let columns = Object.keys(fields);
  while (columns.length > 0) {
    const setClause = columns.map((c) => `${c} = ?`).join(', ');
    const values = [...columns.map((c) => fields[c]), id];
    const sql = `UPDATE \`${TABLE}\` SET ${setClause} WHERE id = ?`;
    try {
      const [result] = await pool.query(sql, values);
      return result;
    } catch (err) {
      const badCol = isUnknownColumn(err) ? getUnknownColumnName(err) : null;
      if (badCol && columns.includes(badCol)) {
        console.warn(`Column "${badCol}" not found in ${TABLE}, skipping it.`);
        columns = columns.filter((c) => c !== badCol);
        continue;
      }
      throw err;
    }
  }
  throw new Error('No valid columns to update');
}

app.post('/api/products', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const fields = pickFields(body);

    const parsedPrice = parseFloat(body.price);
    fields.price = !isNaN(parsedPrice) ? parsedPrice : 0.00;

    const parsedQty = parseInt(body.quantity || body.stock, 10);
    fields.quantity = !isNaN(parsedQty) ? parsedQty : 1;

    const result = await insertWithFallback(fields);

    res.status(201).json({ success: true, productId: result.insertId });
  } catch (e) {
    console.error('Add Product Error:', e.message);
    res.status(500).json({ error: 'Failed to add product: ' + (e.message || 'Unknown error') });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    if (!body.name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const fields = pickFields(body);

    if (body.price !== undefined) {
      const parsedPrice = parseFloat(body.price);
      fields.price = !isNaN(parsedPrice) ? parsedPrice : 0.00;
    }

    if (body.quantity !== undefined || body.stock !== undefined) {
      const parsedQty = parseInt(body.quantity || body.stock, 10);
      fields.quantity = !isNaN(parsedQty) ? parsedQty : 1;
    }

    const result = await updateWithFallback(id, fields);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ success: true });
  } catch (e) {
    console.error('Update Product Error:', e.message);
    res.status(500).json({ error: 'Failed to update product: ' + (e.message || 'Unknown error') });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(`DELETE FROM \`${TABLE}\` WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Delete Product Error:', e.message);
    res.status(500).json({ error: 'Failed to delete product: ' + (e.message || 'Unknown error') });
  }
});

app.get('/api', (req, res) => {
  res.send('API is running');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 API running on port ${port}`);
});