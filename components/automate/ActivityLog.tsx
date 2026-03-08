"use client";

import { useAutomationStore } from "@/lib/automation/store";
import { CheckCircle, XCircle, AlertTriangle, Bell, Info } from "lucide-react";

const TYPE_ICON: Record<string, React.ReactNode> = {
  order: <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />,
  cancel: <XCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
  error: <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />,
  alert: <Bell className="h-3.5 w-3.5 text-blue-400 shrink-0" />,
  info: <Info className="h-3.5 w-3.5 text-[#848e9c] shrink-0" />,
};

function formatTs(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ActivityLog() {
  const logs = useAutomationStore((s) => s.logs);

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-[#848e9c] text-xs">
        No activity yet. Create a strategy to get started.
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-[#2a2e3e]">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-[#141620] transition-colors">
          {TYPE_ICON[log.type] ?? TYPE_ICON.info}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[#c8ccd8] leading-tight">{log.details}</p>
            <span className="text-[10px] text-[#848e9c]">{formatTs(log.timestamp)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
