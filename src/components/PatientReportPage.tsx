import { getHosxpApiUrl } from '../utils/hosxpConfig';
import React, { useState, useEffect } from 'react';
import { Search, FileSpreadsheet, Filter, Loader2, AlertCircle, Calendar, Activity } from 'lucide-react';


interface PatientVisitRow {
  vn: string;
  vstdate: string;
  vsttime: string;
  hn: string;
  cid: string;
  full_name: string;
  age_y: number;
  phone: string;
  address: string;
  pttype: string;
  pttype_name: string;
  service_name: string;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  bp: string;
  pulse: number | null;
  waist: number | null;
  icd10_list: string;
  lab_results: string;
}

export default function PatientReportPage() {
  // ค่าเริ่มต้นช่วงวันที่ (วันที่ 1 ของเดือนปัจจุบัน ถึง วันนี้)
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [icd10, setIcd10] = useState<string>('');
  const [selectedPttype, setSelectedPttype] = useState<string>('ALL');
  const [selectedDep, setSelectedDep] = useState<string>('ALL');
  const [labKeyword, setLabKeyword] = useState<string>(''); // กรองผลแลปเพิ่มเติมบนหน้าจอ

  // ตัวเลือก Dropdown จาก HOSxP
  const [pttypes, setPttypes] = useState<{ pttype: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ depcode: string; department: string }[]>([]);
  const [labItems, setLabItems] = useState<{ lab_items_code: number; lab_items_name: string }[]>([]);

  // ข้อมูลรายงาน
  const [rows, setRows] = useState<PatientVisitRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searched, setSearched] = useState<boolean>(false);

  // โหลดรายการสิทธิการรักษาและแผนก/บริการตอนเปิดหน้า
 useEffect(() => {
    const loadFilters = async () => {
      try {
        const apiBase = await getHosxpApiUrl();
        const res = await fetch(`${apiBase}/api/reports/filters`);
        if (res.ok) {
          const data = await res.json();
          setPttypes(data.pttypes || []);
          setDepartments(data.departments || []);
          setLabItems(data.labItems || []);
        }
      } catch (err) {
        console.error('ไม่สามารถโหลดตัวกรองได้:', err);
      }
    };
    loadFilters();
  }, []);

  // ค้นหารายงานผู้รับบริการ
  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (startDate > endDate) {
      setErrorMsg('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSearched(true);

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        icd10: icd10.trim(),
        pttype: selectedPttype,
        depcode: selectedDep,
      });

      const apiBase = await getHosxpApiUrl();
      const res = await fetch(`${apiBase}/api/reports/patients?${params.toString()}`);
      const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || 'ดึงข้อมูลไม่สำเร็จ');
    }

    setRows(result.data || []);
    } catch (err: any) {
      setErrorMsg(
        'ไม่สามารถเชื่อมต่อฐานข้อมูล HOSxP ได้ (ตรวจสอบว่าเปิดใช้งานบนเครื่องแม่ 192.168.1.175 และตั้งค่า Allow Insecure Content แล้ว): ' +
          (err.message || '')
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // กรองผลแลปเพิ่มเติม (เช่น พิมพ์ HbA1c หรือ FBS)
  const filteredRows = rows.filter((row) => {
    if (!labKeyword.trim()) return true;
    const kw = labKeyword.trim().toLowerCase();
    return (row.lab_results || '').toLowerCase().includes(kw);
  });

  // แปลงวันที่เป็นรูปแบบไทยสั้น (เช่น 27 พ.ย. 2569)
  function formatThaiDateShort(dateStr: string) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ส่งออกเป็นไฟล์ Excel (.xls รูปแบบตาราง HTML ที่ Excel เปิดได้สมบูรณ์ 100% ภาษาไทยไม่เพี้ยน เลขบัตรไม่เป็น E+)
  function handleExportExcel() {
    if (filteredRows.length === 0) return;

    const tableRowsHtml = filteredRows
      .map(
        (r, index) => `
        <tr>
          <td style="text-align:center;">${index + 1}</td>
          <td style="mso-number-format:'\\@'; text-align:center;">${r.vstdate}</td>
          <td style="text-align:center;">${r.vsttime || '-'}</td>
          <td style="mso-number-format:'\\@'; text-align:center;">${r.hn}</td>
          <td style="mso-number-format:'\\@'; text-align:center;">${r.cid || '-'}</td>
          <td>${r.full_name}</td>
          <td style="text-align:center;">${r.age_y ?? '-'}</td>
          <td style="mso-number-format:'\\@';">${r.phone || '-'}</td>
          <td>${r.address || '-'}</td>
          <td>${r.service_name || '-'}</td>
          <td>${r.pttype_name || r.pttype || '-'}</td>
          <td style="font-weight:bold;">${r.icd10_list || '-'}</td>
          <td style="text-align:center;">${r.bp || '-'}</td>
          <td style="text-align:center;">${r.weight || '-'} / ${r.height || '-'} (BMI: ${r.bmi || '-'})</td>
          <td>${r.lab_results || '-'}</td>
        </tr>
      `
      )
      .join('');

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; font-family: 'TH Sarabun PSK', Tahoma, sans-serif; font-size: 14pt; }
          th { background-color: #0284c7; color: #ffffff; font-weight: bold; border: 1px solid #000000; padding: 6px 8px; }
          td { border: 1px solid #000000; padding: 5px 8px; vertical-align: top; }
        </style>
      </head>
      <body>
        <h3>รายงานรายชื่อผู้รับบริการ โรงพยาบาลส่งเสริมสุขภาพตำบลคอโค (ช่วงวันที่ ${startDate} ถึง ${endDate})</h3>
        <table>
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>วันที่รับบริการ</th>
              <th>เวลา</th>
              <th>HN</th>
              <th>เลขบัตรประชาชน</th>
              <th>ชื่อ - นามสกุล</th>
              <th>อายุ (ปี)</th>
              <th>เบอร์โทรศัพท์</th>
              <th>ที่อยู่ / หมู่บ้าน</th>
              <th>บริการ / แผนก</th>
              <th>สิทธิการรักษา</th>
              <th>รหัสวินิจฉัย (ICD-10)</th>
              <th>ความดัน (BP)</th>
              <th>นน./สส./BMI</th>
              <th>ผลแลปที่เกี่ยวข้อง (Lab Results)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const icdTag = icd10 ? `_ICD10-${icd10.replace(/,/g, '-')}` : '';
    link.setAttribute('download', `รายงานผู้รับบริการ_${startDate}_ถึง_${endDate}${icdTag}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-heading no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="eyebrow font-semibold">HOSxP SERVICE REPORT</div>
          <h1 className="text-2xl font-bold">รายงานรายชื่อผู้รับบริการและผลตรวจทางห้องปฏิบัติการ</h1>
          <p className="text-gray-600">ดึงข้อมูลตรงจากฐานข้อมูล HOSxP กรองตามช่วงเวลา รหัสโรค ICD-10 สิทธิการรักษา บริการ และผลแลป</p>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          disabled={filteredRows.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: filteredRows.length > 0 ? '#16a34a' : '#cbd5e1',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: filteredRows.length > 0 ? 'pointer' : 'not-allowed',
            boxShadow: filteredRows.length > 0 ? '0 2px 6px rgba(22,163,74,0.25)' : 'none',
          }}
        >
          <FileSpreadsheet size={18} />
          ส่งออกไฟล์ Excel ({filteredRows.length} รายการ)
        </button>
      </div>

      {errorMsg && (
        <div className="alert error mb-4">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* กล่องตัวกรองค้นหา */}
      <form
        onSubmit={handleSearch}
        style={{
          backgroundColor: '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #cbd5e1',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#0f172a', marginBottom: '14px', fontSize: '15px' }}>
          <Filter size={18} color="#0284c7" /> กำหนดเงื่อนไขการดึงรายงาน
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
              ตั้งแต่วันที่:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
              ถึงวันที่:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              รหัสวินิจฉัยโรค (ICD-10):
            </label>
            <input
              type="text"
              placeholder="เช่น E11, I10 (คั่นด้วย , ได้)"
              value={icd10}
              onChange={(e) => setIcd10(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              บริการ / แผนกที่รับบริการ:
            </label>
            <select
              value={selectedDep}
              onChange={(e) => setSelectedDep(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', boxSizing: 'border-box', backgroundColor: '#fff' }}
            >
              <option value="ALL">-- ทุกบริการ / ทุกแผนก --</option>
              {departments.map((d) => (
                <option key={d.depcode} value={d.depcode}>
                  {d.depcode} - {d.department}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              สิทธิการรักษา:
            </label>
            <select
              value={selectedPttype}
              onChange={(e) => setSelectedPttype(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', boxSizing: 'border-box', backgroundColor: '#fff' }}
            >
              <option value="ALL">-- ทุกสิทธิการรักษา --</option>
              {pttypes.map((p) => (
                <option key={p.pttype} value={p.pttype}>
                  {p.pttype} - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              <Activity size={14} style={{ display: 'inline', marginRight: '4px' }} />
              กรองชื่อผลแลป (เช่น HbA1c, FBS):
            </label>
            <select
              value={labKeyword}
              onChange={(e) => setLabKeyword(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', boxSizing: 'border-box', backgroundColor: '#fff' }}
            >
              <option value="">-- ผลแลปทั้งหมด --</option>
              {labItems.map((lab) => (
                <option key={lab.lab_items_code} value={lab.lab_items_name}>
                  {lab.lab_items_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '12.5px', color: '#64748b' }}>
            * เคล็ดลับ: ช่อง ICD-10 สามารถพิมพ์รหัสย่อได้ เช่น พิมพ์ <strong>E11</strong> จะดึงกลุ่มเบาหวานชนิดที่ 2 ทั้งหมด (E110 - E119)
          </span>

          <button
            type="submit"
            disabled={loading}
            className="btn primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 22px', fontSize: '14px' }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {loading ? 'กำลังดึงข้อมูลจาก HOSxP...' : 'ค้นหารายงานผู้รับบริการ'}
          </button>
        </div>
      </form>

      {/* ตารางแสดงผลลัพธ์ */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #cbd5e1',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ padding: '14px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '14.5px' }}>
            ผลการค้นหา: พบผู้รับบริการทั้งหมด <span style={{ color: '#0284c7', fontSize: '16px' }}>{filteredRows.length}</span> ครั้ง
          </div>
          {rows.length >= 2000 && (
            <span style={{ fontSize: '12px', color: '#d97706', fontWeight: 600 }}>
              * แสดงสูงสุด 2,000 รายการแรก กรุณาบีบช่วงวันที่ให้แคบลงหากต้องการดูทั้งหมด
            </span>
          )}
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1250px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', color: '#1e293b', borderBottom: '2px solid #cbd5e1', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '10px 8px', textAlign: 'center', width: '45px' }}>ลำดับ</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', width: '105px' }}>วันที่รับบริการ</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', width: '75px' }}>HN</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', width: '175px' }}>ชื่อ - นามสกุล / อายุ</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', width: '180px' }}>ที่อยู่ / เบอร์โทร</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', width: '140px' }}>บริการ / สิทธิ</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', width: '140px' }}>รหัสโรค (ICD-10)</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', width: '125px' }}>สัญญาณชีพ</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>ผลแลปที่เกี่ยวข้อง (Lab Results)</th>
              </tr>
            </thead>
            <tbody>
              {!searched ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    เลือกช่วงวันที่หรือเงื่อนไขด้านบน แล้วกดปุ่ม <strong>"ค้นหารายงานผู้รับบริการ"</strong> เพื่อดึงข้อมูลจาก HOSxP
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#0284c7' }}>
                    <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                    กำลังดึงข้อมูลผู้รับบริการและผลตรวจทางห้องปฏิบัติการ...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    ไม่พบข้อมูลผู้รับบริการตามเงื่อนไขที่ระบุ
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={row.vn + '_' + idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '8px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatThaiDateShort(row.vstdate)}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>{row.vsttime} น.</div>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#0284c7', verticalAlign: 'top' }}>{row.hn}</td>
                    <td style={{ padding: '8px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{row.full_name}</div>
                      <div style={{ fontSize: '11.5px', color: '#475569' }}>
                        อายุ {row.age_y} ปี {row.cid ? `• CID: ${row.cid}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '8px', verticalAlign: 'top', fontSize: '12px', color: '#334155' }}>
                      <div>{row.address || '-'}</div>
                      {row.phone && <div style={{ color: '#0284c7', marginTop: '2px' }}>โทร: {row.phone}</div>}
                    </td>
                    <td style={{ padding: '8px', verticalAlign: 'top', fontSize: '12px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.service_name || '-'}</div>
                      <div style={{ color: '#475569', marginTop: '2px' }}>{row.pttype_name || row.pttype}</div>
                    </td>
                    <td style={{ padding: '8px', verticalAlign: 'top' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                          padding: '3px 7px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          fontSize: '12px',
                        }}
                      >
                        {row.icd10_list || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '8px', verticalAlign: 'top', fontSize: '12px', color: '#334155' }}>
                      {row.bp && <div>BP: <strong>{row.bp}</strong></div>}
                      {row.weight && <div>นน.{row.weight} / BMI {row.bmi}</div>}
                      {!row.bp && !row.weight && '-'}
                    </td>
                    <td style={{ padding: '8px', verticalAlign: 'top', fontSize: '12px', color: '#0f172a', lineHeight: '1.45' }}>
                      {row.lab_results ? (
                        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 8px', borderRadius: '6px', color: '#166534' }}>
                          {row.lab_results}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>- ไม่มีผลแลป -</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}