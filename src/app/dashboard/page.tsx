"use client";

import { useState } from "react";
import { AttendanceTab } from "./components/AttendanceTab";
import { MessagesTab } from "./components/MessagesTab";
import { StatsTab } from "./components/StatsTab";

type TabId = "attendance" | "messages" | "stats";

interface Tab {
  id: TabId;
  label: string;
}

const tabs: Tab[] = [
  { id: "attendance", label: "出欠管理" },
  { id: "messages", label: "メッセージ" },
  { id: "stats", label: "統計" },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("attendance");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            出欠管理ダッシュボード
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            出欠状況の確認、メッセージの管理、統計の閲覧ができます。
          </p>
        </header>

        <nav className="mb-6">
          <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {activeTab === "attendance" && <AttendanceTab />}
        {activeTab === "messages" && <MessagesTab />}
        {activeTab === "stats" && <StatsTab />}
      </div>
    </div>
  );
}
