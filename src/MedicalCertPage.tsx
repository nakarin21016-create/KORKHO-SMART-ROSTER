interface MedicalCertPageProps {
  staff?: any[]; // หรือเปลี่ยนเป็น Staff[] ตามประเภทข้อมูลที่มีอยู่
}
import React, { useState } from 'react';

interface PatientData {
  hn: string;
  cid: string;
  patient_name: string;
  age: string;
  address: string;
  vstdate: string;
  symptoms: string;
}

export const MedicalCertPage: React.FC<MedicalCertPageProps> = ({ staff: _staff }) => {
  const [cidInput, setCidInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ข้อมูลเจ้าหน้าที่ / ผู้ตรวจ (แก้ไขปรับเปลี่ยนได้)
  const [docNumber, setDocNumber] = useState('....../..........');
  const [officerName, setOfficerName] = useState('');
  const [officerPosition, setOfficerPosition] = useState('พยาบาลวิชาชีพชำนาญการ');
  const [certDate, setCertDate] = useState(new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }));

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

  const handleFetchData = async () => {
    if (!cidInput || cidInput.length !== 13) {
      setError('กรุณากรอกเลขบัตรประชาชน 13 หลักให้ถูกต้อง');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // เรียกใช้ IP ของเครื่องรัน API Bridge (พอร์ต 3001)
      const res = await fetch(`http://10.120.19.220:3001/api/patient/${cidInput}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'ไม่พบข้อมูล');
      }

      setPatient({
        hn: data.hn || '',
        cid: data.cid || '',
        patient_name: data.patient_name || '',
        age: data.age || '',
        address: data.address || '',
        vstdate: data.vstdate ? new Date(data.vstdate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
        symptoms: data.symptoms || 'ตรวจสุขภาพทั่วไป'
      });
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto font-sans">
      {/* 🛠️ ส่วนฟอร์มกรอกข้อมูล / ค้นหา (ไม่แสดงตอนสั่งพิมพ์) */}
      <div className="print:hidden bg-white p-6 rounded-lg shadow-md mb-8 space-y-4 border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-2">ระบบออกหนังสือรับรอง (รพ.สต.คอโค)</h2>
        
        <div className="flex gap-3 items-center">
          <input
            type="text"
            placeholder="กรอก CID 13 หลักผู้ป่วย"
            value={cidInput}
            onChange={(e) => setCidInput(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={13}
          />
          <button
            onClick={handleFetchData}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? 'กำลังดึงข้อมูล...' : 'ค้นหาข้อมูล HOSxP'}
          </button>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <label className="block text-xs text-gray-500 mb-1">เลขที่หนังสือ (เล่มที่/เลขที่)</label>
            <input
              type="text"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              className="w-full px-3 py-1.5 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ชื่อผู้ตรวจ/ผู้ออกหนังสือ</label>
            <input
              type="text"
              value={officerName}
              placeholder="เช่น นางสาวใจดี มีสุข"
              onChange={(e) => setOfficerName(e.target.value)}
              className="w-full px-3 py-1.5 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ตำแหน่งผู้ตรวจ</label>
            <input
              type="text"
              value={officerPosition}
              onChange={(e) => setOfficerPosition(e.target.value)}
              className="w-full px-3 py-1.5 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">วันที่ออกเอกสาร</label>
            <input
              type="text"
              value={certDate}
              onChange={(e) => setCertDate(e.target.value)}
              className="w-full px-3 py-1.5 border rounded text-sm"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handlePrint}
            className="bg-emerald-600 text-white px-6 py-2 rounded-md hover:bg-emerald-700 transition font-medium flex items-center gap-2"
          >
            🖨️ สั่งพิมพ์หนังสือรับรอง
          </button>
        </div>
      </div>

      {/* 📄 เอกสารหนังสือรับรอง (รูปแบบตรงตามกระดาษต้นแบบ) */}
      <div id="print-area" className="bg-white p-12 text-black leading-relaxed font-sarabun text-[18px]">
        
        {/* ตราครุฑ */}
        <div className="flex justify-center mb-4">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/c/c5/Garuda_Emb_of_Thailand.svg" 
            alt="ตราครุฑ" 
            className="h-28 w-auto object-contain"
          />
        </div>

        {/* หัวเรื่องหนังสือรับรอง */}
        <div className="text-center font-bold text-xl mb-6">
          หนังสือรับรอง
        </div>

        {/* หัวกระดาษฝั่งขวา & เลขที่ฝั่งซ้าย */}
        <div className="flex justify-between items-start mb-8">
          <div className="w-1/2">
            ที่ {docNumber}
          </div>
          <div className="w-1/2 text-left pl-8 leading-tight">
            <p>โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค</p>
            <p>อำเภอเมืองสุรินทร์ จังหวัดสุรินทร์</p>
          </div>
        </div>

        {/* เนื้อหาเอกสาร */}
        <div className="space-y-4 text-justify">
          <div className="flex items-baseline">
            <span className="w-24 text-right pr-2">ข้าพเจ้า</span>
            <span className="flex-1 border-b border-dotted border-black px-2 text-center">{officerName || '...........................................................................'}</span>
            <span className="px-2">ตำแหน่ง</span>
            <span className="flex-1 border-b border-dotted border-black px-2 text-center">{officerPosition}</span>
          </div>

          <p className="leading-loose">
            ประจำโรงพยาบาลส่งเสริมสุขภาพตำบลคอโค อำเภอเมืองสุรินทร์ จังหวัดสุรินทร์ ขอรับรองว่าได้ตรวจรักษา
          </p>

          <div className="flex items-baseline leading-loose">
            <span>ผู้ป่วยชื่อ</span>
            <span className="flex-1 border-b border-dotted border-black px-2 text-center">{patient.patient_name || '............................................................................................................'}</span>
            <span className="px-2">อายุ</span>
            <span className="w-24 border-b border-dotted border-black px-2 text-center">{patient.age || '...........'}</span>
            <span>ปี</span>
          </div>

          <div className="flex items-baseline leading-loose">
            <span>ที่อยู่ {patient.address || 'บ้านเลขที่...........หมู่ที่...........ตำบล..............................อำเภอ..............................จังหวัดสุรินทร์'}</span>
          </div>

          <div className="flex items-baseline leading-loose">
            <span className="whitespace-nowrap">ได้มาตรวจและรับการรักษาด้วยอาการ</span>
            <span className="flex-1 border-b border-dotted border-black px-2 text-center">{patient.symptoms || '....................................................................................................'}</span>
          </div>

          <div className="flex items-baseline leading-loose">
            <span>เมื่อวันที่</span>
            <span className="w-80 border-b border-dotted border-black px-2 text-center">{patient.vstdate || '....................................................'}</span>
          </div>

          <div className="pt-8 text-center leading-loose">
            จึงรับรองไว้เป็นหลักฐาน ให้ไว้ ณ วันที่ {certDate}
          </div>
        </div>

        {/* ส่วนลงชื่อท้ายเอกสาร */}
        <div className="mt-16 flex flex-col items-center pl-32">
          <div className="text-center space-y-4">
            <p>ลงชื่อ ...........................................................................</p>
            <p>( {officerName || '...........................................................................'} )</p>
            <p>ตำแหน่ง {officerPosition}</p>
          </div>
        </div>

      </div>

      {/* CSS สไตล์สำหรับการพิมพ์ (ซ่อนปุ่ม และปรับ Margin หน้ากระดาษ A4) */}
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
            margin: 0 !important;
            box-shadow: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 20mm 20mm 20mm 20mm;
          }
        }
      `}</style>
    </div>
  );
};