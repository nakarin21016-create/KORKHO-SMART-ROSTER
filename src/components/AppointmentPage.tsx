import React, { useState, useEffect } from 'react';

export interface AppointmentType {
  id: string;
  name: string;
  defaultLocation: string;
  defaultPreparation: string;
  isMultiDoseDefault?: boolean;
}

export interface AppointmentSlot {
  label: string;
  date: string;
  time: string;
}

export interface AppointmentRecord {
  id?: string;
  hn: string;
  cid: string;
  patient_name: string;
  age: string;
  phone: string;
  appointment_type_id: string;
  appointment_type_name: string;
  appointment_date: string;
  appointment_time: string;
  location: string;
  preparation: string;
  doctor_or_staff: string;
  created_at?: string;
}

const INITIAL_APPOINTMENT_TYPES: AppointmentType[] = [
  {
    id: 'doctor',
    name: 'ใบนัดพบแพทย์',
    defaultLocation: 'ห้องตรวจโรคทั่วไป รพ.สต.คอโค',
    defaultPreparation: 'นำบัตรประชาชนและยาเดิมที่รับประทานอยู่มาด้วยทุกครั้ง',
    isMultiDoseDefault: false
  },
  {
    id: 'vaccine_dt',
    name: 'ใบนัดฉีดวัคซีน dT (3 เข็ม)',
    defaultLocation: 'ห้องฉีดวัคซีน/ทำแผล รพ.สต.คอโค',
    defaultPreparation: 'นำใบนัดนี้พร้อมบัตรประชาชนมาแสดงทุกครั้งที่มารับวัคซีน',
    isMultiDoseDefault: true
  },
  {
    id: 'vaccine',
    name: 'ใบนัดฉีดวัคซีนทั่วไป',
    defaultLocation: 'ห้องฉีดวัคซีน/ทำแผล รพ.สต.คอโค',
    defaultPreparation: 'นำสมุดบันทึกสุขภาพ/สมุดสีชมพู (กรณีเด็ก) มาด้วยทุกครั้ง',
    isMultiDoseDefault: false
  },
  {
    id: 'followup',
    name: 'ใบนัดติดตามอาการ / ตรวจเจาะเลือด',
    defaultLocation: 'คลินิกโรคเรื้อรัง (NCDs) รพ.สต.คอโค',
    defaultPreparation: 'งดน้ำและอาหารทุกชนิด หลังเวลา 20.00 น. ก่อนวันมารับการตรวจ',
    isMultiDoseDefault: false
  }
];

