import { useEffect, useState, useMemo } from 'react'
import { Calendar, Printer, ChevronLeft, ChevronRight, UserCheck, Banknote, CreditCard, X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface WorkSummaryRecord {
  id?: string
  work_date: string
  total_patients: number
  cash_collected: number
  uc_count: number
}

interface StaffAssignment {
  staff_id: string
  first_name: string
  last_name: string
  shift_type: string
}

interface SignerStaff {
  id: string
  first_name: string
  last_name: string
  position?: string
}

export function WorkSummary() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [summaryData, setSummaryData] = useState<Record<string, WorkSummaryRecord>>({})
  const [rosterData, setRosterData] = useState<Record<string, StaffAssignment[]>>({})
  const [loading, setLoading] = useState(false)
  
  // รายชื่อเจ้าหน้าที่สำหรับเลือกผู้ลงนาม
  const [staffList, setStaffList] = useState<SignerStaff[]>([])
  const [selectedSignerId, setSelectedSignerId] = useState<string>('')

  // State สำหรับ Modal กรอกตัวเลขประจำวัน
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [form, setForm] = useState({ total_patients: 0, cash_collected: 0, uc_count: 0 })
  const [saving, setSaving] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayIndex = new Date(year, month, 1).getDay()

  useEffect(() => {
    void loadMonthlyData()
    void loadStaffList()
  }, [year, month])

  async function loadStaffList() {
    if (!supabase) return
    const { data } = await supabase
      .from('staff')
      .select('id, first_name, last_name, position')
      .order('first_name')

    if (data && data.length > 0) {
      setStaffList(data)
      if (!selectedSignerId) {
        setSelectedSignerId(data[0].id)
      }
    }
  }

  async function loadMonthlyData() {
    if (!supabase) return
    setLoading(true)

    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    // 1. โหลดข้อมูลสรุปผลงาน
    const { data: summaryList } = await supabase
      .from('work_summaries')
      .select('*')
      .gte('work_date', startDate)
      .lte('work_date', endDate)

    const summaryMap: Record<string, WorkSummaryRecord> = {}
    summaryList?.forEach((item: WorkSummaryRecord) => {
      summaryMap[item.work_date] = item
    })
    setSummaryData(summaryMap)

    // 2. ดึงรายชื่อผู้ขึ้นเวรจากตารางเวรประจำเดือน
    const { data: schedule } = await supabase
      .from('duty_schedules')
      .select('id')
      .eq('schedule_year', year)
      .eq('schedule_month', month + 1)
      .maybeSingle()

    if (schedule) {
      const { data: assignments } = await supabase
        .from('duty_assignments')
        .select('duty_date, shift_type, staff:staff_id(id, first_name, last_name)')
        .eq('schedule_id', schedule.id)

      const rosterMap: Record<string, StaffAssignment[]> = {}
      assignments?.forEach((item: any) => {
        if (!rosterMap[item.duty_date]) rosterMap[item.duty_date] = []
        if (item.staff) {
          rosterMap[item.duty_date].push({
            staff_id: item.staff.id,
            first_name: item.staff.first_name,
            last_name: item.staff.last_name,
            shift_type: item.shift_type
          })
        }
      })
      setRosterData(rosterMap)
    } else {
      setRosterData({})
    }

    setLoading(false)
  }

  function openDayModal(dateStr: string) {
    setSelectedDate(dateStr)
    const record = summaryData[dateStr]
    if (record) {
      setForm({
        total_patients: record.total_patients || 0,
        cash_collected: record.cash_collected || 0,
        uc_count: record.uc_count || 0,
      })
    } else {
      setForm({ total_patients: 0, cash_collected: 0, uc_count: 0 })
    }
  }

  async function handleSaveDayRecord(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDate || !supabase) return
    setSaving(true)

    const payload = {
      work_date: selectedDate,
      total_patients: Number(form.total_patients),
      cash_collected: Number(form.cash_collected),
      uc_count: Number(form.uc_count),
    }

    const { error } = await supabase
      .from('work_summaries')
      .upsert(payload, { onConflict: 'work_date' })

    setSaving(false)
    if (!error) {
      setSelectedDate(null)
      await loadMonthlyData()
    }
  }

  // คำนวณ ยอดรวมประจำเดือน
  const monthlyTotals = useMemo(() => {
    let patients = 0, cash = 0, uc = 0
    Object.values(summaryData).forEach(item => {
      patients += item.total_patients || 0
      cash += item.cash_collected || 0
      uc += item.uc_count || 0
    })
    return { patients, cash, uc }
  }, [summaryData])

  // ดึงข้อมูลผู้ลงนามที่ถูกเลือก
  const selectedSigner = useMemo(() => {
    return staffList.find(s => s.id === selectedSignerId) || null
  }, [staffList, selectedSignerId])

  // เตรียมข้อมูลสำหรับตารางพิมพ์สรุปผลงาน
  const printRows = useMemo(() => {
    const rows = []
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const monthStr = String(month + 1).padStart(2, '0')
      const dayStr = String(dayNum).padStart(2, '0')
      const dateStr = `${year}-${monthStr}-${dayStr}`
      
      const summary = summaryData[dateStr] || { total_patients: 0, cash_collected: 0, uc_count: 0 }
      const staffList = rosterData[dateStr] || []

      rows.push({
        dayNum,
        dateStr,
        staffList,
        summary
      })
    }
    return rows
  }, [daysInMonth, year, month, summaryData, rosterData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body * {
            visibility: hidden;
          }
          .sidebar, .topbar, .page-heading, .stats-grid, .calendar-panel, .no-print, .modal-backdrop {
            display: none !important;
          }
          .print-summary-area, .print-summary-area * {
            visibility: visible !important;
          }
          .print-summary-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 11px !important;
          }
          th, td {
            border: 1px solid #000000 !important;
            padding: 4px 6px !important;
            vertical-align: top !important;
            line-height: 1.3 !important;
          }
          th {
            background-color: #f1f5f9 !important;
            text-align: center !important;
            font-weight: bold !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="page-heading no-print">
        <div>
          <div className="eyebrow font-semibold">WORK SUMMARY</div>
          <h1 className="text-2xl font-bold">สรุปผลการปฏิบัติงานประจำเดือน</h1>
          <p className="text-gray-600">บันทึกยอดผู้รับบริการและค่าบริการรายวันผ่านปฏิทิน</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* ช่องเลือกผู้ลงนาม */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: '500', color: '#475569' }}>ผู้ลงนาม:</span>
            <select
              value={selectedSignerId}
              onChange={e => setSelectedSignerId(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '13px' }}
            >
              {staffList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} {s.position ? `(${s.position})` : ''}
                </option>
              ))}
            </select>
          </div>

          <button onClick={() => window.print()} className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={18} /> พิมพ์รายงานสรุปผล
          </button>
        </div>
      </div>

      {/* สรุปยอดรวมประจำเดือน Cards */}
      <div 
        className="stats-grid no-print" 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '16px' 
        }}
      >
        <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
          <div className="stat-icon text-blue-600"><UserCheck size={28} /></div>
          <div>
            <div className="stat-label text-gray-500 text-sm">ผู้รับบริการทั้งหมด</div>
            <div className="stat-value text-2xl font-bold">{monthlyTotals.patients.toLocaleString()}</div>
            <div className="stat-sub text-xs text-gray-400">ราย/เดือน</div>
          </div>
        </div>

        <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
          <div className="stat-icon text-emerald-600"><Banknote size={28} /></div>
          <div>
            <div className="stat-label text-gray-500 text-sm">ผู้ป่วยเก็บเงินได้</div>
            <div className="stat-value text-2xl font-bold">{monthlyTotals.cash.toLocaleString()}</div>
            <div className="stat-sub text-xs text-gray-400">ราย/เดือน</div>
          </div>
        </div>

        <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
          <div className="stat-icon text-amber-600"><CreditCard size={28} /></div>
          <div>
            <div className="stat-label text-gray-500 text-sm">สิทธิ UC / ประกันสุขภาพ</div>
            <div className="stat-value text-2xl font-bold">{monthlyTotals.uc.toLocaleString()}</div>
            <div className="stat-sub text-xs text-gray-400">ราย/เดือน</div>
          </div>
        </div>
      </div>

      {/* ปฏิทินแสดงและกรอกข้อมูล */}
      <div className="panel calendar-panel no-print" style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} /> ปฏิทินสรุปผลงาน: {currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="btn secondary" style={{ padding: '6px 12px' }}>
              <ChevronLeft size={16} /> เดือนก่อน
            </button>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="btn secondary" style={{ padding: '6px 12px' }}>
              เดือนถัดไป <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Loader2 className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
            <p>กำลังโหลดข้อมูลสรุปผลงาน...</p>
          </div>
        ) : (
          <>
            {/* ตารางปฏิทิน 7 วัน */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => <div key={d}>{d}</div>)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {Array.from({ length: firstDayIndex }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1
                const monthStr = String(month + 1).padStart(2, '0')
                const dayStr = String(dayNum).padStart(2, '0')
                const dateStr = `${year}-${monthStr}-${dayStr}`

                const record = summaryData[dateStr]
                const hasData = record && (record.total_patients > 0 || record.cash_collected > 0 || record.uc_count > 0)

                return (
                  <div
                    key={dayNum}
                    onClick={() => openDayModal(dateStr)}
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      minHeight: '100px',
                      backgroundColor: hasData ? '#f0fdf4' : '#ffffff',
                      borderColor: hasData ? '#86efac' : '#cbd5e1',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-in-out',
                    }}
                    className="hover:shadow-md hover:border-blue-400"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#334155' }}>{dayNum}</span>
                      {hasData && <span style={{ fontSize: '10px', backgroundColor: '#22c55e', color: '#fff', padding: '1px 5px', borderRadius: '10px' }}>บันทึกแล้ว</span>}
                    </div>

                    {hasData ? (
                      <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px', color: '#1e293b' }}>
                        <div><b>ผู้ป่วยรวม:</b> {record.total_patients} ราย</div>
                        <div><b>ผู้ป่วยเก็บเงิน:</b> {record.cash_collected.toLocaleString()} ราย</div>
                        <div><b>UC:</b> {record.uc_count} ราย</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '14px' }}>
                        + คลิกเพื่อกรอก
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ตารางพิมพ์สรุปผลงาน */}
      <div className="print-summary-area panel" style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
            สรุปผลการปฏิบัติงานนอกเวลาราชการ
          </h2>
          <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
            โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค ประจำเดือน {currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: '45px' }}>วันที่</th>
              <th style={{ width: '220px' }}>ชื่อผู้ปฏิบัติงาน</th>
              <th>ผลการปฏิบัติงาน</th>
            </tr>
          </thead>
          <tbody>
            {printRows.map(row => (
              <tr key={row.dayNum}>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.dayNum}</td>
                <td>
                  {row.staffList.length > 0 ? (
                    row.staffList.map((s, idx) => (
                      <div key={idx} style={{ marginBottom: '2px' }}>
                        {s.first_name} {s.last_name}
                      </div>
                    ))
                  ) : (
                    <span style={{ color: '#94a3b8' }}>-</span>
                  )}
                </td>
                <td>
                  <div>จำนวนผู้รับบริการทั้งหมด .....<b>{row.summary.total_patients || '0'}</b>..... ราย</div>
                  <div style={{ textIndent: '12px' }}>1. ผู้ป่วยเก็บเงินได้ .....<b>{row.summary.cash_collected || '0'}</b>..... ราย</div>
                  <div style={{ textIndent: '12px' }}>2. ผู้ป่วย UC .....<b>{row.summary.uc_count || '0'}</b>..... ราย</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ยอดสรุปผู้ป่วยรวมในเดือนนั้นๆ ใต้ตาราง */}
        <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', lineHeight: '1.6' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            สรุปยอดรวมประจำเดือน {currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}:
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>• รวมผู้รับบริการทั้งหมด: <b>{monthlyTotals.patients.toLocaleString()}</b> ราย</div>
            <div>• รวมผู้ป่วยเก็บเงินได้: <b>{monthlyTotals.cash.toLocaleString()}</b> ราย</div>
            <div>• รวมผู้ป่วยสิทธิ UC / ประกันสุขภาพ: <b>{monthlyTotals.uc.toLocaleString()}</b> ราย</div>
          </div>
        </div>

        {/* ส่วนลงลายมือชื่อผู้ลงนาม 1 ท่าน (ขยายความกว้างเพื่อไม่ให้ตกบรรทัด) */}
        <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'center', width: '300px', fontSize: '12px', lineHeight: '1.8' }}>
            <div>ลงชื่อ .................................................... ผู้รายงาน</div>
            <div style={{ marginTop: '4px' }}>
              ({selectedSigner ? `${selectedSigner.first_name} ${selectedSigner.last_name}` : '....................................................'})
            </div>
            <div>ตำแหน่ง {selectedSigner?.position || '....................................................'}</div>
          </div>
        </div>
      </div>

      {/* Modal ป๊อปอัพสำหรับกรอกตัวเลขประจำวัน */}
      {selectedDate && (
        <div className="modal-backdrop no-print" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedDate(null) }}>
          <form className="modal" onSubmit={handleSaveDayRecord} style={{ maxWidth: '420px' }}>
            <div className="modal-head">
              <div>
                <h2>บันทึกผลงานประจำวันที่ {new Date(selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
                <p>กรอกตัวเลขผลการปฏิบัติงานและยอดเงิน</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setSelectedDate(null)}><X size={20} /></button>
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <label>
                ผู้รับบริการทั้งหมด (คน):
                <input
                  type="number"
                  min="0"
                  required
                  value={form.total_patients}
                  onChange={e => setForm({ ...form, total_patients: Number(e.target.value) })}
                />
              </label>
              <label>
                จำนวนผู้ป่วยเก็บเงินได้ (ราย):
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.cash_collected}
                  onChange={e => setForm({ ...form, cash_collected: Number(e.target.value) })}
                />
              </label>
              <label>
                จำนวนผู้รับบริการสิทธิ UC (คน):
                <input
                  type="number"
                  min="0"
                  required
                  value={form.uc_count}
                  onChange={e => setForm({ ...form, uc_count: Number(e.target.value) })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setSelectedDate(null)}>ยกเลิก</button>
              <button className="btn primary" disabled={saving}>
                {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}