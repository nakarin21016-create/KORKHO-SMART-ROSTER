import React, { useState } from 'react';

export interface Staff {
  id?: string | number;
  name?: string;
  fullname?: string;
  prefix?: string;
  pname?: string;
  firstName?: string;
  fname?: string;
  first_name?: string;
  lastName?: string;
  lname?: string;
  last_name?: string;
  position?: string;
  pos_name?: string;
  role?: string;
}

interface PatientData {
  hn: string;
  cid: string;
  patient_name: string;
  age: string;
  address: string;
  vstdate: string;
  symptoms: string;
}

interface MedicalCertPageProps {
  staff?: Staff[];
}

export const MedicalCertPage: React.FC<MedicalCertPageProps> = ({ staff = [] }) => {
  const [cidInput, setCidInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ฟิลด์ข้อมูลใบรับรองและผู้ลงนาม
  const [docNumber, setDocNumber] = useState('....../..........');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [officerName, setOfficerName] = useState('');
  const [officerPosition, setOfficerPosition] = useState('พยาบาลวิชาชีพชำนาญการ');
  const [certDate, setCertDate] = useState(
    new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  );

  // ข้อมูลผู้ป่วย
  const [patient, setPatient] = useState<PatientData>({
    hn: '',
    cid: '',
    patient_name: '',
    age: '',
    address: '',
    vstdate: '',
    symptoms: 'ตรวจสุขภาพทั่วไป'
  });

  // 🛠️ ฟังก์ชันดึงชื่อ-สกุลบุคลากรให้ครอบคลุมทุกโครงสร้างฟิลด์
  const getStaffFullName = (s: Staff) => {
    if (s.name && s.name.trim() !== '') return s.name;
    if (s.fullname && s.fullname.trim() !== '') return s.fullname;
    
    const prefix = s.prefix || s.pname || '';
    const firstName = s.firstName || s.fname || s.first_name || '';
    const lastName = s.lastName || s.lname || s.last_name || '';
    
    const full = `${prefix}${firstName} ${lastName}`.trim();
    return full || 'ไม่ระบุชื่อ';
  };

  // 🖊️ ระบบเลือกผู้ลงนาม
  const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedStaffId(value);

    if (!value) {
      setOfficerName('');
      setOfficerPosition('พยาบาลวิชาชีพชำนาญการ');
      return;
    }

    const found = staff.find((s, index) => String(s.id ?? index) === value);
    if (found) {
      const fullName = getStaffFullName(found);
      setOfficerName(fullName);

      const pos = found.position || found.pos_name || found.role || 'พยาบาลวิชาชีพชำนาญการ';
      setOfficerPosition(pos);
    }
  };

  const handleFetchData = async () => {
    if (!cidInput || cidInput.length !== 13) {
      setError('กรุณากรอกเลขบัตรประชาชน 13 หลักให้ถูกต้อง');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`http://localhost:3001/api/patient/${cidInput}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'ไม่พบข้อมูลผู้ป่วย');
      }

      setPatient({
        hn: data.hn || '',
        cid: data.cid || '',
        patient_name: data.patient_name || '',
        age: data.age || '',
        address: data.address || 'บ้านเลขที่...........หมู่ที่...........ตำบล..............................อำเภอ..............................จังหวัดสุรินทร์',
        vstdate: data.vstdate
          ? new Date(data.vstdate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
          : new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }),
        symptoms: data.symptoms || 'ตรวจสุขภาพทั่วไป'
      });
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ HOSxP');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '20px', fontFamily: 'Sarabun, Tahoma, sans-serif' }}>
      
      {/* 🛠️ แผงควบคุม (ซ่อนเมื่อสั่งพิมพ์) */}
      <div className="no-print" style={{
        backgroundColor: '#ffffff',
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        border: '1px solid #e2e8f0',
        marginBottom: '30px'
      }}>
        <div style={{ borderBottom: '1px solid #edf2f7', paddingBottom: '12px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#1e293b' }}>
            ระบบออกหนังสือรับรอง (รพ.สต.คอโค)
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            ดึงข้อมูล HOSxP &gt; ตรวจสอบ/แก้ไขข้อมูลผู้ป่วยเฉพาะครั้งนี้ &gt; เลือกผู้ลงนามเพื่อพิมพ์
          </p>
        </div>

        {/* 1. ค้นหา CID */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="กรอก CID 13 หลักผู้ป่วย"
            value={cidInput}
            onChange={(e) => setCidInput(e.target.value)}
            maxLength={13}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              backgroundColor: '#f8fafc'
            }}
          />
          <button
            onClick={handleFetchData}
            disabled={loading}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'กำลังดึงข้อมูล...' : '🔍 ค้นหาข้อมูล HOSxP'}
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px', border: '1px solid #fecaca' }}>
            {error}
          </div>
        )}

        {/* 2. ข้อมูลผู้ป่วย */}
        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '10px' }}>
            👤 ข้อมูลผู้ป่วย (ดึงอัตโนมัติ / แก้ไขเฉพาะครั้งนี้ได้)
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 2fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '3px' }}>ชื่อ-สกุล ผู้ป่วย</label>
              <input
                type="text"
                value={patient.patient_name}
                onChange={(e) => setPatient({ ...patient, patient_name: e.target.value })}
                placeholder="ชื่อ-นามสกุลผู้ป่วย"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '3px' }}>อายุ (ปี)</label>
              <input
                type="text"
                value={patient.age}
                onChange={(e) => setPatient({ ...patient, age: e.target.value })}
                placeholder="อายุ"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '3px' }}>วันที่มารับการตรวจ</label>
              <input
                type="text"
                value={patient.vstdate}
                onChange={(e) => setPatient({ ...patient, vstdate: e.target.value })}
                placeholder="ระบุวันที่ตรวจ"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '3px' }}>ที่อยู่ผู้ป่วย (ดึงอัตโนมัติ / ปรับแก้ได้)</label>
            <input
              type="text"
              value={patient.address}
              onChange={(e) => setPatient({ ...patient, address: e.target.value })}
              placeholder="บ้านเลขที่ หมู่ที่ ตำบล อำเภอ จังหวัด"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '3px' }}>🩺 อาการเจ็บป่วย / ความเห็นผู้ตรวจ</label>
            <textarea
              rows={2}
              value={patient.symptoms}
              onChange={(e) => setPatient({ ...patient, symptoms: e.target.value })}
              placeholder="ระบุอาการเจ็บป่วย หรือผลการตรวจ"
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* 3. เลือกผู้ลงนามและตั้งค่าเอกสาร */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
              🖊️ เลือกผู้ตรวจ/ผู้ลงนาม (จากข้อมูลบุคลากร)
            </label>
            <select
              value={selectedStaffId}
              onChange={handleStaffChange}
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: '#ffffff'
              }}
            >
              <option value="">-- กรุณาเลือกผู้ลงนาม --</option>
              {staff.map((s, index) => {
                const idVal = String(s.id ?? index);
                const displayName = getStaffFullName(s);
                const pos = s.position || s.pos_name;
                const posText = pos ? ` (${pos})` : '';
                
                return (
                  <option key={idVal} value={idVal}>
                    {displayName}{posText}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
              เลขที่หนังสือ (เล่มที่/เลขที่)
            </label>
            <input
              type="text"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
              ตำแหน่งผู้ตรวจ
            </label>
            <input
              type="text"
              value={officerPosition}
              onChange={(e) => setOfficerPosition(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
              ชื่อ-สกุล ผู้ลงนาม (แก้ไขเพิ่มเติมได้)
            </label>
            <input
              type="text"
              value={officerName}
              placeholder="ระบุชื่อผู้ตรวจ"
              onChange={(e) => setOfficerName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
              วันที่ออกเอกสาร
            </label>
            <input
              type="text"
              value={certDate}
              onChange={(e) => setCertDate(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #edf2f7', textAlign: 'right' }}>
          <button
            onClick={handlePrint}
            style={{
              backgroundColor: '#059669',
              color: '#ffffff',
              padding: '10px 24px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🖨️ พิมพ์หนังสือรับรอง
          </button>
        </div>
      </div>

      {/* 📄 ตัวเอกสารหนังสือรับรองทางการ A4 */}
      <div id="print-area" style={{
        backgroundColor: '#ffffff',
        padding: '50px 60px',
        color: '#000000',
        lineHeight: '2.2',
        fontSize: '18px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        borderRadius: '6px'
      }}>
        
        {/* 🦅 ตราครุฑพ่าห์ราชการ SVG Vector แท้ฝังในโค้ด (แสดงผล 100% ชัดแจ๋วไม่แตก) */}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <svg
            width="90"
            height="95"
            viewBox="0 0 540 570"
            style={{ display: 'block', margin: '0 auto' }}
          >
            <g fill="#A71930">
              {/* ศิราภรณ์/มงกุฎ */}
              <path d="M270,10 L285,45 L300,90 L270,75 L240,90 L255,45 Z" />
              <path d="M270,70 C280,70 295,85 295,100 C295,115 280,125 270,125 C260,125 245,115 245,100 C245,85 260,70 270,70 Z" />
              
              {/* เศียรพระนารายณ์ทรงครุฑ */}
              <path d="M250,120 Q270,105 290,120 Q305,145 270,155 Q235,145 250,120 Z" />
              <path d="M260,150 L280,150 L275,170 L265,170 Z" />
              
              {/* ปีกซ้ายฉากใหญ่ */}
              <path d="M245,160 Q180,140 100,165 Q40,190 10,230 Q60,235 120,210 Q180,185 235,180 Z" />
              <path d="M235,185 Q170,175 90,205 Q30,230 5,275 Q60,270 120,245 Q175,220 225,205 Z" />
              <path d="M225,210 Q160,205 85,240 Q35,270 15,315 Q65,305 120,280 Q170,255 215,230 Z" />
              <path d="M215,235 Q150,235 85,275 Q40,305 25,350 Q75,335 125,310 Q170,285 205,255 Z" />

              {/* ปีกขวาฉากใหญ่ */}
              <path d="M295,160 Q360,140 440,165 Q500,190 530,230 Q480,235 420,210 Q360,185 305,180 Z" />
              <path d="M305,185 Q370,175 450,205 Q510,230 535,275 Q480,270 420,245 Q365,220 315,205 Z" />
              <path d="M315,210 Q380,205 455,240 Q505,270 525,315 Q475,305 420,280 Q370,255 325,230 Z" />
              <path d="M325,235 Q390,235 455,275 Q500,305 515,350 Q465,335 415,310 Q370,285 335,255 Z" />

              {/* กายและลำตัว */}
              <path d="M240,170 Q270,165 300,170 Q325,220 315,290 Q270,320 225,290 Q215,220 240,170 Z" />
              {/* ทรวดทรงอกและสังวาลย์ */}
              <path d="M270,185 L285,225 L270,265 L255,225 Z" fill="#ffffff" />
              <path d="M270,195 L280,225 L270,255 L260,225 Z" />
              
              {/* เท้าและกระหนกโคนขา */}
              <path d="M230,290 Q200,320 175,365 Q210,380 245,340 Q255,310 240,290 Z" />
              <path d="M310,290 Q340,320 365,365 Q330,380 295,340 Q285,310 300,290 Z" />
              
              {/* กรงเล็บครุฑ */}
              <path d="M175,365 L160,405 L180,400 L195,370 Z" />
              <path d="M365,365 L380,405 L360,400 L345,370 Z" />

              {/* หางพัดช่อกระหนกด้านล่าง */}
              <path d="M270,300 Q240,360 210,450 Q270,430 330,450 Q300,360 270,300 Z" />
              <path d="M270,330 Q245,410 180,510 Q270,480 360,510 Q315,410 270,330 Z" />
              <path d="M270,360 Q250,450 150,560 Q270,520 390,560 Q290,450 270,360 Z" />
            </g>
          </svg>
        </div>

        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '22px', marginBottom: '24px' }}>
          หนังสือรับรอง
        </div>

        {/* เลขที่ & ชื่อสถานที่ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '17px' }}>
          <div style={{ width: '50%' }}>
            ที่ {docNumber}
          </div>
          <div style={{ width: '50%', textAlign: 'left', paddingLeft: '20px', lineHeight: '1.4' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค</p>
            <p style={{ margin: 0 }}>อำเภอเมืองสุรินทร์ จังหวัดสุรินทร์</p>
          </div>
        </div>

        {/* ข้อความเนื้อหา */}
        <div style={{ textAlign: 'justify' }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ minWidth: '70px', textAlign: 'right', paddingRight: '8px' }}>ข้าพเจ้า</span>
            <span style={{ flex: 1, borderBottom: '1px dotted #000', textAlign: 'center', padding: '0 8px' }}>
              {officerName || '...........................................................................'}
            </span>
            <span style={{ padding: '0 8px' }}>ตำแหน่ง</span>
            <span style={{ flex: 1, borderBottom: '1px dotted #000', textAlign: 'center', padding: '0 8px' }}>
              {officerPosition}
            </span>
          </div>

          <p style={{ textIndent: '3em', margin: '8px 0' }}>
            ประจำโรงพยาบาลส่งเสริมสุขภาพตำบลคอโค อำเภอเมืองสุรินทร์ จังหวัดสุรินทร์ ขอรับรองว่าได้ตรวจรักษา
          </p>

          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span>ผู้ป่วยชื่อ</span>
            <span style={{ flex: 1, borderBottom: '1px dotted #000', textAlign: 'center', padding: '0 8px' }}>
              {patient.patient_name || '....................................................................................................'}
            </span>
            <span style={{ padding: '0 8px' }}>อายุ</span>
            <span style={{ width: '80px', borderBottom: '1px dotted #000', textAlign: 'center', padding: '0 8px' }}>
              {patient.age || '...........'}
            </span>
            <span>ปี</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '8px' }}>
            <span>ที่อยู่</span>
            <span style={{ flex: 1, borderBottom: '1px dotted #000', textAlign: 'center', padding: '0 8px' }}>
              {patient.address || 'บ้านเลขที่...........หมู่ที่...........ตำบล..............................อำเภอ..............................จังหวัดสุรินทร์'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '8px' }}>
            <span style={{ whiteSpace: 'nowrap' }}>ได้มาตรวจและรับการรักษาด้วยอาการ</span>
            <span style={{ flex: 1, borderBottom: '1px dotted #000', textAlign: 'center', padding: '0 8px' }}>
              {patient.symptoms || '....................................................................................................'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '8px' }}>
            <span>เมื่อวันที่</span>
            <span style={{ width: '300px', borderBottom: '1px dotted #000', textAlign: 'center', padding: '0 8px' }}>
              {patient.vstdate || '....................................................'}
            </span>
          </div>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            จึงรับรองไว้เป็นหลักฐาน ให้ไว้ ณ วันที่ {certDate}
          </div>
        </div>

        {/* จุดลงนาม */}
        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'flex-end', paddingRight: '40px' }}>
          <div style={{ textAlign: 'center', lineHeight: '2' }}>
            <p style={{ margin: 0 }}>ลงชื่อ ...........................................................................</p>
            <p style={{ margin: 0 }}>( {officerName || '...........................................................................'} )</p>
            <p style={{ margin: 0 }}>ตำแหน่ง {officerPosition}</p>
          </div>
        </div>

      </div>

      {/* 🖨️ สไตล์สำหรับการพิมพ์กระดาษ A4 */}
      <style>{`
        @media print {
          html, body, #root, main, .app-container {
            background: #ffffff !important;
            background-color: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden !important;
          }

          #print-area, #print-area * {
            visibility: visible !important;
          }

          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            min-height: 100vh !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
          }

          .no-print {
            display: none !important;
          }

          @page {
            size: A4 portrait;
            margin: 15mm;
          }
        }
      `}</style>
    </div>
  );
};