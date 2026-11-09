export type StaffType = 'วิชาชีพ' | 'ลูกจ้าง'
export type StaffStatus = 'active' | 'inactive'

export interface Staff {
  id: string
  staff_code: string
  first_name: string
  last_name: string
  position: string
  staff_type: StaffType
  morning_rate: number
  afternoon_rate: number
  status: StaffStatus
  created_at: string
}
