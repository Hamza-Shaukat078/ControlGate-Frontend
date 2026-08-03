import { CheckCircle2, AlertTriangle, Bell } from "lucide-react";

/**
 * Backend notifications carry no severity field (always synthesized as
 * "INFO"), but messages are fixed-format ("Scan {id} {state}") so a keyword
 * match against real message text is a reliable proxy — not a guess.
 */
export function getNotificationIcon(message = "") {
  const text = message.toLowerCase();
  if (/fail|cancel|critical/.test(text)) return { Icon: AlertTriangle, color: "var(--v-fail)" };
  if (/complet/.test(text)) return { Icon: CheckCircle2, color: "var(--v-pass)" };
  return { Icon: Bell, color: "var(--t-text-dim)" };
}
