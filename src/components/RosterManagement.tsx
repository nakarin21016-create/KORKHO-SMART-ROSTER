// src/components/RosterManagement.tsx
import React, { useState, useEffect } from 'react';
import { getActiveStaff, getOrCreateSchedule, getDutyAssignments, saveDutyAssignments } from '../rosterService';
import { Calendar, Save, Loader2 } from 'lucide-react';

export const RosterManagement: React.FC = () => {
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(11);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  
  const [selectedShifts, setSelectedShifts] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const daysInMonth = new Date(year, month, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    loadRosterData();
  }, [year, month]);

  const loadRosterData = async () => {
    try {
      setLoading(true);
      const staff = await getActiveStaff();
      setStaffList(staff);

      const schedule = await getOrCreateSchedule(year, month);
      setScheduleId(schedule.id);

      const assignments = await getDutyAssignments(schedule.id);
      const shiftMap: Record<string, boolean> = {};

      assignments.forEach((item: any) => {
        const key = `${item.staff_id}_${item.duty_date}_${item.shift_type}`;
        shiftMap[key] = true;
      });

      setSelectedShifts(shiftMap);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleShift = (staffId: string, day: number, shift: 'morning' | 'afternoon') => {
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    const key = `${staffId}_${dateStr}_${shift}`;

    setSelectedShifts((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    if (!scheduleId) return;
    try {
      setSaving(true);
      const assignmentsInput: any[] = [];

      Object.keys(selectedShifts).forEach((key) => {
        if (selectedShifts[key]) {
          const [staff_id, duty_date, shift_type] = key.split('_');
          assignmentsInput.push({
            staff_id,
            duty_date,
            shift_type: shift_type as 'morning' | 'afternoon',
          });
        }
      });

      await saveDutyAssignments(scheduleId, assignmentsInput);
      alert('บันทึกตารางเวรสำเร็จ!');
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2 text-teal-800">
          <Calendar className="w-6 h-6" /> ระบบจัดตารางเวรประจำเดือน
        </h1>

        <div className="flex items-center gap-4">
          <select 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5"
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2026, i).toLocaleString('th-TH', { month: 'long' })}
              </option>
            ))}
          </select>

          <select 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5"
          >
            <option value={2026}>พ.ศ. 2569</option>
            <option value={2025}>พ.ศ. 2568</option>
          </select>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            บันทึกเวร
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="bg-teal-700 text-white">
                <th className="p-2 border border-teal-600 text-left min-w-[140px]">เจ้าหน้าที่</th>
                <th className="p-1 border border-teal-600 w-12">เวร</th>
                {daysArray.map((d) => (
                  <th key={d} className="p-1 border border-teal-600 w-7">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffList.map((staff) => (
                <React.Fragment key={staff.id}>
                  {/* เวรเช้า */}
                  <tr className="hover:bg-gray-50">
                    <td rowSpan={2} className="p-2 border border-gray-300 font-medium text-left bg-gray-50">
                      {staff.first_name} {staff.last_name}
                      <div className="text-[10px] text-gray-500">{staff.position}</div>
                    </td>
                    <td className="p-1 border border-gray-300 bg-amber-50 text-amber-800 font-semibold">เช้า</td>
                    {daysArray.map((day) => {
                      const dayStr = String(day).padStart(2, '0');
                      const monthStr = String(month).padStart(2, '0');
                      const dateStr = `${year}-${monthStr}-${dayStr}`;
                      const key = `${staff.id}_${dateStr}_morning`;
                      const isChecked = !!selectedShifts[key];

                      return (
                        <td
                          key={day}
                          onClick={() => toggleShift(staff.id, day, 'morning')}
                          className={`border border-gray-300 cursor-pointer select-none font-bold ${
                            isChecked ? 'bg-amber-400 text-slate-900' : 'hover:bg-amber-100'
                          }`}
                        >
                          {isChecked ? '✓' : ''}
                        </td>
                      );
                    })}
                  </tr>
                  {/* เวรบ่าย */}
                  <tr className="hover:bg-gray-50">
                    <td className="p-1 border border-gray-300 bg-sky-50 text-sky-800 font-semibold">บ่าย</td>
                    {daysArray.map((day) => {
                      const dayStr = String(day).padStart(2, '0');
                      const monthStr = String(month).padStart(2, '0');
                      const dateStr = `${year}-${monthStr}-${dayStr}`;
                      const key = `${staff.id}_${dateStr}_afternoon`;
                      const isChecked = !!selectedShifts[key];

                      return (
                        <td
                          key={day}
                          onClick={() => toggleShift(staff.id, day, 'afternoon')}
                          className={`border border-gray-300 cursor-pointer select-none font-bold ${
                            isChecked ? 'bg-sky-500 text-white' : 'hover:bg-sky-100'
                          }`}
                        >
                          {isChecked ? '✓' : ''}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};