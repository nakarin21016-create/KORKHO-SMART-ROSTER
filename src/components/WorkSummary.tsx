import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Printer, Calendar as CalendarIcon, Save, ChevronLeft, ChevronRight } from 'lucide-react';

interface DailySummary {
  id?: string;
  date: string;
  total_patients: number;
  paid_patients: number;
  uc_patients: number;
  created_at?: string;
}

export const WorkSummary: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [summaries, setSummaries] = useState<Record<string, DailySummary>>({});
  const [rosterData, setRosterData] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [form, setForm] = useState({ total_patients: 0, paid_patients: 0, uc_patients: 0 });
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // ดึงข้อมูลสรุปผล + ตารางเวร + รายชื่อเจ้าหน้าที่
  useEffect(() => {
    fetchData();
  }, [year, month]);

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

    // 1. ดึงสรุปผลปฏิบัติงาน
    const { data: summaryData } = await supabase
      .from('daily_summaries')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    const summaryMap: Record<string, DailySummary> = {};
    summaryData?.forEach((item: DailySummary) => { summaryMap[item.date] = item; });
    setSummaries(summaryMap);

    // 2. ดึงข้อมูลเวรประจำเดือน
    const { data: roster } = await supabase
      .from('roster')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);
    setRosterData(roster || []);

    // 3. ดึงข้อมูลเจ้าหน้าที่เพื่อเรียงตามตำแหน่ง (วิชาชีพ -> ลูกจ้าง)
    const { data: staff } = await supabase.from('staff').select('*');
    setStaffData(staff || []);

    setLoading(false);
  };

  // โหลดค่าของวันที่คลิกเลือก
  useEffect(() => {
    if (summaries[selectedDate]) {
      setForm({
        total_patients: summaries[selectedDate].total_patients || 0,
        paid_patients: summaries[selectedDate].paid_patients || 0,
        uc_patients: summaries[selectedDate].uc_patients || 0,
      });
    } else {
      setForm({ total_patients: 0, paid_patients: 0, uc_patients: 0 });
    }
  }, [selectedDate, summaries]);

  // บันทึกผลการปฏิบัติงาน
  const handleSave = async () => {
    if (!supabase) return;
    setLoading(true);
    const payload = {
      date: selectedDate,
      total_patients: Number(form.total_patients),
      paid_patients: Number(form.paid_patients),
      uc_patients: Number(form.uc_patients),
    };

    const existing = summaries[selectedDate];
    if (existing?.id) {
      await supabase.from('daily_summaries').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('daily_summaries').insert([payload]);
    }

    await fetchData();
    alert('บันทึกผลการปฏิบัติงานเรียบร้อยแล้ว');
  };

  // คำนวณวันในปฏิทิน
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  // ปริ้นเอกสาร
  const handlePrint = () => {
    window.print();
  };

  // จัดกลุ่มและเรียงเจ้าหน้าที่ที่ปฏิบัติงานในแต่วัน (วิชาชีพ -> ลูกจ้าง)
  const getStaffForDate = (dateStr: string) => {
    const shifts = rosterData.filter((r: any) => r.date === dateStr);
    if (!shifts.length) return '-';

    const staffIds = Array.from(new Set(shifts.map((s: any) => s.staff_id)));
    const onDutyStaff = staffData.filter((s: any) => staffIds.includes(s.id));

    // เรียงวิชาชีพขึ้นก่อนลูกจ้าง โดยเช็คจาก staff_type
    onDutyStaff.sort((a: any, b: any) => {
      if (a.staff_type === 'วิชาชีพ' && b.staff_type !== 'วิชาชีพ') return -1;
      if (a.staff_type !== 'วิชาชีพ' && b.staff_type === 'วิชาชีพ') return 1;
      return 0;
    });

    return onDutyStaff.map((s: any) => `${s.first_name} ${s.last_name}`).join(', ');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* ส่วนควบคุม (ซ่อนเมื่อพิมพ์) */}
      <div className="print:hidden flex justify-between items-center bg-white p-4 rounded-xl shadow">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarIcon className="w-6 h-6 text-blue-600" /> สรุปผลการปฏิบัติงานประจำเดือน
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 rounded">
              <ChevronLeft />
            </button>
            <span className="font-semibold text-lg">
              {currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 rounded">
              <ChevronRight />
            </button>
          </div>
          <button onClick={handlePrint} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700">
            <Printer className="w-4 h-4" /> ปริ้นเอกสารสรุปผล
          </button>
        </div>
      </div>

      {/* ปฏิทินกรอกข้อมูล (ซ่อนเมื่อพิมพ์) */}
      <div className="print:hidden grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ฝั่งปฏิทิน */}
        <div className="md:col-span-2 bg-white p-4 rounded-xl shadow">
          <div className="grid grid-cols-7 gap-2 text-center font-bold text-gray-600 mb-2">
            {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayIndex }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = selectedDate === dateStr;
              const hasData = !!summaries[dateStr];

              return (
                <button
                  key={dayNum}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`p-3 border rounded-lg text-left relative transition ${
                    isSelected ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-400' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="font-bold text-gray-700">{dayNum}</span>
                  {hasData && (
                    <div className="mt-1 text-xs text-blue-600">
                      <div>รวม: {summaries[dateStr].total_patients}</div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ฟอร์มกรอกตัวเลขประจำวันที่เลือก */}
        <div className="bg-white p-5 rounded-xl shadow space-y-4">
          <h3 className="font-bold text-lg text-gray-800 border-b pb-2">
            บันทึกผลวันที่: {new Date(selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">1. จำนวนผู้รับบริการทั้งหมด (ราย)</label>
              <input
                type="number"
                min="0"
                value={form.total_patients}
                onChange={e => setForm({ ...form, total_patients: Number(e.target.value) })}
                className="mt-1 w-full p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">2. ผู้ป่วยเก็บเงินได้ (ราย)</label>
              <input
                type="number"
                min="0"
                value={form.paid_patients}
                onChange={e => setForm({ ...form, paid_patients: Number(e.target.value) })}
                className="mt-1 w-full p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">3. ผู้ป่วย UC (ราย)</label>
              <input
                type="number"
                min="0"
                value={form.uc_patients}
                onChange={e => setForm({ ...form, uc_patients: Number(e.target.value) })}
                className="mt-1 w-full p-2 border rounded-md"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
          >
            <Save className="w-4 h-4" /> บันทึกผลการปฏิบัติงาน
          </button>
        </div>
      </div>

      {/* เอกสารสำหรับพิมพ์ (Print Layout) */}
      <div className="bg-white p-6 shadow-md rounded-xl print:shadow-none print:p-0">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold">รายงานสรุปผลการปฏิบัติงานประจำเดือน</h1>
          <p className="text-gray-600">
            ประจำเดือน {currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        <table className="w-full border-collapse border border-gray-400 text-sm">
          <thead>
            <tr className="bg-gray-100 print:bg-gray-200">
              <th className="border border-gray-400 p-2 w-24 text-center">วันที่</th>
              <th className="border border-gray-400 p-2 text-left">รายชื่อเจ้าหน้าที่ผู้ปฏิบัติงาน (เช้า-บ่าย)</th>
              <th className="border border-gray-400 p-2 w-64 text-center">ผลการปฏิบัติงาน (ราย)</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const data = summaries[dateStr];

              return (
                <tr key={dayNum} className="hover:bg-gray-50">
                  <td className="border border-gray-400 p-2 text-center font-medium">{dayNum}</td>
                  <td className="border border-gray-400 p-2">{getStaffForDate(dateStr)}</td>
                  <td className="border border-gray-400 p-2">
                    {data ? (
                      <div className="text-xs space-y-1">
                        <div>• ทั้งหมด: <strong>{data.total_patients}</strong> ราย</div>
                        <div>• เก็บเงินได้: <strong>{data.paid_patients}</strong> ราย</div>
                        <div>• UC: <strong>{data.uc_patients}</strong> ราย</div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs text-center block">- ไม่ได้บันทึก -</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};