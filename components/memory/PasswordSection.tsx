"use client";

import { useState } from 'react';
import { setPassword as savePasswordClient } from '@/lib/client/auth';

interface PasswordSectionProps {
  isAdmin: boolean;
  isWorking: boolean;
  setIsWorking: (v: boolean) => void;
  setStatus: (v: string) => void;
}

export function PasswordSection({
  isAdmin,
  isWorking,
  setIsWorking,
  setStatus,
}: Readonly<PasswordSectionProps>) {
  const [newEntryPassword, setNewEntryPassword] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");

  const savePassword = async (target: "site" | "admin", value: string) => {
    if (!isAdmin) {
      setStatus("请先进入管理员模式");
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      setStatus("请输入新密码");
      return;
    }
    if (target === "site" && !/^\d{4,8}$/.test(trimmed)) {
      setStatus("进入密码请用 4-8 位数字（你们在一起的日期，如 1223）");
      return;
    }

    setIsWorking(true);
    // Try server-side password change (desktop), fall back to client-side (mobile)
    let ok = false;
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, newPassword: trimmed }),
      });
      ok = response.ok;
      if (!ok && (response.status === 404 || response.status === 405)) {
        throw new Error("API not available");
      }
    } catch {
      // API not available — save password client-side
      savePasswordClient(target, trimmed);
      ok = true;
    }
    setIsWorking(false);

    if (ok) {
      setStatus(target === "site" ? "进入密码已修改" : "管理员密码已修改");
      if (target === "site") setNewEntryPassword("");
      else setNewAdminPassword("");
    } else {
      setStatus("密码修改失败，请重试");
    }
  };

  return (
    <div className="rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/76 p-6 shadow-[0_12px_28px_rgba(90,102,112,0.06)] md:col-span-2">
      <div>
        <p className="text-lg font-semibold text-[#5A6670]">密码与安全</p>
        <p className="mt-1 text-sm leading-6 text-[#5A6670]/62">
          修改打开应用的进入密码和管理员密码。修改后立即生效，下次打开也用新密码。需要先开启管理员模式。
        </p>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <span className="text-xs font-semibold text-[#5A6670]/48">进入密码（你们在一起的日期，如 1223）</span>
          <div className="flex gap-2">
            <input
              id="entryPassword"
              name="entryPassword"
              type="text"
              autoComplete="off"
              className="min-h-10 w-full rounded-[7px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/70 px-3 text-sm text-[#5A6670] outline-none transition focus:border-[#A8C8DC] focus:bg-white disabled:opacity-50"
              value={newEntryPassword}
              onChange={(event) => setNewEntryPassword(event.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              placeholder="如 1223"
              disabled={!isAdmin}
            />
            <button
              type="button"
              className="shrink-0 rounded-[7px] bg-[#F5DCE0] px-4 py-2 text-sm font-semibold text-[#E8B8C2] transition hover:bg-[#E8B8C2] hover:text-[#FAFBF7] disabled:opacity-50"
              onClick={() => void savePassword("site", newEntryPassword)}
              disabled={!isAdmin || isWorking}
            >
              保存
            </button>
          </div>
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs font-semibold text-[#5A6670]/48">管理员密码（自己设置）</span>
          <div className="flex gap-2">
            <input
              id="adminPassword"
              name="adminPassword"
              type="password"
              autoComplete="new-password"
              className="min-h-10 w-full rounded-[7px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/70 px-3 text-sm text-[#5A6670] outline-none transition focus:border-[#A8C8DC] focus:bg-white disabled:opacity-50"
              value={newAdminPassword}
              onChange={(event) => setNewAdminPassword(event.target.value)}
              placeholder="新的管理员密码"
              disabled={!isAdmin}
            />
            <button
              type="button"
              className="shrink-0 rounded-[7px] bg-[#F5DCE0] px-4 py-2 text-sm font-semibold text-[#E8B8C2] transition hover:bg-[#E8B8C2] hover:text-[#FAFBF7] disabled:opacity-50"
              onClick={() => void savePassword("admin", newAdminPassword)}
              disabled={!isAdmin || isWorking}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
