import { useState } from 'react'
import { Search, Printer, Loader2, RefreshCw } from 'lucide-react'

export function MedicalCertPage({ staff }: { staff: any[] }) {
  const [cid, setCid] = useState('')
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    certNo: 'รบ.69/' + String(Math.floor(Math.random() * 900) + 100),
    hn: '',
    cid: '',
    patientName: '',
    age: '',
    address: '',
    bps: '',
    bpd: '',
    weight: '',
    height: '',
    pulse: '',
    temperature: '',
    symptoms: 'ตรวจสุขภาพทั่วไป ไม่พบอาการผิดปกติ',
    doctorOpinion: 'จากการตรวจร่างกายเบื้องต้น ผู้รับการตรวจมีสุขภาพร่างกายสมบูรณ์แข็งแรงดี ไม่พบสิ่งผิดปกติที่เป็นอุปสรรคต่อการทำงาน/การเรียน',
    examinerId: staff && staff.length > 0 ? staff[0].id : ''
  })

  // ดึงข้อมูลจาก Node.js API Bridge (port 3001)
  async function fetchFromHosxp() {
    if (!cid || cid.length !== 13) {
      alert('กรุณากรอกเลขบัตรประชาชน (CID) 13 หลักให้ถูกต้อง')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`http://10.120.19.220:3001/api/patient/${cid}`)
      if (!res.ok) throw new Error('ไม่พบข้อมูลผู้ป่วยในระบบ HOSxP')
      
      const data = await res.json()
      setFormData(prev => ({
        ...prev,
        hn: data.hn || '',
        cid: data.cid || cid,
        patientName: data.patient_name || '',
        age: data.age || '',
        address: data.address || '',
        bps: data.bps || '',
        bpd: data.bpd || '',
        weight: data.body_weight || '',
        height: data.height || '',
        pulse: data.pulse || '',
        temperature: data.temperature || '',
        symptoms: data.symptoms || prev.symptoms
      }))
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectedExaminer = staff?.find(s => s.id === formData.examinerId)

  return (
    <div className="page-content" style={{ padding: '20px' }}>
      {/* Header */}
      <div className="page-heading no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7' }}>MEDICAL CERTIFICATE</div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }}>ระบบออกใบรับรองการตรวจ / ใบรับรองสุขภาพ</h1>
          <p style={{ color: '#64748b', margin: 0 }}>โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค อำเภอเมืองสุรินทร์ จังหวัดสุรินทร์</p>
        </div>
        <button onClick={() => window.print()} className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          <Printer size={18} /> พิมพ์ใบรับรอง
        </button>
      </div>

      {/* Form ค้นหา & กรอกข้อมูล */}
      <div className="panel no-print" style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={18} /> ค้นหาข้อมูลผู้ป่วยจาก HOSxP
        </h2>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <input 
            type="text" 
            placeholder="กรอกเลขบัตรประชาชน (CID 13 หลัก)..."
            value={cid}
            onChange={e => setCid(e.target.value)}
            style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
          />
          <button onClick={fetchFromHosxp} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            ดึงข้อมูลจาก HOSxP
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>เลขที่เอกสาร</label>
            <input type="text" value={formData.certNo} onChange={e => setFormData({...formData, certNo: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>HN</label>
            <input type="text" value={formData.hn} onChange={e => setFormData({...formData, hn: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>ชื่อ-นามสกุล</label>
            <input type="text" value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>อายุ (ปี)</label>
            <input type="text" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>ความดัน (BPS/BPD)</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input type="text" placeholder="120" value={formData.bps} onChange={e => setFormData({...formData, bps: e.target.value})} style={{ width: '50%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              /
              <input type="text" placeholder="80" value={formData.bpd} onChange={e => setFormData({...formData, bpd: e.target.value})} style={{ width: '50%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>น้ำหนัก (กก.) / ส่วนสูง (ซม.)</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input type="text" placeholder="กก." value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} style={{ width: '50%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input type="text" placeholder="ซม." value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} style={{ width: '50%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>ผลการตรวจ / ความเห็นผู้ตรวจ</label>
            <textarea rows={2} value={formData.doctorOpinion} onChange={e => setFormData({...formData, doctorOpinion: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>เจ้าหน้าที่ผู้ตรวจ / ผู้ลงนาม</label>
            <select value={formData.examinerId} onChange={e => setFormData({...formData, examinerId: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              {staff?.map(s => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.position})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* พรีวิวใบรับรองสำหรับพิมพ์ */}
      <div className="panel print-area" style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '12px', border: '1px solid #cbd5e1', maxWidth: '800px', margin: '0 auto', fontSize: '15px', lineHeight: '1.8' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 6px 0' }}>ใบรับรองการตรวจสุขภาพ / การตรวจรักษา</h2>
          <p style={{ margin: 0, fontWeight: 'bold' }}>โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค อำเภอเมืองสุรินทร์ จังหวัดสุรินทร์</p>
          <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>เลขที่เอกสาร: {formData.certNo} | HN: {formData.hn || '-'}</p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <p>หนังสือรับรองฉบับนี้ขอรับรองว่า <b>{formData.patientName || '...................................................'}</b> อายุ <b>{formData.age || '......'}</b> ปี </p>
          <p>เลขประจำตัวประชาชน <b>{formData.cid || '...................................................'}</b></p>
          <p>ที่อยู่ <b>{formData.address || '.......................................................................................................................'}</b></p>
          <p>ได้เข้ารับการตรวจร่างกายและตรวจสุขภาพ ณ โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค โดยมีผลการตรวจสัญญาณชีพเบื้องต้น ดังนี้:</p>
        </div>

        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '12px 20px', borderRadius: '8px', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>• ความดันโลหิต: <b>{formData.bps && formData.bpd ? `${formData.bps}/${formData.bpd} mmHg` : '-'}</b></div>
          <div>• น้ำหนัก / ส่วนสูง: <b>{formData.weight ? `${formData.weight} กก.` : '-'} / {formData.height ? `${formData.height} ซม.` : '-'}</b></div>
          <div>• ชีพจร: <b>{formData.pulse ? `${formData.pulse} ครั้ง/นาที` : '-'}</b></div>
          <div>• อุณหภูมิร่างกาย: <b>{formData.temperature ? `${formData.temperature} °C` : '-'}</b></div>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <p><b>ผลการตรวจและความเห็นผู้ตรวจ:</b></p>
          <p style={{ textIndent: '36px' }}>{formData.doctorOpinion}</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '60px', textAlign: 'center' }}>
          <div style={{ width: '280px' }}>
            <p>ลงชื่อ..........................................................ผู้ตรวจ</p>
            <p style={{ margin: '4px 0 0 0', fontWeight: 'bold' }}>({selectedExaminer ? `${selectedExaminer.first_name} ${selectedExaminer.last_name}` : '...................................................'})</p>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#475569' }}>{selectedExaminer?.position || 'ตำแหน่ง..........................................'}</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>วันที่ {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </div>
    </div>
  )
}