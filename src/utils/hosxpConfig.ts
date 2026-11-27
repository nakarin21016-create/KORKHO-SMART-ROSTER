const LAN_URL = 'http://192.168.1.175:3001';
const ZEROTIER_URL = 'http://10.8.236.253:3001';

let cachedBaseUrl: string | null = null;

/**
 * ตรวจสอบอัตโนมัติว่าเครื่องลูกข่ายอยู่ในวง LAN ของ รพ.สต. หรือต่อผ่าน ZeroTier นอกพื้นที่
 */
export async function getHosxpApiUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${LAN_URL}/api/reports/filters`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      cachedBaseUrl = LAN_URL;
      return LAN_URL;
    }
  } catch {
    // อยู่นอกพื้นที่ สลับไปใช้ ZeroTier อัตโนมัติ
  }

  cachedBaseUrl = ZEROTIER_URL;
  return ZEROTIER_URL;
}