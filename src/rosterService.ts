// src/services/rosterService.ts
// ⚠️ แก้ไขพาธตรงนี้ให้ตรงกับไฟล์ supabase ที่คุณมีอยู่จริง (เช่น '../lib/supabase' หรือ '../supabaseClient')
import { supabase } from '../src/lib/supabase'; 

export interface DutyAssignmentInput {
  staff_id: string;
  duty_date: string; // YYYY-MM-DD
  shift_type: 'morning' | 'afternoon';
}

// 1. ดึงเจ้าหน้าที่ทั้งหมดที่สถานะ Active
export async function getActiveStaff() {
  const { data, error } = await supabase
    .from('staff')
    .select('id, staff_code, first_name, last_name, position, staff_type')
    .eq('status', 'active')
    .order('first_name');

  if (error) throw error;
  return data || [];
}

// 2. ดึงหรือสร้าง Schedule ของเดือนนั้น
export async function getOrCreateSchedule(year: number, month: number) {
  let { data: schedule, error } = await supabase
    .from('duty_schedules')
    .select('*')
    .eq('schedule_year', year)
    .eq('schedule_month', month)
    .maybeSingle();

  if (error) throw error;

  if (!schedule) {
    const { data: newSchedule, error: createError } = await supabase
      .from('duty_schedules')
      .insert({ schedule_year: year, schedule_month: month, status: 'draft' })
      .select()
      .single();

    if (createError) throw createError;
    schedule = newSchedule;
  }

  return schedule;
}

// 3. ดึงรายการเวรที่จัดไว้แล้ว
export async function getDutyAssignments(scheduleId: string) {
  const { data, error } = await supabase
    .from('duty_assignments')
    .select('*')
    .eq('schedule_id', scheduleId);

  if (error) throw error;
  return data || [];
}

// 4. บันทึกตารางเวรใหม่ (Delete ของเดิมแล้ว Insert ชุดใหม่)
export async function saveDutyAssignments(scheduleId: string, assignments: DutyAssignmentInput[]) {
  const { error: deleteError } = await supabase
    .from('duty_assignments')
    .delete()
    .eq('schedule_id', scheduleId);

  if (deleteError) throw deleteError;

  if (assignments.length === 0) return true;

  const rows = assignments.map((a) => ({
    schedule_id: scheduleId,
    staff_id: a.staff_id,
    duty_date: a.duty_date,
    shift_type: a.shift_type,
  }));

  const { error: insertError } = await supabase.from('duty_assignments').insert(rows);
  if (insertError) throw insertError;

  return true;
}