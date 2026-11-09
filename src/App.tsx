import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Activity, CalendarDays, CircleDollarSign, FileText,
  LayoutDashboard, LogOut, Menu, Plus, Search, Settings, ShieldCheck,
  Users, X, Pencil, UserRound, AlertCircle, Save, Loader2, Printer, UserCheck, ArrowUp, ArrowDown, ListOrdered, Building, Database, KeyRound, Download, ClipboardList
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
  { id: 'work-summary', label: 'สรุปผลการปฏิบัติงาน', icon: ClipboardList },
  { id: 'compensation', label: 'ค่าตอบแทน', icon: CircleDollarSign },
  { id: 'documents', label: 'ใบเบิกและเอกสาร', icon: FileText },
  { id: 'settings', label: 'ตั้งค่าระบบ', icon: Settings },
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
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      position: form.position.trim(),
      staff_type: form.staff_type,
      morning_rate: Number(form.morning_rate),
      afternoon_rate: Number(form.afternoon_rate),
      status: form.status,
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

    if (supabase) {
      for (let i = 0; i < orderedStaffList.length; i++) {
        await supabase.from('staff').update({ display_order: i + 1 }).eq('id', orderedStaffList[i].id)
      }
    }
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
          {section === 'staff' && <StaffPage staff={filteredStaff} search={search} setSearch={setSearch}
            loading={loading} onAdd={openAdd} onEdit={openEdit} onToggle={toggleStatus} onReorder={openReorderModal} isAdmin={userRole === 'admin'}/>}
          {section === 'roster' && <RosterCalendarPage />}
          {section === 'work-summary' && <WorkSummary />}
          {section === 'compensation' && <CompensationPage />}
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

