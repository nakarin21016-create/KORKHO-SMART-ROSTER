# KORKHO SMART ROSTER

ระบบบริหารจัดการตารางเวรและค่าตอบแทน โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค จังหวัดสุรินทร์

## สถานะของชุดเริ่มต้น
ชุดนี้เป็น Phase 1 + ฐานระบบ Phase 2/3:
- โครงสร้าง React + TypeScript + Vite
- หน้า Login เชื่อม Supabase Auth
- Dashboard เบื้องต้น
- ทะเบียนบุคลากร: เพิ่ม/แก้ไข/ระงับ และค้นหา
- SQL schema สำหรับตารางหลักและ Row Level Security

โมดูลตารางเวร การคำนวณใบเบิก เอกสารราชการ และ Export ยังต้องพัฒนาต่อเป็นระยะตาม Master Prompt

## เริ่มต้นอย่างย่อ
1. ติดตั้ง Node.js LTS
2. แตก ZIP
3. เปิดโฟลเดอร์นี้ใน VS Code
4. เปิด Terminal แล้วรัน `npm install`
5. สร้าง Supabase project และรัน `supabase/schema.sql`
6. คัดลอก `.env.example` เป็น `.env` แล้วกรอก Supabase URL และ Publishable/Anon key
7. รัน `npm run dev`
8. เปิด URL ที่ Terminal แสดง เช่น http://localhost:5173

อ่านคู่มือ `SETUP-TH.md` ก่อนติดตั้งจริง
