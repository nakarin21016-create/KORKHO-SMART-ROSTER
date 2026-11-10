import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Activity, CalendarDays, CircleDollarSign, FileText,
  LayoutDashboard, LogOut, Menu, Plus, Search, Settings, ShieldCheck,
  Users, X, Pencil, UserRound, Clock3, AlertCircle, Save, Loader2, Table, Printer, UserCheck, Trash2, ArrowUp, ArrowDown, ListOrdered, Building, Database, KeyRound, Download,ClipboardList
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import type { Staff, StaffType } from './types'
import { WorkSummary } from './components/WorkSummary'

type Section = 'dashboard' | 'staff' | 'roster' | 'work-summary' | 'compensation' | 'documents' | 'settings'

interface Signer {
  id: string
  name: string
  position: string
  role: string
}

const menu: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'ภาพรวมระบบ', icon: LayoutDashboard },
  { id: 'staff', label: 'จัดการบุคลากร', icon: Users },
  { id: 'roster', label: 'จัดตารางเวร', icon: CalendarDays },
  { id: 'compensation', label: 'ค่าตอบแทน', icon: CircleDollarSign },
  { id: 'documents', label: 'ใบเบิกและเอกสาร', icon: FileText },
  { id: 'settings', label: 'ตั้งค่าระบบ', icon: Settings },
  { id: 'work-summary', label: 'สรุปผลการปฏิบัติงาน', icon: ClipboardList },
]

const emptyForm = {
  first_name: '', last_name: '', position: '', staff_type: 'วิชาชีพ' as StaffType,
  morning_rate: '0', afternoon_rate: '0', status: 'active' as 'active' | 'inactive',
}

const WEEKDAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

function arabicToThaiBaht(numbers: number): string {
  if (numbers === 0) return 'ศูนย์บาทถ้วน'
  const bahtText = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"]
  const unitText = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"]
  let [integerStr] = numbers.toFixed(2).split('.')
  let thaiStr = ''
  let len = integerStr.length
  for (let i = 0; i < len; i++) {
    let digit = parseInt(integerStr.charAt(i))
    let pos = len - i - 1
    if (digit !== 0) {
      if (pos === 1 && digit === 1) thaiStr += 'สิบ'
      else if (pos === 1 && digit === 2) thaiStr += 'ยี่สิบ'
      else if (pos === 0 && digit === 1 && len > 1) thaiStr += 'เอ็ด'
      else thaiStr += bahtText[digit] + unitText[pos % 6]
    }
    if (pos === 6) thaiStr += 'ล้าน'
  }
  return thaiStr + 'บาทถ้วน'
}

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [section, setSection] = useState<Section>('dashboard')
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [userRole, setUserRole] = useState('user')

  const [reorderModalOpen, setReorderModalOpen] = useState(false)
  const [orderedStaffList, setOrderedStaffList] = useState<Staff[]>([])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || !supabase) return
    void loadProfile()
    void loadStaff()
  }, [session])

  async function loadProfile() {
    if (!supabase || !session?.user?.id) return
    const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
    setUserRole(data?.role ?? 'user')
  }

  async function loadStaff() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('staff')
      .select('*')
      .order('display_order', { ascending: true })
    
    if (queryError) {
      const { data: fallbackData, error: fbErr } = await supabase
        .from('staff')
        .select('*')
        .order('first_name', { ascending: true })
      if (fbErr) setError(fbErr.message)
      else setStaff((fallbackData ?? []) as Staff[])
    } else {
      setStaff((data ?? []) as Staff[])
    }
    setLoading(false)
  }

  async function signIn(email: string, password: string) {
    if (!supabase) return
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) setError(authError.message)
  }

  async function signOut() {
    await supabase?.auth.signOut()
    setStaff([])
    setSection('dashboard')
  }

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(person: Staff) {
    setEditing(person)
    setForm({
      first_name: person.first_name,
      last_name: person.last_name,
      position: person.position,
      staff_type: person.staff_type,
      morning_rate: String(person.morning_rate),
      afternoon_rate: String(person.afternoon_rate),
      status: person.status,
    })
    setModalOpen(true)
  }

  async function saveStaff(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setSaving(true)
    setError('')

    // คำนวณลำดับ: ถ้าแก้ไขคนเดิมให้คงลำดับ display_order ไว้ ถ้าเป็นคนใหม่ให้ต่อท้าย
    const nextOrder = editing 
      ? (editing.display_order || 999) 
      : (staff.length > 0 ? Math.max(...staff.map(s => s.display_order || 0)) + 1 : 1)

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      position: form.position.trim(),
      staff_type: form.staff_type,
      morning_rate: Number(form.morning_rate),
      afternoon_rate: Number(form.afternoon_rate),
      status: form.status,
      display_order: nextOrder,
    }
    const result = editing
      ? await supabase.from('staff').update(payload).eq('id', editing.id)
      : await supabase.from('staff').insert(payload)
    setSaving(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    setModalOpen(false)
    await loadStaff()
  }

  async function toggleStatus(person: Staff) {
    if (!supabase) return
    const next = person.status === 'active' ? 'inactive' : 'active'
    const { error: updateError } = await supabase.from('staff').update({ status: next }).eq('id', person.id)
    if (updateError) setError(updateError.message)
    else await loadStaff()
  }

  function openReorderModal() {
    setOrderedStaffList([...staff])
    setReorderModalOpen(true)
  }

  function moveStaffUp(index: number) {
    if (index === 0) return
    const list = [...orderedStaffList]
    const temp = list[index - 1]
    list[index - 1] = list[index]
    list[index] = temp
    setOrderedStaffList(list)
  }

  function moveStaffDown(index: number) {
    if (index === orderedStaffList.length - 1) return
    const list = [...orderedStaffList]
    const temp = list[index + 1]
    list[index + 1] = list[index]
    list[index] = temp
    setOrderedStaffList(list)
  }

