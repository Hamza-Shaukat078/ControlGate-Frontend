import React, { useEffect } from "react";

/** Shared bottom-right toast. Auto-dismisses after `duration` ms. */
export default function Toast({ message, onClose, duration = 4000, tone = "default" }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className={`toast toast-${tone}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
