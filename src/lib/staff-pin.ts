/**
 * Política de PIN de personal (alineada con StaffPinPolicy.java).
 */

export const STAFF_PIN_LENGTH = 6;

const BANNED = new Set([
  "000000",
  "111111",
  "222222",
  "333333",
  "444444",
  "555555",
  "666666",
  "777777",
  "888888",
  "999999",
  "123456",
  "654321",
  "012345",
  "987654",
  "112233",
  "121212",
  "123123",
  "111222",
  "112211",
  "123321",
  "121121",
]);

export const WEAK_PIN_MESSAGE =
  "Ese PIN es muy fácil de adivinar. Elige 6 dígitos que no sean consecutivos ni repetidos.";

export function isStaffPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function isWeakStaffPin(pin: string): boolean {
  if (!isStaffPinFormat(pin)) return false;
  if (new Set(pin).size <= 2) return true;
  if (BANNED.has(pin)) return true;

  const digits = [...pin].map((d) => Number(d));
  let ascending = true;
  let descending = true;
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1]! + 1) ascending = false;
    if (digits[i] !== digits[i - 1]! - 1) descending = false;
  }
  if (ascending || descending) return true;

  let alternating = true;
  for (let i = 2; i < digits.length; i++) {
    if (digits[i] !== digits[i % 2]) {
      alternating = false;
      break;
    }
  }
  if (alternating && digits[0] !== digits[1]) return true;

  let twinPairs = true;
  for (let i = 0; i + 1 < digits.length; i += 2) {
    if (digits[i] !== digits[i + 1]) {
      twinPairs = false;
      break;
    }
  }
  return twinPairs;
}

export function staffPinCreateError(pin: string): string | null {
  if (!isStaffPinFormat(pin)) {
    return "El PIN debe ser exactamente 6 dígitos.";
  }
  if (isWeakStaffPin(pin)) {
    return WEAK_PIN_MESSAGE;
  }
  return null;
}
