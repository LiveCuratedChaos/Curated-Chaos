export const PRIVATE_RECOVERY_DAYS = 90;
export const PRIVATE_RECOVERY_WINDOW_MS = PRIVATE_RECOVERY_DAYS * 86400000;

// The exact 90-day anniversary is eligible. Millisecond deadlines are exclusive.
export function privateRecoveryDeadline(deletedAt) {
  return Date.parse(deletedAt) + PRIVATE_RECOVERY_WINDOW_MS + 1;
}

export function withinPrivateRecoveryWindow(deletedAt, now) {
  return Date.parse(deletedAt) <= now && now < privateRecoveryDeadline(deletedAt);
}
