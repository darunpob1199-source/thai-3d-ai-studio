/**
 * EMVCo Thai PromptPay QR Payload Generator (BOT Standard)
 * Supports 10-digit Thai mobile numbers (08x/09x/06x), 13-digit National/Tax ID, or 15-digit e-Wallet ID.
 * Computes CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) per EMVCo specification.
 */

function formatTlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

export function crc16CcittFalse(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) & 0xff) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function generatePromptPayPayload(rawTarget: string, amount?: number): string {
  const digits = rawTarget.replace(/\D/g, "");
  let subTag = "01";
  let formattedTarget = digits;

  if (digits.length >= 15) {
    subTag = "03"; // e-Wallet ID
  } else if (digits.length === 13) {
    subTag = "02"; // National ID / Tax ID
  } else {
    subTag = "01"; // Mobile Number -> 0066 + 9 digits without leading 0
    const stripped = digits.startsWith("0") ? digits.slice(1) : digits;
    formattedTarget = `0066${stripped.padEnd(9, "0").slice(0, 9)}`;
  }

  const merchantInfo = [
    formatTlv("00", "A000000677010111"),
    formatTlv(subTag, formattedTarget),
  ].join("");

  const hasAmount = typeof amount === "number" && amount > 0;

  const fields = [
    formatTlv("00", "01"), // Payload Format Indicator
    formatTlv("01", hasAmount ? "12" : "11"), // 12 = Dynamic QR (with amount), 11 = Static QR
    formatTlv("29", merchantInfo), // Merchant Account Information (PromptPay)
    formatTlv("53", "764"), // Transaction Currency (764 = THB)
    ...(hasAmount ? [formatTlv("54", amount!.toFixed(2))] : []),
    formatTlv("58", "TH"), // Country Code
  ];

  const rawWithoutCrc = `${fields.join("")}6304`;
  const crc = crc16CcittFalse(rawWithoutCrc);
  return `${rawWithoutCrc}${crc}`;
}
