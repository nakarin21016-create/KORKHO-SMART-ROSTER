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
        
        {/* 🦅 ตราครุฑลายเส้นทางการขาวดำทรงมาตรฐาน (SVG ในตัว 100% ไม่หลุดแน่นอน) */}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <svg
            width="90"
            height="95"
            viewBox="0 0 400 420"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ margin: '0 auto', display: 'block' }}
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M200 15C198 25 190 35 180 40C170 45 155 40 145 35C150 50 160 60 175 65C160 70 140 65 125 55C135 75 150 85 170 90C150 95 125 90 100 75C115 100 140 115 170 120C130 125 90 115 50 90C75 125 115 145 160 150C110 155 60 140 20 105C45 150 95 180 150 185C110 200 65 200 25 185C65 215 115 225 165 210C135 235 90 250 40 245C85 270 140 270 185 240C165 265 130 290 85 300C125 315 170 305 200 270C230 305 275 315 315 300C270 290 235 265 215 240C260 270 315 270 360 245C310 250 265 235 235 210C285 225 335 215 375 185C335 200 290 200 250 185C305 180 355 150 380 105C340 140 290 155 240 150C285 145 325 125 350 90C310 115 270 125 230 120C260 115 285 100 300 75C275 90 250 95 230 90C250 85 265 75 275 55C260 65 240 70 225 65C240 60 250 50 255 35C245 40 230 45 220 40C210 35 202 25 200 15Z"
              fill="black"
            />
            <path
              d="M175 130C175 115 185 100 200 100C215 100 225 115 225 130C225 155 210 175 200 190C190 175 175 155 175 130Z"
              fill="black"
            />
            <circle cx="200" cy="115" r="8" fill="white" />
            <path
              d="M165 240C180 260 200 330 200 390C200 330 220 260 235 240C215 250 185 250 165 240Z"
              fill="black"
            />
            <path
              d="M140 330L100 380L135 375L120 405L160 385L165 355L140 330Z"
              fill="black"
            />
            <path
              d="M260 330L300 380L265 375L280 405L240 385L235 355L260 330Z"
              fill="black"
            />
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