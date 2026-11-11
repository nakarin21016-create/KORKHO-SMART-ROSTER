const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();

// 🔓 อนุญาตให้ทุกเครื่องในเครือข่าย LAN ยิง request เข้ามาได้
app.use(cors());
app.use(express.json());

// ⚙️ ตั้งค่าการเชื่อมต่อ HOSxP Server (รพ.สต. คอโค)
const dbConfig = {
  host: '192.168.1.175',
  user: 'sa',
  password: 'sa',
  database: 'hos03100',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// สร้าง Connection Pool เพื่อรองรับหลาย Request พร้อมกันโดยไม่หลุด
const pool = mysql.createPool(dbConfig);

// 📌 API ค้นหาประวัติผู้ป่วยและสัญญาณชีพล่าสุดจาก CID 13 หลัก
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

    res.json({
      hn: data.hn || '',
      cid: data.cid || '',
      patient_name: `${data.pname || ''}${data.fname || ''} ${data.lname || ''}`.trim(),
      age: data.age !== null ? String(data.age) : '',
      address: data.address || '',
      vstdate: data.vstdate || '',
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
      error: 'ไม่สามารถเชื่อมต่อ HOSxP Database ได้', 
      details: error.message 
    });
  }
});

// 🚀 สั่งรัน Server บน Port 3001 และฟังการรับส่งข้อมูลจาก IP 0.0.0.0 (รองรับ LAN)
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`✅ HOSxP API Bridge Running on Port ${PORT}`);
  console.log(`🌐 Ready for LAN requests on http://0.0.0.0:${PORT}`);
  console.log(`====================================================`);
});