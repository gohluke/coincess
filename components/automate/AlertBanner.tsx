"use client";

import { useEffect, useState } from "react";
import { X, Bell } from "lucide-react";
import { setAlertCallback } from "@/lib/alerts/engine";
import type { AlertRule } from "@/lib/automation/types";

interface ToastMessage {
  id: string;
  title: string;
  body: string;
  timestamp: number;
}

export function AlertBanner() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    setAlertCallback((_alert: AlertRule, message: string) => {
      const toast: ToastMessage = {
        id: `toast-${Date.now()}`,
        title: "Alert Triggered",
        body: message,
        timestamp: Date.now(),
      };
      setToasts((prev) => [toast, ...prev].slice(0, 5));

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 8000);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div key={toast.id} className="bg-[#141620] border border-[#FF455B]/50 rounded-xl p-4 shadow-lg shadow-[#FF455B]/10 animate-in slide-in-from-bottom-2">
          <div className="flex items-start gap-3">
            <Bell className="h-4 w-4 text-[#FF455B] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">{toast.title}</p>
              <p className="text-xs text-[#c8ccd8] mt-0.5">{toast.body}</p>
            </div>
            <button onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} className="text-[#848e9c] hover:text-white shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