export const AppointmentPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [cidInput, setCidInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // ประเภทใบนัด (รองรับการเพิ่มใหม่)
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(INITIAL_APPOINTMENT_TYPES);
  const [selectedType, setSelectedType] = useState<string>('doctor');

  // โหมดนัดหลายเข็ม / หลายครั้ง
  const [isMultiDoseMode, setIsMultiDoseMode] = useState<boolean>(false);
  const [vaccineName, setVaccineName] = useState<string>('วัคซีนป้องกันคอตีบ-บาดพยัก (dT)');

  // ฟิลด์สำหรับนัดครั้งเดียว
  const [appDate, setAppDate] = useState('');
  const [appTime, setAppTime] = useState('08:30 - 12:00 น.');

  // ฟิลด์สำหรับนัดหลายเข็ม (3 เข็ม)
  const [appointmentSlots, setAppointmentSlots] = useState<AppointmentSlot[]>([
    { label: 'เข็มที่ 1', date: new Date().toISOString().split('T')[0], time: '08:30 - 12:00 น.' },
    { label: 'เข็มที่ 2 (ห่าง 1 เดือน)', date: '', time: '08:30 - 12:00 น.' },
    { label: 'เข็มที่ 3 (ห่าง 6 เดือน)', date: '', time: '08:30 - 12:00 น.' }
  ]);

  const [location, setLocation] = useState(INITIAL_APPOINTMENT_TYPES[0].defaultLocation);
  const [preparation, setPreparation] = useState(INITIAL_APPOINTMENT_TYPES[0].defaultPreparation);
  const [doctorOrStaff, setDoctorOrStaff] = useState('เจ้าหน้าที่ รพ.สต.คอโค');

  const [patient, setPatient] = useState({
    hn: '',
    cid: '',
    name: '',
    age: '',
    phone: ''
  });

  // Modal เพิ่มประเภทใบนัดใหม่
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeLoc, setNewTypeLoc] = useState('');
  const [newTypePrep, setNewTypePrep] = useState('');
  const [newTypeMulti, setNewTypeMulti] = useState(false);

  // รายการประวัติใบนัดหมาย
  const [appointmentsList, setAppointmentsList] = useState<AppointmentRecord[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // เปลี่ยนประเภทใบนัด
  const handleTypeChange = (typeId: string) => {
    setSelectedType(typeId);
    const found = appointmentTypes.find(t => t.id === typeId);
    if (found) {
      setLocation(found.defaultLocation);
      setPreparation(found.defaultPreparation);
      setIsMultiDoseMode(!!found.isMultiDoseDefault);
    }
  };

  // คำนวณวันนัด dT อัตโนมัติ (0, +1 เดือน, +6 เดือน จากเข็มที่ 1)
  const autoCalculateDtDates = () => {
    const firstDateStr = appointmentSlots[0]?.date;
    if (!firstDateStr) {
      alert('กรุณาระบุวันที่ของ เข็มที่ 1 ก่อนครับ');
      return;
    }
    const baseDate = new Date(firstDateStr);
    
    const dose2 = new Date(baseDate);
    dose2.setMonth(dose2.getMonth() + 1);

    const dose3 = new Date(baseDate);
    dose3.setMonth(dose3.getMonth() + 6);

    setAppointmentSlots([
      { ...appointmentSlots[0], date: firstDateStr },
      { label: 'เข็มที่ 2 (ห่าง 1 เดือน)', date: dose2.toISOString().split('T')[0], time: appointmentSlots[1]?.time || '08:30 - 12:00 น.' },
      { label: 'เข็มที่ 3 (ห่าง 6 เดือน)', date: dose3.toISOString().split('T')[0], time: appointmentSlots[2]?.time || '08:30 - 12:00 น.' }
    ]);
  };

  const handleAddSlot = () => {
    setAppointmentSlots([
      ...appointmentSlots,
      { label: `เข็มที่ ${appointmentSlots.length + 1}`, date: '', time: '08:30 - 12:00 น.' }
    ]);
  };

  const handleRemoveSlot = (index: number) => {
    if (appointmentSlots.length <= 1) return;
    setAppointmentSlots(appointmentSlots.filter((_, i) => i !== index));
  };

  const handleUpdateSlot = (index: number, field: keyof AppointmentSlot, value: string) => {
    const updated = [...appointmentSlots];
    updated[index] = { ...updated[index], [field]: value };
    setAppointmentSlots(updated);
  };

  // ค้นหาผู้ป่วยจาก HOSxP API Bridge
  const handleFetchPatient = async () => {
    if (!cidInput || cidInput.length !== 13) {
      setStatusMessage({ type: 'error', text: 'กรุณากรอก CID 13 หลักให้ถูกต้อง' });
      return;
    }
    setLoading(true);
    setStatusMessage({ type: '', text: '' });

    try {
      const res = await fetch(`http://localhost:3001/api/patient/${cidInput}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'ไม่พบข้อมูลผู้ป่วย');

      setPatient({
        hn: data.hn || '',
        cid: data.cid || '',
        name: data.patient_name || '',
        age: data.age || '',
        phone: data.informtel || data.hometel || ''
      });
      setStatusMessage({ type: 'success', text: `ดึงข้อมูลผู้ป่วยเรียบร้อย: ${data.patient_name}` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล HOSxP' });
    } finally {
      setLoading(false);
    }
  };

  // เพิ่มประเภทใบนัดใหม่
  const handleAddNewType = () => {
    if (!newTypeName.trim()) return;
    const newType: AppointmentType = {
      id: `custom_${Date.now()}`,
      name: newTypeName.trim(),
      defaultLocation: newTypeLoc.trim() || 'รพ.สต.คอโค',
      defaultPreparation: newTypePrep.trim() || 'นำบัตรประชาชนและเอกสารที่เกี่ยวข้องมาด้วยทุกครั้ง',
      isMultiDoseDefault: newTypeMulti
    };
    const updated = [...appointmentTypes, newType];
    setAppointmentTypes(updated);
    setSelectedType(newType.id);
    setLocation(newType.defaultLocation);
    setPreparation(newType.defaultPreparation);
    setIsMultiDoseMode(newTypeMulti);

    setNewTypeName('');
    setNewTypeLoc('');
    setNewTypePrep('');
    setNewTypeMulti(false);
    setShowAddTypeModal(false);
  };

  // 💾 บันทึกใบนัดลงฐานข้อมูล (รองรับทั้งแบบเดี่ยวและแบบหลายเข็ม)
  const handleSaveAndPrint = async () => {
    if (!patient.name) {
      alert('กรุณาระบุชื่อ-สกุลผู้ป่วยให้ครบถ้วน');
      return;
    }

    const currentTypeObj = appointmentTypes.find(t => t.id === selectedType);
    const recordsToSave: AppointmentRecord[] = [];

    if (isMultiDoseMode) {
      const validSlots = appointmentSlots.filter(s => s.date);
      if (validSlots.length === 0) {
        alert('กรุณาระบุวันที่นัดหมายอย่างน้อย 1 เข็ม');
        return;
      }
      validSlots.forEach(slot => {
        recordsToSave.push({
          hn: patient.hn,
          cid: patient.cid,
          patient_name: patient.name,
          age: patient.age,
          phone: patient.phone,
          appointment_type_id: selectedType,
          appointment_type_name: `${currentTypeObj?.name || 'ใบนัดวัคซีน'} (${vaccineName} - ${slot.label})`,
          appointment_date: slot.date,
          appointment_time: slot.time,
          location,
          preparation,
          doctor_or_staff: doctorOrStaff
        });
      });
    } else {
      if (!appDate) {
        alert('กรุณาระบุวันที่นัดหมาย');
        return;
      }
      recordsToSave.push({
        hn: patient.hn,
        cid: patient.cid,
        patient_name: patient.name,
        age: patient.age,
        phone: patient.phone,
        appointment_type_id: selectedType,
        appointment_type_name: currentTypeObj?.name || 'ใบนัดหมาย',
        appointment_date: appDate,
        appointment_time: appTime,
        location,
        preparation,
        doctor_or_staff: doctorOrStaff
      });
    }

    setSaveLoading(true);
    try {
      for (const rec of recordsToSave) {
        await fetch('http://localhost:3001/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rec)
        });
      }
      setStatusMessage({ type: 'success', text: `บันทึกประวัตินัดหมายลงฐานข้อมูลเรียบร้อย (${recordsToSave.length} รายการ)` });
    } catch (err) {
      console.error('Save to DB Error:', err);
    } finally {
      setSaveLoading(false);
      setTimeout(() => {
        window.print();
      }, 300);
    }
  };

  // โหลดรายการนัดหมายตามวันที่สำหรับหน้าตารางนัด
  const fetchAppointmentsByDate = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/appointments?date=${filterDate}`);
      if (res.ok) {
        const data = await res.json();
        setAppointmentsList(data);
      }
    } catch (err) {
      console.error('Fetch appointments error:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'list') {
      fetchAppointmentsByDate();
    }
  }, [activeTab, filterDate]);

  const currentTypeObj = appointmentTypes.find(t => t.id === selectedType);

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '.........................................';
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'Sarabun, sans-serif' }}>
      
      {/* 🛠️ แผงเมนูด้านบน (ซ่อนตอนพิมพ์) */}
      <div className="no-print" style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #edf2f7', paddingBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>
            📅 ระบบออกใบนัดหมายผู้ป่วย (รพ.สต.คอโค)
          </h2>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('create')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                backgroundColor: activeTab === 'create' ? '#2563eb' : '#f1f5f9',
                color: activeTab === 'create' ? '#ffffff' : '#64748b'
              }}
            >
              📝 ออกใบนัดใหม่
            </button>
            <button
              onClick={() => setActiveTab('list')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                backgroundColor: activeTab === 'list' ? '#2563eb' : '#f1f5f9',
                color: activeTab === 'list' ? '#ffffff' : '#64748b'
              }}
            >
              📋 รายการ/ประวัตินัดหมาย
            </button>
          </div>
        </div>

        {/* Tab 1: ออกใบนัดใหม่ */}
        {activeTab === 'create' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                เลือกประเภทใบนัดหมาย
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <select
                  value={selectedType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  style={{ flex: 1, minWidth: '220px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                  {appointmentTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                {/* 🔘 ปุ่มสลับโหมดนัดฉีดวัคซีนหลายเข็ม */}
                <button
                  type="button"
                  onClick={() => setIsMultiDoseMode(!isMultiDoseMode)}
                  style={{
                    backgroundColor: isMultiDoseMode ? '#7c3aed' : '#f1f5f9',
                    color: isMultiDoseMode ? '#ffffff' : '#334155',
                    border: isMultiDoseMode ? 'none' : '1px solid #cbd5e1',
                    padding: '0 14px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  💉 {isMultiDoseMode ? 'โหมดนัดหลายเข็ม (เปิดอยู่)' : 'สลับโหมดนัดหลายเข็ม (dT 3 เข็ม)'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddTypeModal(true)}
                  style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '0 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                >
                  ➕ เพิ่มประเภทใบนัด
                </button>
              </div>
            </div>

            {/* ค้นหา HOSxP */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="กรอก CID 13 หลักผู้ป่วย"
                value={cidInput}
                onChange={(e) => setCidInput(e.target.value)}
                maxLength={13}
                style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
              <button
                onClick={handleFetchPatient}
                disabled={loading}
                style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '0 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {loading ? 'กำลังดึง...' : '🔍 ค้นหา HOSxP'}
              </button>
            </div>

            {statusMessage.text && (
              <div style={{ padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px', backgroundColor: statusMessage.type === 'error' ? '#fef2f2' : '#f0fdf4', color: statusMessage.type === 'error' ? '#dc2626' : '#166534', border: `1px solid ${statusMessage.type === 'error' ? '#fecaca' : '#bbf7d0'}` }}>
                {statusMessage.text}
              </div>
            )}

            {/* ข้อมูลผู้ป่วย */}
            <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ gridTemplateColumns: '3fr 1fr 2fr 2fr', display: 'grid', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b' }}>ชื่อ-สกุล ผู้ป่วย</label>
                  <input type="text" value={patient.name} onChange={(e) => setPatient({ ...patient, name: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b' }}>อายุ (ปี)</label>
                  <input type="text" value={patient.age} onChange={(e) => setPatient({ ...patient, age: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b' }}>HN</label>
                  <input type="text" value={patient.hn} onChange={(e) => setPatient({ ...patient, hn: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b' }}>เบอร์โทรศัพท์</label>
                  <input type="text" value={patient.phone} onChange={(e) => setPatient({ ...patient, phone: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

            {/* รายละเอียดวันนัด: แยกแสดงผลระหว่าง "นัดครั้งเดียว" กับ "นัดหลายเข็ม" */}
            {!isMultiDoseMode ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>วันที่นัดหมาย *</label>
                  <input type="date" value={appDate} onChange={(e) => setAppDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>เวลานัดหมาย</label>
                  <input type="text" value={appTime} onChange={(e) => setAppTime(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
              </div>
            ) : (
              <div style={{ backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', padding: '14px', borderRadius: '8px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#5b21b6' }}>💉 กำหนดการนัดฉีดวัคซีนหลายเข็ม</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={autoCalculateDtDates}
                      style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      ⚡ คำนวณวันนัด dT อัตโนมัติ (0, 1, 6 เดือน)
                    </button>
                    <button
                      type="button"
                      onClick={handleAddSlot}
                      style={{ backgroundColor: '#ffffff', color: '#5b21b6', border: '1px solid #c4b5fd', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      ➕ เพิ่มเข็ม
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '12px', color: '#5b21b6', fontWeight: 'bold' }}>ชื่อวัคซีน / รายการฉีด</label>
                  <input
                    type="text"
                    value={vaccineName}
                    onChange={(e) => setVaccineName(e.target.value)}
                    placeholder="เช่น วัคซีนป้องกันคอตีบ-บาดพยัก (dT)"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #c4b5fd', boxSizing: 'border-box', marginTop: '3px' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {appointmentSlots.map((slot, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr auto', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={slot.label}
                        onChange={(e) => handleUpdateSlot(index, 'label', e.target.value)}
                        placeholder="เช่น เข็มที่ 1"
                        style={{ padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                      <input
                        type="date"
                        value={slot.date}
                        onChange={(e) => handleUpdateSlot(index, 'date', e.target.value)}
                        style={{ padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                      <input
                        type="text"
                        value={slot.time}
                        onChange={(e) => handleUpdateSlot(index, 'time', e.target.value)}
                        style={{ padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                      {appointmentSlots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSlot(index)}
                          style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '7px 10px', cursor: 'pointer', fontWeight: 'bold' }}
                          title="ลบรายการนี้"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>สถานที่รับบริการ</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>การเตรียมตัวก่อนมาตามนัด</label>
              <textarea rows={2} value={preparation} onChange={(e) => setPreparation(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>ผู้นัด / ผู้ลงนาม</label>
              <input type="text" value={doctorOrStaff} onChange={(e) => setDoctorOrStaff(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <div style={{ textAlign: 'right', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <button
                onClick={handleSaveAndPrint}
                disabled={saveLoading}
                style={{ backgroundColor: '#059669', color: '#ffffff', padding: '10px 24px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
              >
                {saveLoading ? 'กำลังบันทึก...' : '💾 บันทึกประวัติ & 🖨️ พิมพ์ใบนัด (A5)'}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: ประวัติใบนัดประจำวัน/รายบุคคล */}
        {activeTab === 'list' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>เลือกวันที่นัด</label>
                <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>ค้นหาชื่อ / CID / HN</label>
                <input type="text" placeholder="พิมพ์ชื่อผู้ป่วย หรือ CID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '10px' }}>ชื่อ-สกุล</th>
                    <th style={{ padding: '10px' }}>HN / CID</th>
                    <th style={{ padding: '10px' }}>ประเภทนัด</th>
                    <th style={{ padding: '10px' }}>เวลานัด</th>
                    <th style={{ padding: '10px' }}>สถานที่</th>
                    <th style={{ padding: '10px' }}>ผู้นัด</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentsList.filter(a => a.patient_name.includes(searchQuery) || a.cid.includes(searchQuery)).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>ไม่พบประวัติใบนัดหมายในวันที่เลือก</td>
                    </tr>
                  ) : (
                    appointmentsList
                      .filter(a => a.patient_name.includes(searchQuery) || a.cid.includes(searchQuery))
                      .map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>{item.patient_name}</td>
                          <td style={{ padding: '10px' }}>{item.hn}<br/><span style={{ fontSize: '11px', color: '#64748b' }}>{item.cid}</span></td>
                          <td style={{ padding: '10px' }}>{item.appointment_type_name}</td>
                          <td style={{ padding: '10px' }}>{item.appointment_time}</td>
                          <td style={{ padding: '10px' }}>{item.location}</td>
                          <td style={{ padding: '10px' }}>{item.doctor_or_staff}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ➕ Modal สำหรับสร้างประเภทใบนัดใหม่ */}
      {showAddTypeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', width: '450px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>➕ เพิ่มประเภทใบนัดหมายใหม่</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>ชื่อประเภทใบนัด</label>
              <input type="text" placeholder="เช่น ใบนัดฉีดวัคซีนพิษสุนัขบ้า" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>สถานที่นัดเริ่มต้น</label>
              <input type="text" placeholder="เช่น ห้องฉีดวัคซีน รพ.สต.คอโค" value={newTypeLoc} onChange={(e) => setNewTypeLoc(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>คำแนะนำการเตรียมตัวเริ่มต้น</label>
              <textarea rows={2} placeholder="เช่น นำใบนัดพร้อมบัตรประชาชนมาด้วย" value={newTypePrep} onChange={(e) => setNewTypePrep(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={newTypeMulti} onChange={(e) => setNewTypeMulti(e.target.checked)} />
                เปิดใช้งานตารางนัดหลายเข็ม/หลายครั้งเป็นค่าเริ่มต้น
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowAddTypeModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', cursor: 'pointer' }}>ยกเลิก</button>
              <button onClick={handleAddNewType} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#ffffff', fontWeight: 'bold', cursor: 'pointer' }}>บันทึกประเภทนัด</button>
            </div>
          </div>
        </div>
      )}

      {/* 📄 เอกสารใบนัดทางการ ขนาด A5 สำหรับสั่งพิมพ์ */}
      <div id="print-area" style={{
        backgroundColor: '#ffffff',
        padding: '22px 28px',
        border: '1px solid #000000',
        fontFamily: "'TH Sarabun PSK', Sarabun, sans-serif",
        fontSize: '18px',
        lineHeight: '1.45',
        boxSizing: 'border-box'
      }}>
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '23px', marginBottom: '2px' }}>
          {currentTypeObj?.name || 'ใบนัดหมายผู้ป่วย'}
        </div>
        <div style={{ textAlign: 'center', fontSize: '16px', marginBottom: '8px' }}>
          โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค อำเภอเมืองสุรินทร์ จังหวัดสุรินทร์
        </div>

        <div style={{ borderTop: '1px solid #000000', margin: '6px 0' }}></div>

        <div>
          <p style={{ margin: '3px 0' }}>
            <strong>ผู้ป่วย:</strong> {patient.name || '......................................................................'} &nbsp;&nbsp;
            <strong>HN:</strong> {patient.hn || '............'} &nbsp;&nbsp;
            <strong>อายุ:</strong> {patient.age || '......'} ปี
          </p>
          {patient.phone && <p style={{ margin: '3px 0' }}><strong>เบอร์โทรศัพท์:</strong> {patient.phone}</p>}

          {/* สลับรูปแบบการพิมพ์ระหว่าง นัดครั้งเดียว vs ตารางนัดหลายเข็ม */}
          {!isMultiDoseMode ? (
            <div style={{ border: '1px solid #000000', padding: '10px 14px', borderRadius: '4px', margin: '8px 0', backgroundColor: '#fafafa' }}>
              <p style={{ margin: '2px 0', fontSize: '19px', fontWeight: 'bold' }}>
                📅 วันที่นัดหมาย: {appDate ? new Date(appDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) : '.........................................................'}
              </p>
              <p style={{ margin: '2px 0' }}><strong>⏰ เวลา:</strong> {appTime}</p>
              <p style={{ margin: '2px 0' }}><strong>📍 สถานที่:</strong> {location}</p>
            </div>
          ) : (
            <div style={{ margin: '8px 0' }}>
              <p style={{ margin: '2px 0 6px 0', fontWeight: 'bold' }}>💉 รายการวัคซีน: {vaccineName}</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px', marginBottom: '6px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left' }}>ครั้งที่ / เข็มที่</th>
                    <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left' }}>วันที่นัดหมาย</th>
                    <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>เวลานัด</th>
                    <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '90px' }}>ผู้ฉีด/บันทึก</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentSlots.map((slot, i) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 'bold' }}>{slot.label}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{formatThaiDate(slot.date)}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{slot.time}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>[ &nbsp; ] ฉีดแล้ว</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ margin: '2px 0' }}><strong>📍 สถานที่รับบริการ:</strong> {location}</p>
            </div>
          )}

          <p style={{ margin: '4px 0' }}><strong>📝 การเตรียมตัว / คำแนะนำ:</strong> {preparation || '-'}</p>
        </div>

        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '14px' }}>
          <div>
            <p style={{ margin: 0 }}>* กรุณานำใบนัดนี้พร้อมบัตรประชาชนมาแสดงทุกครั้งที่มาตามนัด</p>
            <p style={{ margin: 0 }}>* หากไม่สามารถมาตามนัดได้ กรุณาแจ้งล่วงหน้า (รพ.สต.คอโค)</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0 }}>ลงชื่อ .....................................................</p>
            <p style={{ margin: '2px 0 0 0' }}>( {doctorOrStaff} )</p>
          </div>
        </div>
      </div>

      {/* 🖨️ CSS สไตล์กำหนดการพิมพ์ขนาดกระดาษ A5 Portrait */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&family=TH+Sarabun+PSK:wght@400;700&display=swap');

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          body * {
            visibility: hidden !important;
          }

          #print-area, #print-area * {
            visibility: visible !important;
            font-family: 'TH Sarabun PSK', Sarabun, sans-serif !important;
          }

          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 8mm 12mm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }

          .no-print {
            display: none !important;
          }

          @page {
            size: A5 portrait;
            margin: 8mm;
          }
        }
      `}</style>
    </div>
  );
};