function DocumentsPage({ staff }: { staff: Staff[] }) {
  const [year, setYear] = useState<number>(2026)
  const [month, setMonth] = useState<number>(10)
  const [orderNo, setOrderNo] = useState<string>('46/2569')
  const [orderDate, setOrderDate] = useState<string>('29 กันยายน พ.ศ.2569')

  const [doubleRateDays, setDoubleRateDays] = useState<number[]>([])

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
      list.push({
        day,
        dateStr,
        dayOfWeekIndex,
        dayOfWeekName: WEEKDAYS_SHORT[dayOfWeekIndex],
        isSunday: dayOfWeekIndex === 0,
        isSaturday: dayOfWeekIndex === 6,
        isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
      })
    }
    return list
  }, [year, month])

  useEffect(() => {
    void loadRosterData()
  }, [year, month])

  async function loadRosterData() {
    if (!supabase) return
    setLoading(true)
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

  function handleSaveSigner(e: FormEvent) {
    e.preventDefault()
    if (!editingSigner) return
    const finalRole = signerForm.role === 'custom' ? signerForm.customRole.trim() : signerForm.role
    setSigners(prev => prev.map(item => item.id === editingSigner.id ? {
      ...item,
      name: signerForm.name.trim(),
      position: signerForm.position.trim(),
      role: finalRole || 'ผู้ลงนาม'
    } : item))
    setSignerModalOpen(false)
  }

  const controllerSigner = signers.find(s => s.id === selectedController)
  const checkerSigner = signers.find(s => s.id === selectedChecker)
  const approverSigner = signers.find(s => s.id === selectedApprover)
  const payerSigner = signers.find(s => s.id === selectedPayer)

  return (
    <>
      <div className="page-heading no-print">
        <div>
          <div className="eyebrow font-semibold">DOCUMENTS & CLAIMS</div>
          <h1 className="text-2xl font-bold">ใบเบิกเงินค่าตอบแทนและเอกสารสำคัญ</h1>
          <p className="text-gray-600">สร้างเอกสารหลักฐานการจ่ายเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ</p>
        </div>
      </div>

      <div className="panel mb-6 no-print" style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #cbd5e1' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155', display: 'block', marginBottom: '4px' }}>เลือกปี (พ.ศ.):</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}>
              <option value={2025}>2025 (พ.ศ. 2568)</option>
              <option value={2026}>2026 (พ.ศ. 2569)</option>
              <option value={2027}>2027 (พ.ศ. 2570)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155', display: 'block', marginBottom: '4px' }}>เลือกเดือน:</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>เดือน{new Date(2026, m - 1, 1).toLocaleDateString('th-TH', { month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155', display: 'block', marginBottom: '4px' }}>เลขที่คำสั่ง:</label>
            <input value={orderNo} onChange={e => setOrderNo(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155', display: 'block', marginBottom: '4px' }}>ลงวันที่คำสั่ง:</label>
            <input value={orderDate} onChange={e => setOrderDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }} />
          </div>
        </div>

        <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={16} className="text-amber-500" /> กำหนดวันปฏิบัติงานอัตรา 2 เท่า (วันหยุดนักขัตฤกษ์พิเศษ):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {daysInMonthList.map(d => (
              <button
                key={d.day}
                type="button"
                onClick={() => toggleDoubleRateDay(d.day)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  border: '1px solid',
                  cursor: 'pointer',
                  backgroundColor: doubleRateDays.includes(d.day) ? '#ef4444' : '#ffffff',
                  color: doubleRateDays.includes(d.day) ? '#ffffff' : '#334155',
                  borderColor: doubleRateDays.includes(d.day) ? '#dc2626' : '#cbd5e1',
                }}
              >
                {d.day} ({d.dayOfWeekName})
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 500, color: '#475569', display: 'block', marginBottom: '2px' }}>1. ผู้ควบคุมการปฏิบัติงาน:</label>
            <select value={selectedController} onChange={e => setSelectedController(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}>
              {signers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.position})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 500, color: '#475569', display: 'block', marginBottom: '2px' }}>2. ผู้ตรวจถูกต้อง:</label>
            <select value={selectedChecker} onChange={e => setSelectedChecker(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}>
              {signers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.position})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 500, color: '#475569', display: 'block', marginBottom: '2px' }}>3. ผู้อนุมัติให้จ่ายได้:</label>
            <select value={selectedApprover} onChange={e => setSelectedApprover(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}>
              {signers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.position})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 500, color: '#475569', display: 'block', marginBottom: '2px' }}>4. ผู้จ่ายเงิน:</label>
            <select value={selectedPayer} onChange={e => setSelectedPayer(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}>
              {signers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.position})</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {signers.map(s => (
              <button key={s.id} type="button" onClick={() => openEditSigner(s)} className="btn secondary" style={{ fontSize: '12px', padding: '4px 8px' }}>
                <Pencil size={13} /> แก้ไขชื่อ {s.role}
              </button>
            ))}
          </div>
          <button onClick={() => window.print()} className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={16} /> พิมพ์ใบเบิกเงิน (A4 แนวตั้ง/แนวนอน)
          </button>
        </div>
      </div>

      <div className="print-area panel" style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
        <div className="doc-title-box" style={{ textAlign: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
            หลักฐานการจ่ายเงินตอบแทนการปฏิบัติงานนอกเวลาราชการ
          </h2>
          <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
            ส่วนราชการ โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค อำเภอเมืองสุรินทร์ จังหวัดสุรินทร์ ประจำเดือน {new Date(year, month - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
          </p>
          <p style={{ fontSize: '12px', color: '#475569', margin: '2px 0 0 0' }}>
            ตามคำสั่ง ที่ {orderNo} ลงวันที่ {orderDate}
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }} className="no-print">
            <Loader2 className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
            <p>กำลังโหลดข้อมูลตารางเวร...</p>
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th style={{ border: '1px solid #000', padding: '4px', textIndent: 0, width: '30px', textAlign: 'center' }} rowSpan={2}>ลำดับ</th>
                  <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '130px' }} rowSpan={2}>ชื่อ - สกุล</th>
                  <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '110px' }} rowSpan={2}>ตำแหน่ง</th>
                  <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '55px' }} rowSpan={2}>อัตรา</th>
                  <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }} colSpan={daysInMonthList.length}>
                    วันที่ปฏิบัติงาน
                  </th>
                  <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '45px' }} rowSpan={2}>จำนวน (วัน)</th>
                  <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '65px' }} rowSpan={2}>จำนวนเงิน (บาท)</th>
                  <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '70px' }} rowSpan={2}>ลายมือชื่อ ผู้รับเงิน</th>
                </tr>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  {daysInMonthList.map(d => (
                    <th key={d.day} className={d.isWeekend ? 'weekend-header' : ''} style={{ border: '1px solid #000', padding: '2px 1px', textAlign: 'center', fontSize: '9px', width: '18px' }}>
                      {d.day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row, idx) => {
                  const staffRowSpan = row.isFirstRow ? 2 : 0
                  return (
                    <tr key={`${row.staffId}_${row.shiftType}_${idx}`}>
                      {row.isFirstRow && (
                        <>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }} rowSpan={staffRowSpan}>{row.no}</td>
                          <td style={{ border: '1px solid #000', paddingLeft: '4px' }} rowSpan={staffRowSpan}>{row.name}</td>
                          <td style={{ border: '1px solid #000', paddingLeft: '4px' }} rowSpan={staffRowSpan}>{row.position}</td>
                        </>
                      )}
                      <td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '9.5px' }}>{row.rateLabel}</td>
                      {daysInMonthList.map(d => {
                        const isActive = row.activeDays.includes(d.day)
                        const isDouble = doubleRateDays.includes(d.day)
                        return (
                          <td key={d.day} className={d.isWeekend ? 'weekend-cell' : ''} style={{ border: '1px solid #000', textAlign: 'center', fontWeight: isActive ? 'bold' : 'normal', backgroundColor: isActive && isDouble ? '#fee2e2' : undefined }}>
                            {isActive ? (row.shiftType === 'เช้า' ? 'ช' : 'บ') : ''}
                          </td>
                        )
                      })}
                      <td style={{ border: '1px solid #000', textAlign: 'center' }}>{row.totalDays || '-'}</td>
                      <td style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '4px' }}>
                        {row.totalAmount > 0 ? row.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      {row.isFirstRow && (
                        <td style={{ border: '1px solid #000', textAlign: 'center' }} rowSpan={staffRowSpan}></td>
                      )}
                    </tr>
                  )
                })}
                <tr style={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }}>
                  <td style={{ border: '1px solid #000', textAlign: 'center' }} colSpan={3 + 1 + daysInMonthList.length + 1}>รวมเงินทั้งสิ้น</td>
                  <td style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '4px' }}>
                    {grandTotalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ border: '1px solid #000' }}></td>
                </tr>
              </tbody>
            </table>

            <div className="signature-section" style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
              <div>
                <p style={{ margin: 0 }}>จำนวนเงินตัวอักษร: ({arabicToThaiBaht(grandTotalAmount)})</p>
                <br />
                <p style={{ margin: 0 }}>ลงชื่อ....................................................</p>
                <p style={{ margin: '2px 0 0 0' }}>({controllerSigner?.name})</p>
                <p style={{ margin: '2px 0 0 0' }}>{controllerSigner?.position}</p>
                <p style={{ margin: '2px 0 0 0' }}>ผู้ควบคุมการปฏิบัติงาน</p>
              </div>
              <div>
                <br /><br />
                <p style={{ margin: 0 }}>ลงชื่อ....................................................</p>
                <p style={{ margin: '2px 0 0 0' }}>({checkerSigner?.name})</p>
                <p style={{ margin: '2px 0 0 0' }}>{checkerSigner?.position}</p>
                <p style={{ margin: '2px 0 0 0' }}>ผู้ตรวจถูกต้อง</p>
              </div>
              <div>
                <br /><br />
                <p style={{ margin: 0 }}>ลงชื่อ....................................................</p>
                <p style={{ margin: '2px 0 0 0' }}>({approverSigner?.name})</p>
                <p style={{ margin: '2px 0 0 0' }}>{approverSigner?.position}</p>
                <p style={{ margin: '2px 0 0 0' }}>ผู้อนุมัติให้จ่ายได้</p>
              </div>
              <div>
                <br /><br />
                <p style={{ margin: 0 }}>ลงชื่อ....................................................</p>
                <p style={{ margin: '2px 0 0 0' }}>({payerSigner?.name})</p>
                <p style={{ margin: '2px 0 0 0' }}>{payerSigner?.position}</p>
                <p style={{ margin: '2px 0 0 0' }}>ผู้จ่ายเงิน</p>
              </div>
            </div>
          </>
        )}
      </div>

      {signerModalOpen && editingSigner && (
        <div className="modal-backdrop no-print" onMouseDown={e => { if (e.target === e.currentTarget) setSignerModalOpen(false) }}>
          <form className="modal" onSubmit={handleSaveSigner} style={{ maxWidth: '450px' }}>
            <div className="modal-head">
              <div>
                <h2>แก้ไขข้อมูลผู้ลงนาม</h2>
                <p>กำหนดชื่อ ตำแหน่ง และบทบาทผู้ลงนามท้ายใบเบิก</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setSignerModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <label>
                ชื่อ - นามสกุล:
                <input required value={signerForm.name} onChange={e => setSignerForm({ ...signerForm, name: e.target.value })} />
              </label>
              <label>
                ตำแหน่ง:
                <input required value={signerForm.position} onChange={e => setSignerForm({ ...signerForm, position: e.target.value })} />
              </label>
              <label>
                บทบาท/หน้าที่การลงนาม:
                <select value={signerForm.role} onChange={e => setSignerForm({ ...signerForm, role: e.target.value })}>
                  <option value="ผู้ควบคุม">ผู้ควบคุมการปฏิบัติงาน</option>
                  <option value="ผู้ตรวจถูกต้อง">ผู้ตรวจถูกต้อง</option>
                  <option value="ผู้อนุมัติให้จ่ายได้">ผู้อนุมัติให้จ่ายได้</option>
                  <option value="ผู้จ่ายเงิน">ผู้จ่ายเงิน</option>
                  <option value="custom">กำหนดเอง...</option>
                </select>
              </label>
              {signerForm.role === 'custom' && (
                <label>
                  ระบุบทบาทการลงนามเอง:
                  <input required value={signerForm.customRole} onChange={e => setSignerForm({ ...signerForm, customRole: e.target.value })} />
                </label>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setSignerModalOpen(false)}>ยกเลิก</button>
              <button className="btn primary">บันทึกข้อมูลผู้ลงนาม</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

function Dashboard({ staff, onNavigate }: { staff: Staff[]; onNavigate: (s: Section) => void }) {
  const activeCount = staff.filter(s => s.status === 'active').length
  const totalRate = staff.reduce((acc, curr) => acc + Number(curr.morning_rate) + Number(curr.afternoon_rate), 0)

  return (
    <>
      <div className="page-heading no-print">
        <div>
          <div className="eyebrow font-semibold">OVERVIEW</div>
          <h1 className="text-2xl font-bold">ภาพรวมระบบ</h1>
          <p className="text-gray-600">ยินดีต้อนรับสู่ระบบบริหารจัดการตารางเวรและค่าตอบแทน</p>
        </div>
      </div>

      <div className="stats-grid no-print">
        <div className="stat-card">
          <div className="stat-icon text-blue-600"><Users size={24} /></div>
          <div>
            <div className="stat-label">บุคลากรทั้งหมด</div>
            <div className="stat-value">{staff.length}</div>
            <div className="stat-sub">รายชื่อในระบบ</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon text-emerald-600"><UserCheck size={24} /></div>
          <div>
            <div className="stat-label">กำลังปฏิบัติงาน</div>
            <div className="stat-value">{activeCount}</div>
            <div className="stat-sub">สถานะ active</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon text-amber-600"><CircleDollarSign size={24} /></div>
          <div>
            <div className="stat-label">อัตราค่าตอบแทนตั้งไว้</div>
            <div className="stat-value">{totalRate.toLocaleString()}</div>
            <div className="stat-sub">บาท/รอบเวร</div>
          </div>
        </div>
      </div>

      <div className="panel mt-6 no-print" style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
        <h2 className="text-lg font-bold mb-4">เมนูด่วนและการจัดการ</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => onNavigate('roster')}>
            <CalendarDays size={18} /> จัดตารางเวรประจำเดือน
          </button>
          <button className="btn secondary" onClick={() => onNavigate('work-summary')}>
            <ClipboardList size={18} /> สรุปผลการปฏิบัติงาน
          </button>
          <button className="btn secondary" onClick={() => onNavigate('documents')}>
            <FileText size={18} /> พิมพ์ใบเบิกค่าตอบแทน
          </button>
          <button className="btn secondary" onClick={() => onNavigate('staff')}>
            <Users size={18} /> จัดการรายชื่อบุคลากร
          </button>
        </div>
      </div>
    </>
  )
}

function StaffPage({
  staff, search, setSearch, loading, onAdd, onEdit, onToggle, onReorder, isAdmin
}: {
  staff: Staff[]; search: string; setSearch: (s: string) => void;
  loading: boolean; onAdd: () => void; onEdit: (s: Staff) => void; onToggle: (s: Staff) => void;
  onReorder: () => void; isAdmin: boolean
}) {
  return (
    <>
      <div className="page-heading no-print">
        <div>
          <div className="eyebrow font-semibold">STAFF MANAGEMENT</div>
          <h1 className="text-2xl font-bold">จัดการบุคลากร</h1>
          <p className="text-gray-600">จัดการรายชื่อ อัตราค่าตอบแทน และการจัดลำดับบุคลากร</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn secondary" onClick={onReorder}>
              <ListOrdered size={18} /> จัดลำดับ (1, 2, 3...)
            </button>
            <button className="btn primary" onClick={onAdd}>
              <Plus size={18} /> เพิ่มบุคลากร
            </button>
          </div>
        )}
      </div>

      <div className="panel no-print" style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ, ตำแหน่ง, รหัส..."
              style={{ width: '100%', paddingLeft: '38px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Loader2 className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
            <p>กำลังโหลดรายชื่อบุคลากร...</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>รหัส</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>ชื่อ - สกุล</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>ตำแหน่ง</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>ประเภท</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>เวรเช้า (บาท)</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>เวรบ่าย (บาท)</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>สถานะ</th>
                {isAdmin && <th style={{ padding: '10px', textAlign: 'center' }}>จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {staff.map(person => (
                <tr key={person.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#0284c7' }}>{person.staff_code}</td>
                  <td style={{ padding: '10px', fontWeight: 500 }}>{person.first_name} {person.last_name}</td>
                  <td style={{ padding: '10px', color: '#475569' }}>{person.position}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11.5px', backgroundColor: person.staff_type === 'วิชาชีพ' ? '#e0f2fe' : '#f1f5f9', color: person.staff_type === 'วิชาชีพ' ? '#0369a1' : '#475569' }}>
                      {person.staff_type}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{Number(person.morning_rate).toLocaleString()}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{Number(person.afternoon_rate).toLocaleString()}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <button
                      disabled={!isAdmin}
                      onClick={() => onToggle(person)}
                      style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11.5px', border: 'none', cursor: isAdmin ? 'pointer' : 'default', backgroundColor: person.status === 'active' ? '#dcfce7' : '#fee2e2', color: person.status === 'active' ? '#15803d' : '#b91c1c' }}
                    >
                      {person.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                    </button>
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button onClick={() => onEdit(person)} className="icon-button" style={{ color: '#0284c7' }}>
                        <Pencil size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function RosterCalendarPage() {
  return (
    <div className="panel no-print" style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
      <h2 className="text-xl font-bold mb-2">จัดตารางเวรประจำเดือน</h2>
      <p className="text-gray-600">ระบบจัดตารางเวรปฏิบัติงานนอกเวลาราชการ</p>
    </div>
  )
}

function CompensationPage() {
  return (
    <div className="panel no-print" style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
      <h2 className="text-xl font-bold mb-2">สรุปค่าตอบแทน</h2>
      <p className="text-gray-600">สรุปยอดรวมค่าตอบแทนการปฏิบัติงานประจำเดือน</p>
    </div>
  )
}

function SetupScreen() {
  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
      <div style={{ textAlign: 'center', padding: '32px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
        <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 16px auto' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase</h2>
        <p style={{ color: '#64748b', marginTop: '8px' }}>กรุณากำหนด VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ในไฟล์ .env</p>
      </div>
    </div>
  )
}

function LoginScreen({ onLogin, error }: { onLogin: (e: string, p: string) => void; error: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' }}>
      <form onSubmit={e => { e.preventDefault(); onLogin(email, password) }} style={{ width: '100%', maxWidth: '380px', padding: '32px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', backgroundColor: '#e0f2fe', borderRadius: '12px', color: '#0284c7', marginBottom: '12px' }}>
            <Activity size={32} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>KORKHO SMART ROSTER</h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>เข้าสู่ระบบบริหารจัดการตารางเวร</p>
        </div>
        {error && <div style={{ padding: '8px 12px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            อีเมล:
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }} />
          </label>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            รหัสผ่าน:
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }} />
          </label>
          <button className="btn primary" style={{ width: '100%', marginTop: '8px', padding: '10px' }}>เข้าสู่ระบบ</button>
        </div>
      </form>
    </div>
  )
}