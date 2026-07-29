/**
 * Leave confirmation while a page holds session-critical UI state
 * (e.g. PIN handoff that the API cannot re-show).
 *
 * In-app leaves (nav, logout) go through a styled confirm owned by the
 * blocking page. Tab close/reload still uses native `beforeunload`.
 */

type LeaveBlocker = {
  isActive: () => boolean;
  requestConfirm: (onConfirm: () => void) => void;
};

let leaveBlocker: LeaveBlocker | null = null;

export function setAdminLeaveBlocker(next: LeaveBlocker | null): void {
  leaveBlocker = next;
}

/** True when a page is holding session-critical state. */
export function isAdminLeaveBlocked(): boolean {
  return leaveBlocker?.isActive() === true;
}

/**
 * Run `onProceed` immediately if free to leave; otherwise ask the
 * blocking page to confirm, then run `onProceed` only if the user accepts.
 */
export function requestAdminLeave(onProceed: () => void): void {
  if (!leaveBlocker?.isActive()) {
    onProceed();
    return;
  }
  leaveBlocker.requestConfirm(onProceed);
}
