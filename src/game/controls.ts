export function sprintHeld(keys: Readonly<Record<string, boolean>>) {
  return Boolean(keys["ShiftLeft"] || keys["ShiftRight"]);
}