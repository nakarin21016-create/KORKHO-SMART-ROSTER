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

export function WorkSummary() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [summaryData, setSummaryData] = useState<Record<string, WorkSummaryRecord>>({})
  const [loading, setLoading] = useState(false)
  
  // State สำหรับ Modal กรอกตัวเลขประจำวัน
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [form, setForm] = useState({ total_patients: 0, cash_collected: 0, uc_count: 0 })
  const [saving, setSaving] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayIndex = new Date(year, month, 1).getDay()

  useEffect(() => {
    void loadMonthlySummary()
  }, [year, month])

  async function loadMonthlySummary() {
    if (!supabase) return
    setLoading(true)

    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    const { data } = await supabase
      .from('work_summaries')
      .select('*')
      .gte('work_date', startDate)
      .lte('work_date', endDate)

    const map: Record<string, WorkSummaryRecord> = {}
    data?.forEach((item: WorkSummaryRecord) => {
      map[item.work_date] = item
    })

    setSummaryData(map)
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
      await loadMonthlySummary()
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="page-heading no-print">
        <div>
          <div className="eyebrow font-semibold">WORK SUMMARY</div>
          <h1 className="text-2xl font-bold">สรุปผลการปฏิบัติงานประจำเดือน</h1>
          <p className="text-gray-600">บันทึกยอดผู้รับบริการและค่าบริการรายวันผ่านปฏิทิน</p>
        </div>
        <button onClick={() => window.print()} className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Printer size={18} /> พิมพ์รายงานสรุปผล
        </button>
      </div>

      {/* สรุปยอดรวมประจำเดือน Cards */}
      <div className="stats-grid no-print">
        <div className="stat-card">
          <div className="stat-icon text-blue-600"><UserCheck size={24} /></div>
          <div>
            <div className="stat-label">ผู้รับบริการทั้งหมด</div>
            <div className="stat-value">{monthlyTotals.patients.toLocaleString()}</div>
            <div className="stat-sub">ราย/เดือน</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon text-emerald-600"><Banknote size={24} /></div>
          <div>
            <div className="stat-label">ผู้ป่วยเก็บเงินได้</div>
            <div className="stat-value">{monthlyTotals.cash.toLocaleString()}</div>
            <div className="stat-sub">ราย/เดือน</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon text-amber-600"><CreditCard size={24} /></div>
          <div>
            <div className="stat-label">สิทธิ UC / ประกันสุขภาพ</div>
            <div className="stat-value">{monthlyTotals.uc.toLocaleString()}</div>
            <div className="stat-sub">ราย/เดือน</div>
          </div>
        </div>
      </div>

      {/* ปฏิทินแสดงและกรอกข้อมูล */}
      <div className="panel no-print" style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
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