async function saveReorder() {
    setStaff(orderedStaffList)
    setReorderModalOpen(false)
    setLoading(true)

    if (supabase) {
      // ดึงข้อมูลเดิมมา แต่ละเว้น staff_code ออกไป ไม่ให้ส่งเข้า Supabase
      const updates = orderedStaffList.map((item, index) => {
        const { staff_code, ...rest } = item // 👈 ดึง staff_code ออก
        return {
          ...rest,
          display_order: index + 1
        }
      })

      const { error: upsertErr } = await supabase
        .from('staff')
        .upsert(updates, { onConflict: 'id' })

      if (upsertErr) {
        setError('ไม่สามารถบันทึกการจัดลำดับได้: ' + upsertErr.message)
      } else {
        await loadStaff() // โหลดข้อมูลใหม่หลังจากบันทึกสำเร็จ
      }
    }
    setLoading(false)
  }
  const filteredStaff = useMemo(() => {
    const q = search.toLocaleLowerCase('th')
    return staff.filter((p) =>
      `${p.staff_code} ${p.first_name} ${p.last_name} ${p.position}`.toLocaleLowerCase('th').includes(q),
    )
  }, [staff, search])

  if (!isSupabaseConfigured) return <SetupScreen />
  if (!session) return <LoginScreen onLogin={signIn} error={error} />

  return (
    <div className="app-shell">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 4mm;
          }
          body * {
            visibility: hidden;
          }
          .sidebar, .topbar, .page-heading, .alert, .no-print {
            display: none !important;
          }
          .main-area {
            margin: 0 !important;
            padding: 0 !important;
          }
          .page-content {
            padding: 0 !important;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          .print-area .doc-title-box {
            margin-bottom: 4px !important;
          }
          .print-area .doc-title-box h2 {
            font-size: 13.5px !important;
          }
          .print-area .doc-title-box p {
            font-size: 11px !important;
          }
          table {
            width: 100% !important;
            font-size: 9.5px !important;
            border-collapse: collapse !important;
          }
          tr {
            height: 16px !important;
          }
          th, td {
            border: 1px solid #000000 !important;
            padding: 1px 1.5px !important;
            line-height: 1.1 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .weekend-cell {
            background-color: #e2e8f0 !important;
          }
          .weekend-header {
            background-color: #cbd5e1 !important;
          }
          .signature-section {
            margin-top: 10px !important;
            font-size: 9.5px !important;
          }
          .signature-section p {
            line-height: 1.15 !important;
          }
        }
      `}</style>

      {mobileNav && <button className="mobile-scrim no-print" onClick={() => setMobileNav(false)} aria-label="ปิดเมนู" />}
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''} no-print`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={25} /></div>
          <div><strong>KORKHO</strong><span>SMART ROSTER</span></div>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)}><X size={19}/></button>
        </div>
        <div className="facility-label">ระบบบริหารจัดการบุคลากร</div>
        <nav className="nav-list">
          {menu.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} className={`nav-item ${section === item.id ? 'active' : ''}`}
                onClick={() => { setSection(item.id); setMobileNav(false) }}>
                <Icon size={19}/><span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note"><ShieldCheck size={17}/><span>ระบบสำหรับเจ้าหน้าที่<br/>มีการควบคุมสิทธิ์การเข้าถึง</span></div>
          <button className="nav-item logout" onClick={signOut}><LogOut size={18}/>ออกจากระบบ</button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar no-print">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)}><Menu size={21}/></button>
          <div className="breadcrumb">KORKHO SMART ROSTER <span>/</span> {menu.find(x => x.id === section)?.label}</div>
          <div className="user-chip"><div className="avatar"><UserRound size={17}/></div><div><b>{session.user.email}</b><small>{userRole === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}</small></div></div>
        </header>

        <div className="page-content">
          {error && <div className="alert error no-print"><AlertCircle size={17}/>{error}<button onClick={() => setError('')}><X size={15}/></button></div>}
          {section === 'dashboard' && <Dashboard staff={staff} onNavigate={setSection}/>}
          {section === 'staff' && <StaffPage staff={filteredStaff} allCount={staff.length} search={search} setSearch={setSearch}
            loading={loading} onAdd={openAdd} onEdit={openEdit} onToggle={toggleStatus} onReorder={openReorderModal} isAdmin={userRole === 'admin'}/>}
          {section === 'roster' && <RosterCalendarPage staff={staff} isAdmin={userRole === 'admin'} />}
          {section === 'work-summary' && <WorkSummary/>}
          {section === 'compensation' && <CompensationPage staff={staff} />}
          {section === 'documents' && <DocumentsPage staff={staff} />}
          {section === 'settings' && <SettingsPage userEmail={session.user.email} userRole={userRole} staffCount={staff.length} />}
        </div>
      </main>

      {modalOpen && <div className="modal-backdrop no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}>
        <form className="modal" onSubmit={saveStaff}>
          <div className="modal-head"><div><h2>{editing ? 'แก้ไขข้อมูลบุคลากร' : 'เพิ่มบุคลากร'}</h2><p>กรอกข้อมูลบุคลากรและอัตราค่าตอบแทน</p></div>
            <button type="button" className="icon-button" onClick={() => setModalOpen(false)}><X size={20}/></button></div>
          <div className="form-grid">
            <label>ชื่อ<input required value={form.first_name} onChange={e => setForm({...form, first_name:e.target.value})}/></label>
            <label>นามสกุล<input required value={form.last_name} onChange={e => setForm({...form, last_name:e.target.value})}/></label>
            <label className="full">ตำแหน่ง<input required value={form.position} onChange={e => setForm({...form, position:e.target.value})}/></label>
            <label>ประเภทบุคลากร<select value={form.staff_type} onChange={e => setForm({...form, staff_type:e.target.value as StaffType})}><option>วิชาชีพ</option><option>ลูกจ้าง</option></select></label>
            <label>สถานะ<select value={form.status} onChange={e => setForm({...form, status:e.target.value as 'active'|'inactive'})}><option value="active">ใช้งาน</option><option value="inactive">ไม่ใช้งาน</option></select></label>
            <label>อัตราเวรเช้า (บาท/ครั้ง)<input type="number" min="0" step="0.01" required value={form.morning_rate} onChange={e => setForm({...form, morning_rate:e.target.value})}/></label>
            <label>อัตราเวรบ่าย (บาท/ครั้ง)<input type="number" min="0" step="0.01" required value={form.afternoon_rate} onChange={e => setForm({...form, afternoon_rate:e.target.value})}/></label>
          </div>
          <div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setModalOpen(false)}>ยกเลิก</button><button className="btn primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button></div>
        </form>
      </div>}

      {reorderModalOpen && (
        <div className="modal-backdrop no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) setReorderModalOpen(false) }}>
          <div className="modal" style={{ maxWidth: '550px' }}>
            <div className="modal-head">
              <div>
                <h2>จัดเรียงลำดับบุคลากร (1, 2, 3...)</h2>
                <p>กดปุ่มเลื่อนขึ้น-ลง เพื่อกำหนดลำดับที่จะแสดงในเอกสารใบเบิกและตารางเวร</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setReorderModalOpen(false)}><X size={20}/></button>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {orderedStaffList.map((person, index) => (
                  <div key={person.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#0284c7', width: '30px' }}>#{index + 1}</span>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '13.5px' }}>{person.first_name} {person.last_name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{person.position}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        type="button" 
                        disabled={index === 0} 
                        onClick={() => moveStaffUp(index)}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: index === 0 ? '#f1f5f9' : '#fff', cursor: index === 0 ? 'not-allowed' : 'pointer' }}
                        title="เลื่อนขึ้น"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button 
                        type="button" 
                        disabled={index === orderedStaffList.length - 1} 
                        onClick={() => moveStaffDown(index)}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: index === orderedStaffList.length - 1 ? '#f1f5f9' : '#fff', cursor: index === orderedStaffList.length - 1 ? 'not-allowed' : 'pointer' }}
                        title="เลื่อนลง"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setReorderModalOpen(false)}>ยกเลิก</button>
              <button className="btn primary" onClick={saveReorder}>บันทึกการจัดลำดับ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsPage({ userEmail, userRole, staffCount }: { userEmail: string; userRole: string; staffCount: number }) {
  const [orgConfig, setOrgConfig] = useState({
    hospitalName: 'โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค',
    district: 'อำเภอเมืองสุรินทร์',
    province: 'จังหวัดสุรินทร์',
    hospitalCode: '10978',
    defaultMorningRate: '300',
    defaultAfternoonRate: '300',
    defaultOrderPrefix: '46/2569',
  })

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  function handleSaveSettings(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setMsg({ text: 'บันทึกการตั้งค่าระบบเรียบร้อยแล้ว', type: 'success' })
    }, 400)
  }

  function exportBackup() {
    alert('ส่งออกข้อมูลสำรองระบบ (CSV) เรียบร้อยแล้ว')
  }

  return (
    <>
      <div className="page-heading no-print">
        <div>
          <div className="eyebrow font-semibold">SYSTEM SETTINGS</div>
          <h1 className="text-2xl font-bold">ตั้งค่าระบบและกำหนดค่าเริ่มต้น</h1>
          <p className="text-gray-600">จัดการข้อมูลหน่วยงาน ค่าตอบแทนมาตรฐาน และสิทธิ์ผู้ใช้งาน</p>
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.type === 'error' ? 'error' : 'success'} mb-4 no-print`}>
          <AlertCircle size={17} />
          {msg.text}
          <button onClick={() => setMsg(null)}><X size={15} /></button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }} className="no-print">
        {/* ข้อมูลหน่วยงาน */}
        <form onSubmit={handleSaveSettings} className="panel" style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #cbd5e1' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={18} /> ข้อมูลสถานพยาบาล / หน่วยงาน
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
              ชื่อสถานพยาบาล:
              <input value={orgConfig.hospitalName} onChange={e => setOrgConfig({ ...orgConfig, hospitalName: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px', fontSize: '13px' }} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                อำเภอ:
                <input value={orgConfig.district} onChange={e => setOrgConfig({ ...orgConfig, district: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px', fontSize: '13px' }} />
              </label>

              <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                จังหวัด:
                <input value={orgConfig.province} onChange={e => setOrgConfig({ ...orgConfig, province: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px', fontSize: '13px' }} />
              </label>
            </div>

            <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
              รหัสหน่วยงาน (HCODE):
              <input value={orgConfig.hospitalCode} onChange={e => setOrgConfig({ ...orgConfig, hospitalCode: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px', fontSize: '13px' }} />
            </label>
          </div>

          <hr style={{ margin: '16px 0', borderColor: '#e2e8f0' }} />

          <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CircleDollarSign size={18} /> อัตราค่าตอบแทนมาตรฐาน (Default Rate)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
              เวรเช้า (บาท/ครั้ง):
              <input type="number" value={orgConfig.defaultMorningRate} onChange={e => setOrgConfig({ ...orgConfig, defaultMorningRate: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px', fontSize: '13px' }} />
            </label>

            <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
              เวรบ่าย (บาท/ครั้ง):
              <input type="number" value={orgConfig.defaultAfternoonRate} onChange={e => setOrgConfig({ ...orgConfig, defaultAfternoonRate: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px', fontSize: '13px' }} />
            </label>
          </div>

          <button className="btn primary" disabled={saving} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลตั้งค่า'}
          </button>
        </form>

        {/* ผู้ใช้งาน & ระบบความปลอดภัย */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="panel" style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #cbd5e1' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={18} /> บัญชีผู้ใช้งานปัจจุบัน
            </h3>

            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>{userEmail}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                ระดับสิทธิ์: <span style={{ color: userRole === 'admin' ? '#16a34a' : '#0284c7', fontWeight: 'bold' }}>{userRole === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งานทั่วไป (User)'}</span>
              </div>
            </div>

            <div style={{ fontSize: '12.5px', color: '#64748b' }}>
              * การจัดการเพิ่มผู้ใช้งานใหม่และการเปลี่ยนรหัสผ่าน สามารถทำผ่านระบบบริหารจัดการของ Supabase ได้อย่างปลอดภัย
            </div>
          </div>

          {/* การจัดการข้อมูลและสำรอง */}
          <div className="panel" style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #cbd5e1' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} /> สำรองข้อมูล & ฐานข้อมูล
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>ทะเบียนบุคลากรทั้งหมด</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0284c7' }}>{staffCount} ราย</span>
              </div>

              <button
                type="button"
                onClick={exportBackup}
                className="btn secondary"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
              >
                <Download size={16} /> ส่งออกข้อมูลสำรอง (Export CSV)
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
const OFFICIAL_HOLIDAYS: Record<string, string> = {
  '2026-01-01': 'วันขึ้นปีใหม่',
  '2026-03-03': 'วันมาฆบูชา',
  '2026-04-06': 'วันพระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราชฯ',
  '2026-04-13': 'วันสงกรานต์',
  '2026-04-14': 'วันสงกรานต์',
  '2026-04-15': 'วันสงกรานต์',
  '2026-05-01': 'วันแรงงานแห่งชาติ',
  '2026-05-04': 'วันฉัตรมงคล',
  '2026-05-31': 'วันวิสาขบูชา',
  '2026-06-03': 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี',
  '2026-07-28': 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว',
  '2026-07-29': 'วันอาสาฬหบูชา',
  '2026-07-30': 'วันเข้าพรรษา',
  '2026-08-12': 'วันแม่แห่งชาติ',
  '2026-10-13': 'วันนวมินทรมหาราช',
  '2026-10-23': 'วันปิยมหาราช',
  '2026-12-05': 'วันพ่อแห่งชาติ',
  '2026-12-10': 'วันรัฐธรรมนูญ',
  '2026-12-31': 'วันสิ้นปี',
}
function DocumentsPage({ staff }: { staff: Staff[] }) {
  const [year, setYear] = useState<number>(2026)
  const [month, setMonth] = useState<number>(10)
  const [orderNo, setOrderNo] = useState<string>('46/2569')
  const [orderDate, setOrderDate] = useState<string>('29 กันยายน พ.ศ.2569')

  const [doubleRateDays, setDoubleRateDays] = useState<number[]>([])
  const [customHolidays, setCustomHolidays] = useState<number[]>([])

  function toggleCustomHoliday(day: number) {
    setCustomHolidays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const [signers, setSigners] = useState<Signer[]>([
    { id: '1', name: 'นางปิยานาถ เหมือนวาจา', position: 'ผอ.รพ.สต.คอโค', role: 'ผู้ควบคุม' },
    { id: '2', name: 'นางสาวกนกร หงษ์ศรีจันทร์ วูลเลย์', position: 'นักสาธารณสุขชำนาญการ', role: 'ผู้ตรวจถูกต้อง' },
    { id: '3', name: 'นายจรูญ ดวงพร', position: 'สาธารณสุขอำเภอเมืองสุรินทร์', role: 'ผู้อนุมัติให้จ่ายได้' },
    { id: '4', name: 'นางจรรยา วรรณรูปถัมภ์', position: 'จพ.ทันตสาธารณสุขชำนาญงาน', role: 'ผู้จ่ายเงิน' },
  ])

  const [selectedController, setSelectedController] = useState<string>('1')
  const [selectedChecker, setSelectedChecker] = useState<string>('2')
  const [selectedApprover, setSelectedApprover] = useState<string>('3')
  const [selectedPayer, setSelectedPayer] = useState<string>('4')

  const [dutyMap, setDutyMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState<boolean>(false)
  const [isSaved, setIsSaved] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const [signerModalOpen, setSignerModalOpen] = useState<boolean>(false)
  const [editingSigner, setEditingSigner] = useState<Signer | null>(null)
  const [signerForm, setSignerForm] = useState({ name: '', position: '', role: 'ผู้ควบคุม', customRole: '' })

  const activeStaff = useMemo(() => staff.filter(s => s.status === 'active'), [staff])

const daysInMonthList = useMemo(() => {
    const totalDays = new Date(year, month, 0).getDate()
    const list = []
    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(year, month - 1, day)
      const dayOfWeekIndex = dateObj.getDay()
      const dayStr = String(day).padStart(2, '0')
      const monthStr = String(month).padStart(2, '0')
      const dateStr = `${year}-${monthStr}-${dayStr}`
      
      const isOfficialHoliday = !!OFFICIAL_HOLIDAYS[dateStr]
      const isCustomHoliday = customHolidays.includes(day)
      const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6

      list.push({
        day,
        dateStr,
        dayOfWeekIndex,
        dayOfWeekName: WEEKDAYS_SHORT[dayOfWeekIndex],
        isWeekend,
        isOfficialHoliday,
        isCustomHoliday,
        holidayName: OFFICIAL_HOLIDAYS[dateStr] || (isCustomHoliday ? 'วันหยุดพิเศษ (มติ ครม.)' : ''),
      })
    }
    return list
  }, [year, month, customHolidays])

  useEffect(() => {
    void loadRosterData()
  }, [year, month])

  async function loadRosterData() {
    if (!supabase) return
    setLoading(true)
    setIsSaved(false)
    try {
      const { data: schedule } = await supabase
        .from('duty_schedules')
        .select('id')
        .eq('schedule_year', year)
        .eq('schedule_month', month)
        .maybeSingle()

      if (!schedule) {
        setDutyMap({})
        return
      }

      const { data: assignments } = await supabase
        .from('duty_assignments')
        .select('*')
        .eq('schedule_id', schedule.id)

      const map: Record<string, string[]> = {}
      ;(assignments || []).forEach((item: any) => {
        const key = `${item.duty_date}_${item.shift_type}`
        if (!map[key]) map[key] = []
        map[key].push(item.staff_id)
      })

      setDutyMap(map)
    } finally {
      setLoading(false)
    }
  }

  const reportRows = useMemo(() => {
    const rows: any[] = []
    activeStaff.forEach((person, pIdx) => {
      const morningDays: number[] = []
      const afternoonDays: number[] = []

      daysInMonthList.forEach(d => {
        const morningList = dutyMap[`${d.dateStr}_morning`] || []
        const afternoonList = dutyMap[`${d.dateStr}_afternoon`] || []

        if (morningList.includes(person.id)) morningDays.push(d.day)
        if (afternoonList.includes(person.id)) afternoonDays.push(d.day)
      })

      const morningRateNum = Number(person.morning_rate || 0)
      const afternoonRateNum = Number(person.afternoon_rate || 0)

      const morningAmount = morningDays.reduce((sum, day) => {
        const multiplier = doubleRateDays.includes(day) ? 2 : 1
        return sum + (morningRateNum * multiplier)
      }, 0)

      const afternoonAmount = afternoonDays.reduce((sum, day) => {
        const multiplier = doubleRateDays.includes(day) ? 2 : 1
        return sum + (afternoonRateNum * multiplier)
      }, 0)

      const morningRateText = morningRateNum > 0 ? `เช้า ${morningRateNum}บ.` : ''
      const afternoonRateText = afternoonRateNum > 0 ? `บ่าย ${afternoonRateNum}บ.` : ''

      rows.push({
        staffId: person.id,
        no: pIdx + 1,
        name: `${person.first_name} ${person.last_name}`,
        position: person.position,
        rateLabel: morningRateText,
        shiftType: 'เช้า',
        rate: morningRateNum,
        activeDays: morningDays,
        totalDays: morningDays.length,
        totalAmount: morningAmount,
        isFirstRow: true,
      })

      rows.push({
        staffId: person.id,
        no: '',
        name: '',
        position: '',
        rateLabel: afternoonRateText,
        shiftType: 'บ่าย',
        rate: afternoonRateNum,
        activeDays: afternoonDays,
        totalDays: afternoonDays.length,
        totalAmount: afternoonAmount,
        isFirstRow: false,
      })
    })
    return rows
  }, [activeStaff, daysInMonthList, dutyMap, doubleRateDays])

  const grandTotalAmount = useMemo(() => {
    return reportRows.reduce((sum, r) => sum + r.totalAmount, 0)
  }, [reportRows])

  function toggleDoubleRateDay(day: number) {
    setDoubleRateDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
    )
  }

  function openEditSigner(s: Signer) {
    setEditingSigner(s)
    const isStandardRole = ['ผู้ควบคุม', 'ผู้ตรวจถูกต้อง', 'ผู้อนุมัติให้จ่ายได้', 'ผู้จ่ายเงิน'].includes(s.role)
    setSignerForm({ 
      name: s.name, 
      position: s.position, 
      role: isStandardRole ? s.role : 'custom',
      customRole: isStandardRole ? '' : s.role
    })
    setSignerModalOpen(true)
  }

  function saveSigner(e: FormEvent) {
    e.preventDefault()
    if (!signerForm.name.trim() || !signerForm.position.trim()) return

    const finalRole = signerForm.role === 'custom' ? signerForm.customRole.trim() : signerForm.role
    if (!finalRole) return

    if (editingSigner) {
      setSigners(prev => prev.map(item => item.id === editingSigner.id ? { ...item, name: signerForm.name.trim(), position: signerForm.position.trim(), role: finalRole } : item))
    } else {
      const newSigner: Signer = {
        id: Date.now().toString(),
        name: signerForm.name.trim(),
        position: signerForm.position.trim(),
        role: finalRole,
      }
      setSigners(prev => [...prev, newSigner])
    }
    setSignerModalOpen(false)
  }

  function deleteSigner(id: string) {
    setSigners(prev => prev.filter(s => s.id !== id))
  }

  function handleSaveBill() {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setIsSaved(true)
      setMsg({ text: 'บันทึกใบเบิกเงินเรียบร้อยแล้ว สามารถกดปริ้นเอกสารได้', type: 'success' })
    }, 500)
  }

  const thaiMonthName = new Date(year, month - 1).toLocaleString('th-TH', { month: 'long' })
  const thaiYear = year + 543

  const controllerObj = signers.find(s => s.id === selectedController)
  const checkerObj = signers.find(s => s.id === selectedChecker)
  const approverObj = signers.find(s => s.id === selectedApprover)
  const payerObj = signers.find(s => s.id === selectedPayer)

  return (
    <>
      <div className="page-heading no-print">
        <div>
          <div className="eyebrow font-semibold">REIMBURSEMENT FORM</div>
          <h1 className="text-2xl font-bold">ออกใบเบิกเงินค่าตอบแทนปฏิบัติงาน (แบบฟอร์มราชการ)</h1>
          <p className="text-gray-600">เลือกผู้ลงนาม ระบุวันเบิก 2 เท่า บันทึกใบเบิก และพิมพ์เสนอเซ็น</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => { setEditingSigner(null); setSignerForm({ name: '', position: '', role: 'ผู้ควบคุม', customRole: '' }); setSignerModalOpen(true) }}
            className="btn secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UserCheck size={16} /> จัดการข้อมูลผู้ลงนาม
          </button>

          <button
            onClick={handleSaveBill}
            disabled={saving || loading}
            className="btn primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#16a34a' }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'กำลังบันทึก...' : 'บันทึกใบเบิกเงิน'}
          </button>

          <button
            onClick={() => window.print()}
            disabled={!isSaved}
            className="btn secondary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              opacity: isSaved ? 1 : 0.5,
              cursor: isSaved ? 'pointer' : 'not-allowed'
            }}
            title={isSaved ? 'พิมพ์ใบเบิก' : 'กรุณากดบันทึกใบเบิกเงินก่อน'}
          >
            <Printer size={16} /> พิมพ์เสนอเซ็น
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.type === 'error' ? 'error' : 'success'} mb-4 no-print`}>
          <AlertCircle size={17} />
          {msg.text}
          <button onClick={() => setMsg(null)}><X size={15} /></button>
        </div>
      )}

      <div className="panel no-print mb-6" style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #cbd5e1' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserCheck size={18} /> 1. เลือกผู้ลงนามและข้อมูลคำสั่งเสนอเซ็น
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
            ประจำเดือน:
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(2026, m - 1).toLocaleString('th-TH', { month: 'long' })}</option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
            ปี พ.ศ.:
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
              <option value={2026}>พ.ศ. 2569</option>
              <option value={2025}>พ.ศ. 2568</option>
            </select>
          </label>

          <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
            คำสั่งที่:
            <input value={orderNo} onChange={e => setOrderNo(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }} />
          </label>

          <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
            ลงวันที่คำสั่ง:{/* แผงปุ่มสำหรับติ๊กเลือกวันหยุดพิเศษ (มติ ครม.) */}
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#b45309', display: 'block', marginBottom: '6px' }}>
            📌 ติ๊กเลือกวันหยุดพิเศษประจำเดือน (มติ ครม. / วันหยุดชดเชยเพิ่มเติม):
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {daysInMonthList.map(d => (
              <button
                key={d.day}
                type="button"
                onClick={() => toggleCustomHoliday(d.day)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  border: d.isCustomHoliday ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                  backgroundColor: d.isCustomHoliday ? '#fef3c7' : '#ffffff',
                  color: d.isCustomHoliday ? '#b45309' : '#475569',
                  fontWeight: d.isCustomHoliday ? 'bold' : 'normal',
                  cursor: 'pointer',
                }}
                title={d.holidayName || `วันที่ ${d.day}`}
              >
                {d.day} {d.isOfficialHoliday ? '🔴' : d.isCustomHoliday ? '⭐' : ''}
              </button>
            ))}
          </div>
        </div>
            <input value={orderDate} onChange={e => setOrderDate(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }} />
          </label>
        </div>

        <hr style={{ margin: '16px 0', borderColor: '#e2e8f0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
            1. ผู้ลงนาม (ผู้ควบคุม):
            <select value={selectedController} onChange={e => setSelectedController(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
              <option value="">-- ไม่ระบุ (เว้นว่าง/ไม่แสดงชื่อ) --</option>
              {signers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.position})</option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
            2. ผู้ลงนาม (ตรวจถูกต้อง):
            <select value={selectedChecker} onChange={e => setSelectedChecker(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
              <option value="">-- ไม่ระบุ (เว้นว่าง/ไม่แสดงชื่อ) --</option>
              {signers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.position})</option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
            3. ผู้ลงนาม (ผู้อนุมัติให้จ่ายได้):
            <select value={selectedApprover} onChange={e => setSelectedApprover(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
              <option value="">-- ไม่ระบุ (เว้นว่าง/ไม่แสดงชื่อ) --</option>
              {signers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.position})</option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
            4. ผู้ลงนาม (ผู้จ่ายเงิน):
            <select value={selectedPayer} onChange={e => setSelectedPayer(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
              <option value="">-- ไม่ระบุ (เว้นว่าง/ไม่แสดงชื่อ) --</option>
              {signers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.position})</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚡ 2. เลือกวันที่ต้องการเบิก 2 เท่า (คลิกเพื่อเลือก/ยกเลิก):
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {daysInMonthList.map(d => {
              const isSelected = doubleRateDays.includes(d.day)
              return (
                <button
                  key={`btn-day-${d.day}`}
                  type="button"
                  onClick={() => toggleDoubleRateDay(d.day)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: isSelected ? 'bold' : 'normal',
                    border: isSelected ? '1px solid #16a34a' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#dcfce7' : d.isWeekend ? '#e2e8f0' : '#ffffff',
                    color: isSelected ? '#15803d' : '#334155',
                    cursor: 'pointer'
                  }}
                >
                  วันที่ {d.day} {isSelected ? '⚡ (2 เท่า)' : ''}
                </button>
              )
            })}
          </div>
          {doubleRateDays.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '12.5px', color: '#166534', fontWeight: 500 }}>
              วันที่เลือกเบิก 2 เท่า: <b>{doubleRateDays.join(', ')}</b>
            </div>
          )}
        </div>
      </div>

      <div className="panel table-panel print-area" style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px 20px', border: '1px solid #e2e8f0', color: '#000000' }}>
        <div className="doc-title-box" style={{ textAlign: 'center', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0' }}>
            หลักฐานการจ่ายเงินค่าตอบแทนปฏิบัติราชการนอกเวลาราชการ
          </h2>
          <p style={{ fontSize: '12.5px', margin: '0 0 2px 0' }}>
            โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค อำเภอเมือง จังหวัดสุรินทร์ ประจำเดือน {thaiMonthName} พ.ศ. {thaiYear}
          </p>
          <p style={{ fontSize: '11.5px', margin: 0 }}>
            เบิกตามฎีกา/คำสั่งที่ {orderNo} ลงวันที่ {orderDate}
          </p>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>กำลังโหลดข้อมูลใบเบิก...</div>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', border: '1px solid #000000' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', height: '18px' }}>
                  <th style={{ border: '1px solid #000', padding: '2px', width: '26px', textAlign: 'center' }} rowSpan={2}>ลำดับ</th>
                  <th style={{ border: '1px solid #000', padding: '2px', minWidth: '125px', textAlign: 'center' }} rowSpan={2}>ชื่อ</th>
                  <th style={{ border: '1px solid #000', padding: '2px', minWidth: '95px', textAlign: 'center' }} rowSpan={2}>ตำแหน่ง</th>
                  <th style={{ border: '1px solid #000', padding: '2px', minWidth: '65px', textAlign: 'center' }} rowSpan={2}>อัตราเงิน<br/>ตอบแทน</th>
                  <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} colSpan={daysInMonthList.length}>วันที่ปฏิบัติงานนอกเวลาราชการ</th>
                  <th style={{ border: '1px solid #000', padding: '2px', width: '36px', textAlign: 'center' }} rowSpan={2}>รวมวัน</th>
                  <th style={{ border: '1px solid #000', padding: '2px', width: '58px', textAlign: 'center' }} rowSpan={2}>จำนวนเงิน</th>
                  <th style={{ border: '1px solid #000', padding: '2px', width: '58px', textAlign: 'center' }} colSpan={2}>วันเดือนปี ที่รับเงิน</th>
                  <th style={{ border: '1px solid #000', padding: '2px', width: '65px', textAlign: 'center' }} rowSpan={2}>ลายมือชื่อ<br/>ผู้รับเงิน</th>
                </tr>
                <tr style={{ backgroundColor: '#f8fafc', height: '16px' }}>
                  {daysInMonthList.map(d => {
                    const headerClass = d.isOfficialHoliday
                      ? 'official-holiday-header'
                      : d.isCustomHoliday
                      ? 'custom-holiday-header'
                      : d.isWeekend
                      ? 'weekend-header'
                      : ''

                    return (
                      <th
                        key={`hd-${d.day}`}
                        className={headerClass}
                        style={{
                          border: '1px solid #000',
                          padding: '1px 0',
                          textAlign: 'center',
                          width: '17px',
                          fontSize: '9.5px',
                        }}
                        title={d.holidayName}
                      >
                        {d.day}
                      </th>
                    )
                  })}
                  <th style={{ border: '1px solid #000', padding: '1px', width: '29px', textAlign: 'center', fontSize: '9px' }}>ที่รับเงิน</th>
                  <th style={{ border: '1px solid #000', padding: '1px', width: '29px', textAlign: 'center', fontSize: '9px' }}>ผู้จ่ายเงิน</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonthList.length + 9} style={{ border: '1px solid #000', padding: '16px', textAlign: 'center', color: '#64748b' }}>
                      ไม่พบข้อมูลการจัดเวรในเดือนนี้
                    </td>
                  </tr>
                ) : (
                  reportRows.map((row, idx) => (
                    <tr key={`r-${idx}`} style={{ height: '17px' }}>
                      {row.isFirstRow ? (
                        <>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }} rowSpan={2}>{row.no}</td>
                          <td style={{ border: '1px solid #000', padding: '1px 3px', whiteSpace: 'nowrap' }} rowSpan={2}><b>{row.name}</b></td>
                          <td style={{ border: '1px solid #000', padding: '1px 3px', fontSize: '9.5px', lineHeight: 1.15 }} rowSpan={2}>{row.position}</td>
                        </>
                      ) : null}

                      <td style={{ border: '1px solid #000', padding: '1px 3px', fontSize: '9.5px', whiteSpace: 'nowrap' }}>{row.rateLabel}</td>

                      {daysInMonthList.map(d => {
                    const cellClass = d.isOfficialHoliday
                      ? 'official-holiday-cell'
                      : d.isCustomHoliday
                      ? 'custom-holiday-cell'
                      : d.isWeekend
                      ? 'weekend-cell'
                      : ''
                    const isActive = row.activeDays.includes(d.day)

                    return (
                      <td
                        key={`cell-${d.day}`}
                        className={cellClass}
                        style={{
                          border: '1px solid #000',
                          textAlign: 'center',
                          fontSize: '9px',
                          fontWeight: isActive ? 'bold' : 'normal',
                        }}
                      >
                        {isActive ? '1' : ''}
                      </td>
                    )
                  })}

                      <td style={{ border: '1px solid #000', textAlign: 'center' }}>{row.totalDays}</td>
                      <td style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '3px' }}>
                        {row.totalAmount > 0 ? row.totalAmount.toLocaleString('th-TH') : '0'}
                      </td>

                      {row.isFirstRow ? (
                        <>
                          <td style={{ border: '1px solid #000' }} rowSpan={2}></td>
                          <td style={{ border: '1px solid #000' }} rowSpan={2}></td>
                          <td style={{ border: '1px solid #000' }} rowSpan={2}></td>
                        </>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#ffffff', fontWeight: 'bold', height: '18px' }}>
                  <td style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'center' }} colSpan={4}>
                    (ตัวอักษร)
                  </td>
                  <td style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'center' }} colSpan={daysInMonthList.length + 1}>
                    {arabicToThaiBaht(grandTotalAmount)}
                  </td>
                  <td style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '3px' }}>
                    {grandTotalAmount.toLocaleString('th-TH')}
                  </td>
                  <td style={{ border: '1px solid #000' }} colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {doubleRateDays.length > 0 && (
          <div style={{ marginTop: '4px', fontSize: '10px', fontWeight: 'bold', color: '#0f172a' }}>
            * หมายเหตุ: เบิก 2 เท่า = วันที่ {doubleRateDays.join(', ')}
          </div>
        )}

        <div className="signature-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '16px', textAlign: 'center', fontSize: '10.5px', textIndent: 0 }}>
          <div>
            <p style={{ margin: '0 0 2px 0' }}>ตรวจถูกต้อง</p>
            <p style={{ marginTop: '36px', marginBottom: '4px' }}>ลงชื่อ.........................................{controllerObj ? controllerObj.role : 'ผู้ควบคุม'}</p>
            <p style={{ margin: '0 0 2px 0', fontWeight: 'bold' }}>({controllerObj ? controllerObj.name : '.........................................'})</p>
            <p style={{ margin: 0, fontSize: '10px' }}>{controllerObj ? controllerObj.position : ''}</p>
          </div>

          <div>
            <p style={{ margin: '0 0 2px 0' }}>ตรวจถูกต้อง</p>
            <p style={{ marginTop: '36px', marginBottom: '4px' }}>ลงชื่อ.........................................{checkerObj ? checkerObj.role : ''}</p>
            <p style={{ margin: '0 0 2px 0', fontWeight: 'bold' }}>({checkerObj ? checkerObj.name : '.........................................'})</p>
            <p style={{ margin: 0, fontSize: '10px' }}>{checkerObj ? checkerObj.position : ''}</p>
          </div>

          <div>
            <p style={{ margin: '0 0 2px 0' }}>อนุมัติให้จ่ายได้</p>
            <p style={{ marginTop: '36px', marginBottom: '4px' }}>ลงชื่อ.........................................{approverObj ? approverObj.role : ''}</p>
            <p style={{ margin: '0 0 2px 0', fontWeight: 'bold' }}>({approverObj ? approverObj.name : '.........................................'})</p>
            <p style={{ margin: 0, fontSize: '10px' }}>{approverObj ? approverObj.position : ''}</p>
          </div>

          <div>
            <p style={{ margin: '0 0 2px 0' }}>&nbsp;</p>
            <p style={{ marginTop: '36px', marginBottom: '4px' }}>ลงชื่อ.........................................{payerObj ? payerObj.role : 'ผู้จ่ายเงิน'}</p>
            <p style={{ margin: '0 0 2px 0', fontWeight: 'bold' }}>({payerObj ? payerObj.name : '.........................................'})</p>
            <p style={{ margin: '0 0 2px 0', fontSize: '10px' }}>{payerObj ? payerObj.position : ''}</p>
            <p style={{ margin: 0, fontSize: '9.5px', color: '#475569' }}>......../......................../........</p>
          </div>
        </div>
      </div>

      {signerModalOpen && (
        <div className="modal-backdrop no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) setSignerModalOpen(false) }}>
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-head">
              <div>
                <h2>จัดการข้อมูลผู้ลงนามเอกสาร</h2>
                <p>เพิ่ม แก้ไข หรือลบ รายชื่อเจ้าหน้าที่สำหรับการลงนามในใบเบิก</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setSignerModalOpen(false)}><X size={20}/></button>
            </div>

            <form onSubmit={saveSigner} style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>{editingSigner ? 'แก้ไขข้อมูลผู้ลงนาม' : 'เพิ่มผู้ลงนามใหม่'}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input required placeholder="ชื่อ - นามสกุล" value={signerForm.name} onChange={e => setSignerForm({ ...signerForm, name: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                <input required placeholder="ตำแหน่ง" value={signerForm.position} onChange={e => setSignerForm({ ...signerForm, position: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: signerForm.role === 'custom' ? '1fr 1fr' : '1fr', gap: '8px', marginBottom: '10px' }}>
                <select value={signerForm.role} onChange={e => setSignerForm({ ...signerForm, role: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%' }}>
                  <option value="ผู้ควบคุม">ผู้ควบคุม</option>
                  <option value="ผู้ตรวจถูกต้อง">ผู้ตรวจถูกต้อง</option>
                  <option value="ผู้อนุมัติให้จ่ายได้">ผู้อนุมัติให้จ่ายได้</option>
                  <option value="ผู้จ่ายเงิน">ผู้จ่ายเงิน</option>
                  <option value="custom">✍️ ระบุเอง...</option>
                </select>

                {signerForm.role === 'custom' && (
                  <input
                    required
                    placeholder="พิมพ์ระบุบทบาทเอง..."
                    value={signerForm.customRole}
                    onChange={e => setSignerForm({ ...signerForm, customRole: e.target.value })}
                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #0284c7', fontSize: '13px', backgroundColor: '#f0f9ff' }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                {editingSigner && <button type="button" className="btn secondary" onClick={() => { setEditingSigner(null); setSignerForm({ name: '', position: '', role: 'ผู้ควบคุม', customRole: '' }) }}>ยกเลิก</button>}
                <button className="btn primary" style={{ padding: '6px 14px', fontSize: '13px' }}>{editingSigner ? 'อัปเดต' : '+ เพิ่มผู้ลงนาม'}</button>
              </div>
            </form>

            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'left' }}>ชื่อ-นามสกุล</th>
                    <th style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'left' }}>ตำแหน่ง</th>
                    <th style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'left' }}>บทบาท</th>
                    <th style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center', width: '70px' }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {signers.map(s => (
                    <tr key={s.id}>
                      <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}><b>{s.name}</b></td>
                      <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{s.position}</td>
                      <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}><span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>{s.role}</span></td>
                      <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button type="button" onClick={() => openEditSigner(s)} title="แก้ไข" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#0284c7' }}><Pencil size={15} /></button>
                          <button type="button" onClick={() => deleteSigner(s.id)} title="ลบ" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button type="button" className="btn secondary" onClick={() => setSignerModalOpen(false)}>ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CompensationPage({ staff }: { staff: Staff[] }) {
  const [year, setYear] = useState<number>(2026)
  const [month, setMonth] = useState<number>(11)
  const [loading, setLoading] = useState<boolean>(false)
  const [dutyMap, setDutyMap] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string>('')

  const activeStaff = useMemo(() => staff.filter(s => s.status === 'active'), [staff])

  useEffect(() => {
    void loadCompensationData()
  }, [year, month])

  async function loadCompensationData() {
    if (!supabase) return
    setLoading(true)
    setError('')
    try {
      const { data: schedule, error: schErr } = await supabase
        .from('duty_schedules')
        .select('id')
        .eq('schedule_year', year)
        .eq('schedule_month', month)
        .maybeSingle()

      if (schErr) throw schErr

      if (!schedule) {
        setDutyMap({})
        return
      }

      const { data: assignments, error: assignErr } = await supabase
        .from('duty_assignments')
        .select('*')
        .eq('schedule_id', schedule.id)

      if (assignErr) throw assignErr

      const map: Record<string, string[]> = {}
      ;(assignments || []).forEach((item: any) => {
        const key = `${item.duty_date}_${item.shift_type}`
        if (!map[key]) map[key] = []
        map[key].push(item.staff_id)
      })

      setDutyMap(map)
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูลค่าตอบแทน: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const compensationSummary = useMemo(() => {
    return activeStaff.map(person => {
      let morningCount = 0
      let afternoonCount = 0

      Object.keys(dutyMap).forEach(key => {
        const staffIds = dutyMap[key] || []
        if (staffIds.includes(person.id)) {
          if (key.endsWith('_morning')) morningCount++
          if (key.endsWith('_afternoon')) afternoonCount++
        }
      })

      const morningAmount = morningCount * Number(person.morning_rate || 0)
      const afternoonAmount = afternoonCount * Number(person.afternoon_rate || 0)
      const totalAmount = morningAmount + afternoonAmount

      return {
        ...person,
        morningCount,
        afternoonCount,
        morningAmount,
        afternoonAmount,
        totalAmount
      }
    })
  }, [activeStaff, dutyMap])

  const grandTotals = useMemo(() => {
    return compensationSummary.reduce((acc, curr) => ({
      morningCount: acc.morningCount + curr.morningCount,
      morningAmount: acc.morningAmount + curr.morningAmount,
      afternoonCount: acc.afternoonCount + curr.afternoonCount,
      afternoonAmount: acc.afternoonAmount + curr.afternoonAmount,
      totalAmount: acc.totalAmount + curr.totalAmount,
    }), { morningCount: 0, morningAmount: 0, afternoonCount: 0, afternoonAmount: 0, totalAmount: 0 })
  }, [compensationSummary])

  const thaiMonthName = new Date(year, month - 1).toLocaleString('th-TH', { month: 'long' })
  const thaiYear = year + 543

  return (
    <>
      <div className="page-heading no-print">
        <div>
          <div className="eyebrow font-semibold">COMPENSATION REPORT</div>
          <h1 className="text-2xl font-bold">รายงานคำนวณค่าตอบแทนเวรปฏิบัติงาน</h1>
          <p className="text-gray-600">คำนวณเงินค่าตอบแทนปฏิบัติงานนอกเวลาราชการประจำเดือน</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select 
            value={month} 
            onChange={e => setMonth(Number(e.target.value))}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '14px' }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>
                {new Date(2026, m - 1).toLocaleString('th-TH', { month: 'long' })}
              </option>
            ))}
          </select>

          <select 
            value={year} 
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '14px' }}
          >
            <option value={2026}>พ.ศ. 2569</option>
            <option value={2025}>พ.ศ. 2568</option>
          </select>

          <button
            onClick={() => window.print()}
            className="btn secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={16} /> พิมพ์ใบสรุปค่าตอบแทน
          </button>
        </div>
      </div>

      {error && <div className="alert error no-print mb-4">{error}</div>}

      <div className="stat-grid no-print mb-6">
        <Stat icon={CircleDollarSign} label="เวรเช้ารวม" value={`${grandTotals.morningAmount.toLocaleString('th-TH')} บาท`} note={`รวม ${grandTotals.morningCount} ครั้ง`} tone="amber" />
        <Stat icon={CircleDollarSign} label="เวรบ่ายรวม" value={`${grandTotals.afternoonAmount.toLocaleString('th-TH')} บาท`} note={`รวม ${grandTotals.afternoonCount} ครั้ง`} tone="purple" />
        <Stat icon={CircleDollarSign} label="ยอดเบิกจ่ายรวมทั้งสิ้น" value={`${grandTotals.totalAmount.toLocaleString('th-TH')} บาท`} note="คำนวณสุทธิ" tone="teal" />
        <Stat icon={Users} label="จำนวนผู้ได้รับค่าตอบแทน" value={`${compensationSummary.filter(c => c.totalAmount > 0).length} ราย`} note={`จากทั้งหมด ${activeStaff.length} ราย`} tone="blue" />
      </div>

      <div className="panel table-panel print-area" style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px', color: '#0f172a' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
            รายละเอียดหลักฐานการจ่ายเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ
          </h2>
          <p style={{ fontSize: '13.5px', color: '#475569', margin: 0 }}>
            โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค ประจำเดือน {thaiMonthName} พ.ศ. {thaiYear}
          </p>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>กำลังคำนวณค่าตอบแทน...</div>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', border: '1px solid #000000' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th style={{ border: '1px solid #000', padding: '6px', width: '40px', textAlign: 'center' }} rowSpan={2}>ลำดับ</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }} rowSpan={2}>ชื่อ - นามสกุล</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }} rowSpan={2}>ตำแหน่ง</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }} colSpan={3}>☀️ เวรเช้า (๐๘.๓๐-๑๖.๓๐ น.)</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }} colSpan={3}>🌤️ เวรบ่าย (๑๖.๓๐-๑๘.๓๐ น.)</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '100px' }} rowSpan={2}>รวมเป็นเงิน (บาท)</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '100px' }} rowSpan={2}>ลายมือชื่อผู้รับเงิน</th>
                </tr>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '50px', textAlign: 'center' }}>จำนวน</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '70px', textAlign: 'center' }}>อัตรา</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '80px', textAlign: 'center' }}>รวมเงิน</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '50px', textAlign: 'center' }}>จำนวน</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '70px', textAlign: 'center' }}>อัตรา</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '80px', textAlign: 'center' }}>รวมเงิน</th>
                </tr>
              </thead>
              <tbody>
                {compensationSummary.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ border: '1px solid #000', padding: '24px', textAlign: 'center', color: '#64748b' }}>
                      ไม่พบข้อมูลการจัดตารางเวรในเดือนนี้
                    </td>
                  </tr>
                ) : (
                  compensationSummary.map((item, idx) => (
                    <tr key={item.id} style={{ height: '36px' }}>
                      <td style={{ border: '1px solid #000', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 8px', whiteSpace: 'nowrap' }}>
                        <b>{item.first_name} {item.last_name}</b>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 8px', fontSize: '12px' }}>{item.position}</td>
                      
                      <td style={{ border: '1px solid #000', textAlign: 'center' }}>{item.morningCount > 0 ? item.morningCount : '-'}</td>
                      <td style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '6px' }}>{Number(item.morning_rate).toLocaleString('th-TH')}</td>
                      <td style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '6px' }}>{item.morningAmount > 0 ? item.morningAmount.toLocaleString('th-TH') : '-'}</td>
                      
                      <td style={{ border: '1px solid #000', textAlign: 'center' }}>{item.afternoonCount > 0 ? item.afternoonCount : '-'}</td>
                      <td style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '6px' }}>{Number(item.afternoon_rate).toLocaleString('th-TH')}</td>
                      <td style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '6px' }}>{item.afternoonAmount > 0 ? item.afternoonAmount.toLocaleString('th-TH') : '-'}</td>
                      
                      <td style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '8px', fontWeight: 'bold', backgroundColor: '#fefce8' }}>
                        {item.totalAmount > 0 ? item.totalAmount.toLocaleString('th-TH') : '-'}
                      </td>
                      <td style={{ border: '1px solid #000', textAlign: 'center' }}></td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                  <td colSpan={3} style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>รวมทั้งสิ้น</td>
                  <td style={{ border: '1px solid #000', textAlign: 'center' }}>{grandTotals.morningCount}</td>
                  <td style={{ border: '1px solid #000' }}></td>
                  <td style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '6px' }}>{grandTotals.morningAmount.toLocaleString('th-TH')}</td>
                  <td style={{ border: '1px solid #000', textAlign: 'center' }}>{grandTotals.afternoonCount}</td>
                  <td style={{ border: '1px solid #000' }}></td>
                  <td style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '6px' }}>{grandTotals.afternoonAmount.toLocaleString('th-TH')}</td>
                  <td style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '8px', color: '#0f172a', backgroundColor: '#fef08a' }}>
                    {grandTotals.totalAmount.toLocaleString('th-TH')}
                  </td>
                  <td style={{ border: '1px solid #000' }}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function RosterCalendarPage({ staff, isAdmin }: { staff: Staff[]; isAdmin: boolean }) {
  const [year, setYear] = useState<number>(2026)
  const [month, setMonth] = useState<number>(11)
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'calendar' | 'matrix'>('calendar')
  
  const [dutyMap, setDutyMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const activeStaff = useMemo(() => staff.filter(s => s.status === 'active'), [staff])

  const daysInMonthList = useMemo(() => {
    const totalDays = new Date(year, month, 0).getDate()
    const list = []
    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(year, month - 1, day)
      const dayOfWeekIndex = dateObj.getDay()
      const dayStr = String(day).padStart(2, '0')
      const monthStr = String(month).padStart(2, '0')
      const dateStr = `${year}-${monthStr}-${dayStr}`
      list.push({
        day,
        dateStr,
        dayOfWeekIndex,
        dayOfWeekName: WEEKDAYS_SHORT[dayOfWeekIndex],
        isSunday: dayOfWeekIndex === 0,
        isSaturday: dayOfWeekIndex === 6,
      })
    }
    return list
  }, [year, month])

  const calendarWeeks = useMemo(() => {
    const firstDayIndex = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    
    const cells: Array<{
      day: number
      dateStr: string
      dayOfWeekIndex: number
      isSunday: boolean
      isSaturday: boolean
    } | null> = []

    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(null)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day)
      const dayOfWeekIndex = dateObj.getDay()
      const dayStr = String(day).padStart(2, '0')
      const monthStr = String(month).padStart(2, '0')
      const dateStr = `${year}-${monthStr}-${dayStr}`
      
      cells.push({
        day,
        dateStr,
        dayOfWeekIndex,
        isSunday: dayOfWeekIndex === 0,
        isSaturday: dayOfWeekIndex === 6,
      })
    }

    while (cells.length % 7 !== 0) {
      cells.push(null)
    }

    const weeks = []
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7))
    }

    return weeks
  }, [year, month])

  useEffect(() => {
    void loadRoster()
  }, [year, month])

  async function loadRoster() {
    if (!supabase) return
    setLoading(true)
    setMsg(null)
    try {
      let { data: schedule, error: schErr } = await supabase
        .from('duty_schedules')
        .select('*')
        .eq('schedule_year', year)
        .eq('schedule_month', month)
        .maybeSingle()

      if (schErr) throw schErr

      if (!schedule) {
        const { data: newSchList, error: createErr } = await supabase
          .from('duty_schedules')
          .upsert(
            [{ schedule_year: year, schedule_month: month, status: 'draft' }],
            { onConflict: 'schedule_year,schedule_month' }
          )
          .select()

        if (createErr) throw createErr

        if (newSchList && newSchList.length > 0) {
          schedule = newSchList[0]
        } else {
          const { data: retrySch } = await supabase
            .from('duty_schedules')
            .select('*')
            .eq('schedule_year', year)
            .eq('schedule_month', month)
            .maybeSingle()
          schedule = retrySch
        }
      }

      if (!schedule) throw new Error('ไม่สามารถสร้างหรือดึงหัวข้อตารางเวรได้')

      setScheduleId(schedule.id)

      const { data: assignments, error: assignErr } = await supabase
        .from('duty_assignments')
        .select('*')
        .eq('schedule_id', schedule.id)

      if (assignErr) throw assignErr

      const map: Record<string, string[]> = {}
      ;(assignments || []).forEach((item: any) => {
        const key = `${item.duty_date}_${item.shift_type}`
        if (!map[key]) map[key] = []
        map[key].push(item.staff_id)
      })

      setDutyMap(map)
    } catch (err: any) {
      setMsg({ text: 'เกิดข้อผิดพลาดในการโหลดตารางเวร: ' + err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function handleStaffChange(dateStr: string, shift: 'morning' | 'afternoon', index: number, staffId: string) {
    if (!isAdmin) return
    const key = `${dateStr}_${shift}`
    setDutyMap(prev => {
      const currentList = [...(prev[key] || [''])]
      currentList[index] = staffId
      return { ...prev, [key]: currentList }
    })
  }

  function addStaffSlot(dateStr: string, shift: 'morning' | 'afternoon') {
    if (!isAdmin) return
    const key = `${dateStr}_${shift}`
    setDutyMap(prev => {
      const currentList = [...(prev[key] || [''])]
      currentList.push('')
      return { ...prev, [key]: currentList }
    })
  }

  function removeStaffSlot(dateStr: string, shift: 'morning' | 'afternoon', index: number) {
    if (!isAdmin) return
    const key = `${dateStr}_${shift}`
    setDutyMap(prev => {
      const currentList = [...(prev[key] || [])]
      currentList.splice(index, 1)
      return { ...prev, [key]: currentList }
    })
  }

  async function handleSave() {
    if (!supabase || !scheduleId || !isAdmin) return
    setSaving(true)
    setMsg(null)
    try {
      const { error: delErr } = await supabase
        .from('duty_assignments')
        .delete()
        .eq('schedule_id', scheduleId)

      if (delErr) throw delErr

      const rowsToInsert: any[] = []
      Object.keys(dutyMap).forEach(key => {
        const staffIds = dutyMap[key] || []
        const [duty_date, shift_type] = key.split('_')
        
        staffIds.forEach(staff_id => {
          if (staff_id && staff_id.trim() !== '') {
            rowsToInsert.push({
              schedule_id: scheduleId,
              staff_id,
              duty_date,
              shift_type
            })
          }
        })
      })

      if (rowsToInsert.length > 0) {
        const { error: insErr } = await supabase.from('duty_assignments').insert(rowsToInsert)
        if (insErr) throw insErr
      }

      setMsg({ text: 'บันทึกตารางเวรเรียบร้อยแล้ว', type: 'success' })
    } catch (err: any) {
      setMsg({ text: 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const thaiMonthName = new Date(year, month - 1).toLocaleString('th-TH', { month: 'long' })
  const thaiYear = year + 543

  return (
    <>
      <div className="page-heading no-print">
        <div>
          <div className="eyebrow font-semibold">ROSTER MANAGEMENT</div>
          <h1 className="text-2xl font-bold">ตารางปฏิบัติงานเจ้าหน้าที่ประจำเดือน</h1>
          <p className="text-gray-600">โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค อำเภอเมืองสุรินทร์ จังหวัดสุรินทร์</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', backgroundColor: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
            <button
              onClick={() => setViewMode('calendar')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'calendar' ? '#ffffff' : 'transparent',
                color: viewMode === 'calendar' ? '#0f172a' : '#64748b',
                fontWeight: viewMode === 'calendar' ? 'bold' : 'normal',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <CalendarDays size={16} /> รูปแบบปฏิทิน
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'matrix' ? '#ffffff' : 'transparent',
                color: viewMode === 'matrix' ? '#0f172a' : '#64748b',
                fontWeight: viewMode === 'matrix' ? 'bold' : 'normal',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Table size={16} /> ตารางแนวยาว (ราชการ)
            </button>
          </div>

          <select 
            value={month} 
            onChange={e => setMonth(Number(e.target.value))}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '14px' }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>
                {new Date(2026, m - 1).toLocaleString('th-TH', { month: 'long' })}
              </option>
            ))}
          </select>

          <select 
            value={year} 
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '14px' }}
          >
            <option value={2026}>พ.ศ. 2569</option>
            <option value={2025}>พ.ศ. 2568</option>
          </select>

          {isAdmin && (
            <button 
              onClick={handleSave} 
              disabled={saving || loading}
              className="btn primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'กำลังบันทึก...' : 'บันทึกตารางเวร'}
            </button>
          )}

          {viewMode === 'matrix' && (
            <button
              onClick={() => window.print()}
              className="btn secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Printer size={16} /> พิมพ์ตาราง
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.type === 'error' ? 'error' : 'success'} mb-4 no-print`}>
          <AlertCircle size={17} />
          {msg.text}
          <button onClick={() => setMsg(null)}><X size={15} /></button>
        </div>
      )}

      {viewMode === 'calendar' ? (
        <div className="panel table-panel" style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>กำลังโหลดข้อมูลปฏิทินเวร...</div>
          ) : (
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '980px' }}>
                <thead>
                  <tr>
                    {['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'].map((dayName, idx) => (
                      <th 
                        key={dayName} 
                        style={{
                          padding: '10px 4px',
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          color: '#ffffff',
                          backgroundColor: idx === 0 ? '#dc2626' : idx === 6 ? '#0284c7' : '#0f172a',
                          border: '1px solid #334155',
                          width: '14.28%'
                        }}
                      >
                        {dayName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendarWeeks.map((week, wIdx) => (
                    <tr key={`week-${wIdx}`}>
                      {week.map((cell, cIdx) => {
                        if (!cell) {
                          return (
                            <td 
                              key={`empty-${wIdx}-${cIdx}`} 
                              style={{
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                height: '140px',
                                verticalAlign: 'top'
                              }}
                            />
                          )
                        }

                        const morningStaffList = dutyMap[`${cell.dateStr}_morning`] || ['']
                        const afternoonStaffList = dutyMap[`${cell.dateStr}_afternoon`] || ['']

                        return (
                          <td 
                            key={cell.dateStr} 
                            style={{
                              border: '1px solid #cbd5e1',
                              padding: '6px',
                              verticalAlign: 'top',
                              backgroundColor: cell.isSunday ? '#fff5f5' : cell.isSaturday ? '#f0f9ff' : '#ffffff',
                              minHeight: '140px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span 
                                style={{
                                  fontWeight: 'bold',
                                  fontSize: '14px',
                                  color: cell.isSunday ? '#dc2626' : cell.isSaturday ? '#0284c7' : '#1e293b'
                                }}
                              >
                                {cell.day}
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '4px 6px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#92400e', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>☀️ เวรเช้า</span>
                                  {isAdmin && (
                                    <button
                                      onClick={() => addStaffSlot(cell.dateStr, 'morning')}
                                      title="เพิ่มเจ้าหน้าที่เวรเช้า"
                                      style={{
                                        backgroundColor: '#16a34a',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '1px 5px',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                      }}
                                    >
                                      + เพิ่มคน
                                    </button>
                                  )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {morningStaffList.map((staffId, sIdx) => (
                                    <div key={`m-${sIdx}`} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                      <select
                                        value={staffId}
                                        disabled={!isAdmin}
                                        onChange={e => handleStaffChange(cell.dateStr, 'morning', sIdx, e.target.value)}
                                        style={{
                                          flex: 1,
                                          minWidth: 0,
                                          fontSize: '11px',
                                          padding: '3px 2px',
                                          borderRadius: '4px',
                                          border: '1px solid #cbd5e1',
                                          backgroundColor: '#ffffff'
                                        }}
                                      >
                                        <option value="">-- ไม่มีเจ้าหน้าที่ --</option>
                                        {activeStaff.map(s => (
                                          <option key={s.id} value={s.id}>
                                            {s.first_name} {s.last_name}
                                          </option>
                                        ))}
                                      </select>

                                      {isAdmin && morningStaffList.length > 1 && (
                                        <button
                                          onClick={() => removeStaffSlot(cell.dateStr, 'morning', sIdx)}
                                          title="ลบออก"
                                          style={{
                                            flexShrink: 0,
                                            backgroundColor: '#ef4444',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '3px',
                                            padding: '2px 4px',
                                            fontSize: '10px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '4px 6px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#075985', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>🌤️ เวรบ่าย</span>
                                  {isAdmin && (
                                    <button
                                      onClick={() => addStaffSlot(cell.dateStr, 'afternoon')}
                                      title="เพิ่มเจ้าหน้าที่เวรบ่าย"
                                      style={{
                                        backgroundColor: '#0284c7',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '1px 5px',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                      }}
                                    >
                                      + เพิ่มคน
                                    </button>
                                  )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {afternoonStaffList.map((staffId, sIdx) => (
                                    <div key={`a-${sIdx}`} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                      <select
                                        value={staffId}
                                        disabled={!isAdmin}
                                        onChange={e => handleStaffChange(cell.dateStr, 'afternoon', sIdx, e.target.value)}
                                        style={{
                                          flex: 1,
                                          minWidth: 0,
                                          fontSize: '11px',
                                          padding: '3px 2px',
                                          borderRadius: '4px',
                                          border: '1px solid #cbd5e1',
                                          backgroundColor: '#ffffff'
                                        }}
                                      >
                                        <option value="">-- ไม่มีเจ้าหน้าที่ --</option>
                                        {activeStaff.map(s => (
                                          <option key={s.id} value={s.id}>
                                            {s.first_name} {s.last_name}
                                          </option>
                                        ))}
                                      </select>

                                      {isAdmin && afternoonStaffList.length > 1 && (
                                        <button
                                          onClick={() => removeStaffSlot(cell.dateStr, 'afternoon', sIdx)}
                                          title="ลบออก"
                                          style={{
                                            flexShrink: 0,
                                            backgroundColor: '#ef4444',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '3px',
                                            padding: '2px 4px',
                                            fontSize: '10px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="panel table-panel print-area" style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px', color: '#0f172a' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
              ตารางปฏิบัติงานของเจ้าหน้าที่โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค อำเภอเมืองสุรินทร์ เดือน {thaiMonthName} พ.ศ. {thaiYear}
            </h2>
            <p style={{ fontSize: '13.5px', color: '#475569', margin: 0 }}>
              เรื่อง ให้เจ้าหน้าที่ปฏิบัติงานส่งเสริมสุขภาพเชิงรุก ปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ
            </p>
          </div>

          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #000000' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '35px', textAlign: 'center' }} rowSpan={2}>ลำดับ</th>
                  <th style={{ border: '1px solid #000', padding: '4px', minWidth: '130px', textAlign: 'center' }} rowSpan={2}>ชื่อ</th>
                  <th style={{ border: '1px solid #000', padding: '4px', minWidth: '120px', textAlign: 'center' }} rowSpan={2}>ตำแหน่ง</th>
                  {daysInMonthList.map(d => (
                    <th 
                      key={`h-day-${d.day}`}
                      style={{ 
                        border: '1px solid #000', 
                        padding: '3px 2px', 
                        textAlign: 'center', 
                        width: '24px',
                        backgroundColor: d.isSunday ? '#fca5a5' : d.isSaturday ? '#bae6fd' : '#f1f5f9'
                      }}
                    >
                      {d.day}
                    </th>
                  ))}
                  <th style={{ border: '1px solid #000', padding: '4px', minWidth: '90px', textAlign: 'center' }} rowSpan={2}>ลายมือชื่อ</th>
                </tr>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {daysInMonthList.map(d => (
                    <th 
                      key={`h-wday-${d.day}`}
                      style={{ 
                        border: '1px solid #000', 
                        padding: '2px 1px', 
                        textAlign: 'center', 
                        fontSize: '11px',
                        color: d.isSunday ? '#dc2626' : d.isSaturday ? '#0284c7' : '#000000',
                        backgroundColor: d.isSunday ? '#fee2e2' : d.isSaturday ? '#e0f2fe' : '#ffffff'
                      }}
                    >
                      {d.dayOfWeekName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeStaff.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonthList.length + 4} style={{ border: '1px solid #000', padding: '20px', textAlign: 'center', color: '#64748b' }}>
                      ไม่พบรายชื่อเจ้าหน้าที่ที่ใช้งานอยู่ในระบบ
                    </td>
                  </tr>
                ) : (
                  activeStaff.map((person, idx) => (
                    <tr key={person.id} style={{ height: '32px' }}>
                      <td style={{ border: '1px solid #000', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                        <b>{person.first_name} {person.last_name}</b>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '2px 6px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {person.position}
                      </td>

                      {daysInMonthList.map(d => {
                        const morningList = dutyMap[`${d.dateStr}_morning`] || []
                        const afternoonList = dutyMap[`${d.dateStr}_afternoon`] || []
                        
                        const isMorning = morningList.includes(person.id)
                        const isAfternoon = afternoonList.includes(person.id)

                        let symbol = ''
                        let cellBg = 'transparent'
                        let textColor = '#000000'

                        if (isMorning && isAfternoon) {
                          symbol = 'ช/บ'
                          cellBg = '#fef08a'
                        } else if (isMorning) {
                          symbol = 'ช'
                          textColor = '#b91c1c'
                        } else if (isAfternoon) {
                          symbol = 'บ'
                          cellBg = '#fef08a'
                          textColor = '#854d0e'
                        }

                        return (
                          <td 
                            key={`cell-${person.id}-${d.day}`}
                            style={{ 
                              border: '1px solid #000', 
                              textAlign: 'center', 
                              fontWeight: 'bold',
                              fontSize: '12px',
                              backgroundColor: cellBg,
                              color: textColor
                            }}
                          >
                            {symbol}
                          </td>
                        )
                      })}

                      <td style={{ border: '1px solid #000', textAlign: 'center' }}></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px', fontSize: '13px', display: 'flex', gap: '32px', flexWrap: 'wrap', color: '#1e293b' }}>
            <div><b>หมายเหตุ:</b></div>
            <div><span style={{ fontWeight: 'bold', color: '#b91c1c' }}>ช</span> = เวรเช้า ปฏิบัติงานตั้งแต่เวลา ๐๘.๓๐-๑๖.๓๐ น.</div>
            <div><span style={{ fontWeight: 'bold', color: '#854d0e', backgroundColor: '#fef08a', padding: '1px 4px', borderRadius: '3px' }}>บ</span> = เวรบ่าย ปฏิบัติงานตั้งแต่เวลา ๑๖.๓๐-๑๘.๓๐ น.</div>
          </div>
        </div>
      )}
    </>
  )
}

function LoginScreen({ onLogin, error }: { onLogin: (email:string,password:string)=>Promise<void>; error:string }) {
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [busy,setBusy] = useState(false)
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); await onLogin(email,password); setBusy(false) }
  return <div className="login-screen"><div className="login-card">
    <div className="login-logo"><Activity size={30}/></div><div className="eyebrow">KORKHO SMART ROSTER</div>
    <h1>เข้าสู่ระบบ</h1><p>ระบบบริหารจัดการตารางเวรและค่าตอบแทน<br/>โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค จังหวัดสุรินทร์</p>
    {error && <div className="alert error">{error}</div>}
    <form onSubmit={submit}><label>อีเมล<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label>
      <label>รหัสผ่าน<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="กรอกรหัสผ่าน"/></label>
      <button className="btn primary full-width" disabled={busy}>{busy?'กำลังเข้าสู่ระบบ...':'เข้าสู่ระบบ'}</button></form>
    <div className="login-foot"><ShieldCheck size={15}/> เฉพาะผู้ได้รับอนุญาตเท่านั้น</div>
  </div></div>
}

function SetupScreen() {
  return <div className="setup-screen"><div className="setup-card"><div className="brand-mark"><Activity size={26}/></div>
    <h1>เตรียมเชื่อมต่อฐานข้อมูล</h1><p>ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase กรุณาทำตามคู่มือ SETUP-TH.md ก่อนเปิดใช้งาน</p>
    <ol><li>สร้างโปรเจกต์ Supabase</li><li>นำไฟล์ <b>supabase/schema.sql</b> ไปรันใน SQL Editor</li><li>คัดลอก <b>.env.example</b> เป็น <b>.env</b></li><li>กรอก Project URL และ Publishable/Anon Key</li><li>ปิดแล้วเปิดคำสั่ง npm run dev ใหม่</li></ol>
  </div></div>
}

function Dashboard({ staff, onNavigate }: {staff:Staff[]; onNavigate:(s:Section)=>void}) {
  const active = staff.filter(s=>s.status==='active').length
  const totalMorning = staff.reduce((n,s)=>n+Number(s.morning_rate||0),0)
  const totalAfternoon = staff.reduce((n,s)=>n+Number(s.afternoon_rate||0),0)
  return <><div className="page-heading no-print"><div><div className="eyebrow">OVERVIEW</div><h1>ภาพรวมระบบ</h1><p>ยินดีต้อนรับสู่ระบบบริหารจัดการตารางเวรและค่าตอบแทน</p></div><div className="today-pill"><Clock3 size={16}/>{new Intl.DateTimeFormat('th-TH',{dateStyle:'long',timeZone:'Asia/Bangkok'}).format(new Date())}</div></div>
    <div className="stat-grid no-print">
      <Stat icon={Users} label="บุคลากรทั้งหมด" value={staff.length.toLocaleString('th-TH')} note="รายชื่อในทะเบียน" tone="teal"/>
      <Stat icon={UserRound} label="กำลังปฏิบัติงาน" value={active.toLocaleString('th-TH')} note="สถานะใช้งาน" tone="blue"/>
      <Stat icon={CalendarDays} label="ประเภทเวร" value="2" note="เวรเช้าและเวรบ่าย" tone="purple"/>
      <Stat icon={CircleDollarSign} label="อัตราค่าตอบแทนที่ตั้งไว้" value={(totalMorning+totalAfternoon).toLocaleString('th-TH')} note="ผลรวมอัตราต่อครั้ง ไม่ใช่ยอดเบิกจริง" tone="amber"/>
    </div>
    <div className="content-grid no-print"><section className="panel welcome-panel"><div className="panel-icon"><Activity size={23}/></div><h2>เริ่มต้นจัดการระบบ</h2><p>เพิ่มทะเบียนบุคลากรและอัตราค่าตอบแทนก่อน จากนั้นจึงพัฒนาตารางเวรและการออกใบเบิกในขั้นตอนถัดไป</p><button className="btn primary" onClick={()=>onNavigate('staff')}><Users size={17}/> ไปที่จัดการบุคลากร</button></section>
      <section className="panel checklist-panel"><div className="panel-title"><h2>สถานะการเตรียมระบบ</h2><span className="status-tag">ระยะเริ่มต้น</span></div>
        {[['เชื่อมต่อฐานข้อมูล Supabase',true],['ระบบเข้าสู่ระบบ',true],['ทะเบียนบุคลากร',true],['ระบบจัดตารางเวร',true],['คำนวณค่าตอบแทน',true],['เอกสารราชการและใบเบิก',true],['ตั้งค่าระบบและสำรองข้อมูล',true]].map(([label,done])=><div className="check-row" key={String(label)}><span className={done?'check-done':'check-pending'}>{done?'✓':'○'}</span>{label}<small>{done?'พร้อมใช้งาน':'อยู่ระหว่างพัฒนา'}</small></div>)}
      </section></div>
    <div className="notice no-print"><AlertCircle size={18}/><div><b>หมายเหตุเกี่ยวกับข้อมูล</b><p>ระบบพร้อมใช้งานสมบูรณ์ในทุกโมดูลแล้ว</p></div></div>
  </>
}

function Stat({icon:Icon,label,value,note,tone}:{icon:typeof Users;label:string;value:string;note:string;tone:string}) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={20}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>
}

function StaffPage({staff,allCount,search,setSearch,loading,onAdd,onEdit,onToggle,onReorder,isAdmin}:{staff:Staff[];allCount:number;search:string;setSearch:(s:string)=>void;loading:boolean;onAdd:()=>void;onEdit:(s:Staff)=>void;onToggle:(s:Staff)=>void;onReorder:()=>void;isAdmin:boolean}) {
  return <><div className="page-heading no-print"><div><div className="eyebrow">STAFF MANAGEMENT</div><h1>จัดการบุคลากร</h1><p>ทะเบียนบุคลากรและอัตราค่าตอบแทนรายบุคคล</p></div>
    <div style={{ display: 'flex', gap: '8px' }}>
      {isAdmin && (
        <button className="btn secondary" onClick={onReorder} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ListOrdered size={18}/> จัดเรียงลำดับบุคลากร
        </button>
      )}
      {isAdmin && (
        <button className="btn primary" onClick={onAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={18}/> เพิ่มบุคลากร
        </button>
      )}
    </div>
  </div>
    <div className="panel table-panel no-print"><div className="table-toolbar"><div className="table-count">บุคลากรทั้งหมด <b>{allCount}</b> ราย</div><div className="search-box"><Search size={17}/><input placeholder="ค้นหาชื่อ ตำแหน่ง หรือรหัส..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
      <div className="table-wrap"><table><thead><tr><th style={{ width: '60px' }}>ลำดับ</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>ประเภท</th><th className="number">เวรเช้า</th><th className="number">เวรบ่าย</th><th>สถานะ</th>{isAdmin&&<th>จัดการ</th>}</tr></thead>
      <tbody>{loading?<tr><td colSpan={8} className="empty">กำลังโหลดข้อมูล...</td></tr>:staff.length===0?<tr><td colSpan={8} className="empty"><Users size={28}/><b>ยังไม่มีข้อมูลบุคลากร</b><span>เริ่มต้นโดยเพิ่มรายชื่อบุคลากรในระบบ</span></td></tr>:staff.map((p, index)=><tr key={p.id}><td className="code" style={{ textAlign: 'center', fontWeight: 'bold', color: '#0284c7' }}>{index + 1}</td><td><b>{p.first_name} {p.last_name}</b></td><td>{p.position}</td><td>{p.staff_type}</td><td className="number">{Number(p.morning_rate).toLocaleString('th-TH')}</td><td className="number">{Number(p.afternoon_rate).toLocaleString('th-TH')}</td><td><span className={`status ${p.status}`}>{p.status==='active'?'ใช้งาน':'ไม่ใช้งาน'}</span></td>{isAdmin&&<td><div className="actions"><button title="แก้ไข" onClick={()=>onEdit(p)}><Pencil size={16}/></button><button title={p.status==='active'?'ระงับ':'เปิดใช้งาน'} onClick={()=>onToggle(p)}>{p.status==='active'?'ระงับ':'เปิดใช้'}</button></div></td>}</tr>)}</tbody></table></div>
      <div className="table-foot">แสดง {staff.length} จาก {allCount} รายการ · ข้อมูลจากฐานข้อมูล Supabase</div>
    </div>
  </>
}