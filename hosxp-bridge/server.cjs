const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();

// 🔓 อนุญาตให้ทุกเครื่องในเครือข่าย LAN และเว็บ Vercel (HTTPS) เรียกเข้ามาได้ (รองรับ Private Network Access ของ Chrome/Edge)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(cors({ origin: '*' }));
app.use(express.json());

// ⚙️ ตั้งค่าการเชื่อมต่อ HOSxP Server (รพ.สต. คอโค)
const dbConfig = {
  host: '192.168.1.175',
  user: 'sa',
  password: 'sa',
  database: 'hos03100',
  port: 3306,
  charset: 'utf8',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// สร้าง Connection Pool เพื่อรองรับหลาย Request พร้อมกันโดยไม่หลุด
const pool = mysql.createPool(dbConfig);

// เก็บประวัติใบนัดในหน่วยความจำสำรอง (กรณีใน HOSxP ยังไม่ได้สร้างตาราง appointments)
let memoryAppointments = [];

// 🟢 หน้าทดสอบสถานะ Server
app.get('/', (req, res) => {
  res.send('✅ KORKHO SMART OFFICE - HOSxP API Bridge กำลังทำงานปกติ (Port 3001)');
});

// 📌 1. API ค้นหาประวัติผู้ป่วยและสัญญาณชีพล่าสุดจาก CID 13 หลัก
app.get('/api/patient/:cid', async (req, res) => {
  try {
    const { cid } = req.params;

    if (!cid || cid.length !== 13) {
      return res.status(400).json({ message: 'กรุณาระบุเลขบัตรประชาชน (CID) 13 หลักให้ถูกต้อง' });
    }

    const [rows] = await pool.execute(
      `SELECT 
          p.hn, p.cid, p.pname, p.fname, p.lname, 
          TIMESTAMPDIFF(YEAR, p.birthday, CURDATE()) AS age,
          p.informaddr AS address,
          p.informtel, p.hometel,
          o.vstdate, o.vsttime,
          s.bps, s.bpd, s.bw, s.height, s.pulse, s.temperature, s.cc AS symptoms
       FROM patient p
       LEFT JOIN ovst o ON p.hn = o.hn
       LEFT JOIN opdscreen s ON o.vn = s.vn
       WHERE p.cid = ?
       ORDER BY o.vstdate DESC, o.vsttime DESC
       LIMIT 1`,
      [cid]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ป่วยในระบบ HOSxP' });
    }

    const data = rows[0];

    // แปลงวันที่ vstdate ให้อยู่ในรูปแบบ YYYY-MM-DD (เผื่อ MySQL คืนค่าเป็น Date Object)
    let formattedVstDate = '';
    if (data.vstdate) {
      const d = new Date(data.vstdate);
      if (!isNaN(d.getTime())) {
        formattedVstDate = d.toISOString().split('T')[0];
      } else {
        formattedVstDate = String(data.vstdate).split('T')[0];
      }
    }

    res.json({
      hn: data.hn || '',
      cid: data.cid || '',
      patient_name: `${data.pname || ''}${data.fname || ''} ${data.lname || ''}`.trim(),
      age: data.age !== null ? String(data.age) : '',
      address: data.address || '',
      informtel: data.informtel || '',
      hometel: data.hometel || '',
      vstdate: formattedVstDate,
      bps: data.bps !== null ? String(data.bps) : '',
      bpd: data.bpd !== null ? String(data.bpd) : '',
      body_weight: data.bw !== null ? String(data.bw) : '',
      height: data.height !== null ? String(data.height) : '',
      pulse: data.pulse !== null ? String(data.pulse) : '',
      temperature: data.temperature !== null ? String(data.temperature) : '',
      symptoms: data.symptoms || 'ตรวจสุขภาพทั่วไป ไม่พบอาการผิดปกติ'
    });

  } catch (error) {
    console.error('HOSxP Connection Error:', error);
    res.status(500).json({ 
      message: 'ไม่สามารถเชื่อมต่อ HOSxP Database ได้: ' + error.message,
      error: 'ไม่สามารถเชื่อมต่อ HOSxP Database ได้', 
      details: error.message 
    });
  }
});

// 📌 2. API บันทึกประวัติการออกใบนัดหมาย
app.post('/api/appointments', async (req, res) => {
  const record = {
    id: Date.now().toString(),
    ...req.body,
    created_at: new Date().toISOString()
  };

  try {
    await pool.execute(
      `INSERT INTO appointments 
        (hn, cid, patient_name, age, phone, appointment_type_id, appointment_type_name, appointment_date, appointment_time, location, preparation, doctor_or_staff) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.hn || '',
        record.cid || '',
        record.patient_name || '',
        record.age || '',
        record.phone || '',
        record.appointment_type_id || '',
        record.appointment_type_name || '',
        record.appointment_date || null,
        record.appointment_time || '',
        record.location || '',
        record.preparation || '',
        record.doctor_or_staff || ''
      ]
    );
    return res.json({ success: true, source: 'mysql', data: record });
  } catch (err) {
    // หากยังไม่มีตาราง appointments ใน MySQL จะเก็บลง memoryAppointments ชั่วคราวแทนเพื่อไม่ให้หน้าเว็บค้าง
    memoryAppointments.unshift(record);
    return res.json({ success: true, source: 'memory', data: record });
  }
});

// 📌 3. API ดึงรายการนัดหมายตามวันที่ (สำหรับหน้า Tab รายการ/ประวัตินัดหมาย)
app.get('/api/appointments', async (req, res) => {
  const { date } = req.query;
  try {
    const [rows] = date
      ? await pool.execute('SELECT * FROM appointments WHERE appointment_date = ? ORDER BY id DESC', [date])
      : await pool.execute('SELECT * FROM appointments ORDER BY id DESC LIMIT 100');
    return res.json(rows);
  } catch (err) {
    const filtered = date
      ? memoryAppointments.filter(a => a.appointment_date === date)
      : memoryAppointments;
    return res.json(filtered);
  }
});

// 📌 4. API ส่งออกข้อมูลใบนัดหมาย (สำหรับปุ่ม Export CSV ในหน้าตั้งค่าระบบ)
app.get('/api/appointments/export', async (req, res) => {
  const { all, start, end } = req.query;
  try {
    let rows = [];
    if (all === 'true') {
      const [result] = await pool.execute('SELECT * FROM appointments ORDER BY appointment_date DESC');
      rows = result;
    } else if (start && end) {
      const [result] = await pool.execute(
        'SELECT * FROM appointments WHERE appointment_date BETWEEN ? AND ? ORDER BY appointment_date DESC',
        [start, end]
      );
      rows = result;
    }
    return res.json(rows);
  } catch (err) {
    const rows = all === 'true'
      ? memoryAppointments
      : memoryAppointments.filter(a => a.appointment_date >= start && a.appointment_date <= end);
    return res.json(rows);
  }
});

// 🚀 สั่งรัน Server บน Port 3001 และฟังการรับส่งข้อมูลจาก IP 0.0.0.0 (รองรับ LAN)
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`✅ HOSxP API Bridge Running on Port ${PORT}`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`🌐 LAN URL:   http://0.0.0.0:${PORT}`);
  console.log(`====================================================`);
});