/**
 * Política de PIN de personal (alineada con StaffPinPolicy.java).
 */

export const STAFF_PIN_LENGTH = 4;

const BANNED = new Set([
  "0000",
  "1111",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
  "1234",
  "4321",
  "0123",
  "9876",
  "1212",
  "2121",
  "1122",
  "2211",
  "1221",
  "2112",
  "1232",
  "2345",
  "3456",
  "4567",
  "5678",
  "6789",
  "0987",
  "1357",
  "2468",
]);

export const WEAK_PIN_MESSAGE =
  "Ese PIN es muy fácil de adivinar. Elige 4 dígitos que no sean consecutivos ni repetidos.";

export function isStaffPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
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
    return "El PIN debe ser exactamente 4 dígitos.";
  }
  if (isWeakStaffPin(pin)) {
    return WEAK_PIN_MESSAGE;
  }
  return null;
}
