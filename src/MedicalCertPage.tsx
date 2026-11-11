import React, { useState } from 'react';

// 1. ปรับปรุง Interface Staff ให้ทุกฟิลด์เป็น Optional เพื่อแก้ปัญหา Type Error จาก App.tsx
export interface Staff {
  id?: string | number;
  name?: string;
  position?: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: any; // รองรับฟิลด์เพิ่มเติมอื่นๆ
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

  // ฟิลด์ข้อมูลใบรับรอง
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
    symptoms: ''
  });

  // เมื่อเลือกผู้ลงนามใน Dropdown ให้ auto-fill ชื่อและตำแหน่ง
  const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedStaffId(value);

    const found = staff.find((s, index) => String(s.id ?? index) === value);
    if (found) {
      const fullName = found.name || `${found.prefix || ''}${found.firstName || ''} ${found.lastName || ''}`.trim();
      setOfficerName(fullName);
      setOfficerPosition(found.position || 'พยาบาลวิชาชีพชำนาญการ');
    } else {
      setOfficerName('');
      setOfficerPosition('พยาบาลวิชาชีพชำนาญการ');
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
      const res = await fetch(`http://10.120.19.220:3001/api/patient/${cidInput}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'ไม่พบข้อมูลผู้ป่วย');
      }

      setPatient({
        hn: data.hn || '',
        cid: data.cid || '',
        patient_name: data.patient_name || '',
        age: data.age || '',
        address: data.address || '',
        vstdate: data.vstdate
          ? new Date(data.vstdate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
          : '',
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
    <div className="p-4 md:p-8 max-w-4xl mx-auto font-sans">
      {/* 🛠️ แผงควบคุมและค้นหาข้อมูล (ซ่อนเมื่อกดพิมพ์) */}
      <div className="print:hidden bg-white p-6 rounded-xl shadow-lg border border-slate-200 mb-8 space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-xl font-bold text-slate-800">ระบบออกหนังสือรับรอง (รพ.สต.คอโค)</h2>
          <p className="text-xs text-slate-500 mt-1">ค้นหาข้อมูลผู้ป่วยจาก HOSxP และเลือกผู้ลงนามเพื่อพิมพ์เอกสาร</p>
        </div>

        {/* ค้นหา CID */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="กรอก CID 13 หลักผู้ป่วย"
            value={cidInput}
            onChange={(e) => setCidInput(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            maxLength={13}
          />
          <button
            onClick={handleFetchData}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition shadow-sm"
          >
            {loading ? 'กำลังดึงข้อมูล...' : '🔍 ค้นหาข้อมูล HOSxP'}
          </button>
        </div>

        {error && <p className="text-red-500 text-xs bg-red-50 p-2.5 rounded-md border border-red-200">{error}</p>}

        {/* ฟอร์มเลือกผู้ลงนามและตั้งค่าเอกสาร */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Dropdown เลือกบุคลากร */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              👤 เลือกผู้ตรวจ/ผู้ลงนาม (จากข้อมูลบุคลากร)
            </label>
            <select
              value={selectedStaffId}
              onChange={handleStaffChange}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- กรุณาเลือกผู้ลงนาม --</option>
              {staff.map((s, index) => {
                const idVal = String(s.id ?? index);
                const displayName = s.name || `${s.prefix || ''}${s.firstName || ''} ${s.lastName || ''}`.trim();
                return (
                  <option key={idVal} value={idVal}>
                    {displayName} ({s.position || 'พนักงาน'})
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">เลขที่หนังสือ (เล่มที่/เลขที่)</label>
            <input
              type="text"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">ตำแหน่งผู้ตรวจ</label>
            <input
              type="text"
              value={officerPosition}
              onChange={(e) => setOfficerPosition(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อ-สกุล ผู้ลงนาม (แก้ไขเพิ่มเติมได้)</label>
            <input
              type="text"
              value={officerName}
              placeholder="ระบุชื่อผู้ตรวจ"
              onChange={(e) => setOfficerName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่ออกเอกสาร</label>
            <input
              type="text"
              value={certDate}
              onChange={(e) => setCertDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={handlePrint}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 active:bg-emerald-800 transition shadow-md flex items-center gap-2"
          >
            🖨️ พิมพ์หนังสือรับรอง
          </button>
        </div>
      </div>

      {/* 📄 เอกสารหนังสือรับรอง (แสดงผลตามแบบฟอร์มทางราชการ) */}
      <div id="print-area" className="bg-white p-10 md:p-14 text-slate-900 leading-relaxed font-serif text-[17px] shadow-sm rounded-md">
        
        {/* ตราครุฑ SVG (ไม่พึ่งพารูปภาพภายนอก หมดปัญหาภาพไม่ขึ้น) */}
        <div className="flex justify-center mb-3">
          <svg className="w-24 h-24" viewBox="0 0 200 200" fill="currentColor">
            <path d="M100 15c-3 0-6 2-7 5l-4 12c-8-2-16-1-23 2l-10-8-5 5 5 11c-6 5-10 12-11 20l-12-1-2 7 11 5c-2 8 0 16 4 23l-11 8 4 6 12-4c3 7 9 13 16 16l-6 11 6 4 9-9c8 4 17 5 26 3l1 13 7 1-1-14c9 1 18 0 26-3l9 9 6-4-6-11c7-3 13-9 16-16l12 4 4-6-11-8c4-7 6-15 4-23l11-5-2-7-12 1c-1-8-5-15-11-20l5-11-5-5-10 8c-7-3-15-4-23-2l-4-12c-1-3-4-5-7-5zm0 25c14 0 25 11 25 25s-11 25-25 25-25-11-25-25 11-25 25-25z"/>
          </svg>
        </div>

        <div className="text-center font-bold text-xl mb-6 tracking-wide">
          หนังสือรับรอง
        </div>

        {/* ที่ / สถานที่ */}
        <div className="flex justify-between items-start mb-8 text-[16px]">
          <div className="w-1/2 pt-1">
            ที่ {docNumber}
          </div>
          <div className="w-1/2 text-left pl-6 leading-normal">
            <p className="font-semibold">โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค</p>
            <p>อำเภอเมืองสุรินทร์ จังหวัดสุรินทร์</p>
          </div>
        </div>

        {/* เนื้อหาข้อความ */}
        <div className="space-y-3.5 text-justify leading-loose">
          <div className="flex items-baseline">
            <span className="w-20 text-right pr-2">ข้าพเจ้า</span>
            <span className="flex-1 border-b border-dotted border-slate-700 px-2 text-center font-medium">{officerName || '...........................................................................'}</span>
            <span className="px-2">ตำแหน่ง</span>
            <span className="flex-1 border-b border-dotted border-slate-700 px-2 text-center font-medium">{officerPosition}</span>
          </div>

          <p className="indent-12">
            ประจำโรงพยาบาลส่งเสริมสุขภาพตำบลคอโค อำเภอเมืองสุรินทร์ จังหวัดสุรินทร์ ขอรับรองว่าได้ตรวจรักษา
          </p>

          <div className="flex items-baseline">
            <span>ผู้ป่วยชื่อ</span>
            <span className="flex-1 border-b border-dotted border-slate-700 px-2 text-center font-medium">{patient.patient_name || '....................................................................................................'}</span>
            <span className="px-2">อายุ</span>
            <span className="w-20 border-b border-dotted border-slate-700 px-2 text-center font-medium">{patient.age || '...........'}</span>
            <span>ปี</span>
          </div>

          <div className="flex items-baseline">
            <span>ที่อยู่</span>
            <span className="flex-1 border-b border-dotted border-slate-700 px-2 text-center font-medium">
              {patient.address || 'บ้านเลขที่...........หมู่ที่...........ตำบล..............................อำเภอ..............................จังหวัดสุรินทร์'}
            </span>
          </div>

          <div className="flex items-baseline">
            <span className="whitespace-nowrap">ได้มาตรวจและรับการรักษาด้วยอาการ</span>
            <span className="flex-1 border-b border-dotted border-slate-700 px-2 text-center font-medium">{patient.symptoms || '....................................................................................................'}</span>
          </div>

          <div className="flex items-baseline">
            <span>เมื่อวันที่</span>
            <span className="w-72 border-b border-dotted border-slate-700 px-2 text-center font-medium">{patient.vstdate || '....................................................'}</span>
          </div>

          <div className="pt-6 text-center">
            จึงรับรองไว้เป็นหลักฐาน ให้ไว้ ณ วันที่ {certDate}
          </div>
        </div>

        {/* จุดลงชื่อ */}
        <div className="mt-14 flex justify-end pr-10">
          <div className="text-center space-y-3 min-w-[260px]">
            <p>ลงชื่อ ...........................................................................</p>
            <p>( {officerName || '...........................................................................'} )</p>
            <p>ตำแหน่ง {officerPosition}</p>
          </div>
        </div>

      </div>

      {/* สไตล์การพิมพ์ A4 */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          #print-area {
            padding: 0 !important;
            box-shadow: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 20mm 15mm 20mm 15mm;
          }
        }
      `}</style>
    </div>
  );
};