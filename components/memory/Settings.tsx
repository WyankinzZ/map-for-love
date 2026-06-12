"use client";

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { Download, Settings, ShieldCheck, ShieldOff, Trash2, Upload, Pencil, X } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import { cities } from '@/data/cities';
import { MemoryPageShell } from '@/components/MemoryNav';
import { useAdminMode } from '@/hooks/useAdminMode';
import { compressImageFile } from '@/utils/imageCompression';
import {
  readAppSettings,
  writeAppSettings,
  defaultAnniversaryDate,
  defaultAnniversaryLabel,
  defaultCoupleLogo,
  type AppSettings,
  type LoginPhotoText,
} from '@/data/appSettings';
import {
  deleteLoginPhotoText,
  deleteLoginPhoto,
  loginPhotosUpdatedEvent,
  readLoginPhotoTexts,
  readLoginPhotos,
  writeLoginPhotoText,
  writeLoginPhoto,
} from '@/data/loginPhotoStore';
import { memoryStoreUpdatedEvent, type LocalMemoryStore } from '@/data/progress';
import { writeAdminMode } from '@/data/adminMode';
import { LocalPrivacyImage } from '@/components/LocalPrivacyImage';
import { type CityAssetStore, auxiliaryStorageKeys, loginPhotoSlots, normalizeAppSettings, readJsonArray } from './Shared';

export default function SettingsPage() {
  const isAdmin = useAdminMode();
  const [memoryCount, setMemoryCount] = useState(0);
  const [appSettings, setAppSettings] = useState<AppSettings>({});
  const [loginPhotos, setLoginPhotos] = useState<Record<string, string>>({});
  const [adminCode, setAdminCode] = useState("");
  const [adminError, setAdminError] = useState("");
  const [status, setStatus] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [newEntryPassword, setNewEntryPassword] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);

  const loadMemoryCount = async () => {
    const response = await fetch("/api/memories", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return {};
    const data = (await response.json().catch(() => null)) as { memories?: LocalMemoryStore } | null;
    const memories = data?.memories ?? {};
    setMemoryCount(Object.values(memories).flat().length);

    return memories;
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMemoryCount();
      const settings = readAppSettings();
      const legacyPhotos = settings.loginPhotos ?? {};
      const nextSettings = { ...settings, loginPhotos: undefined };

      setAppSettings(nextSettings);
      void Promise.all(Object.entries(legacyPhotos).map(([slotId, image]) => writeLoginPhoto(slotId, image)))
        .then(async () => {
          if (Object.keys(legacyPhotos).length > 0) writeAppSettings(nextSettings);
          setLoginPhotos(await readLoginPhotos());
          const loginPhotoTexts = await readLoginPhotoTexts();
          setAppSettings((current) => ({ ...current, loginPhotoTexts }));
        })
        .catch(() => {
          setLoginPhotos(legacyPhotos);
        });
    }, 0);

    const handleLoginPhotosUpdate = () => {
      void readLoginPhotos().then(setLoginPhotos).catch(() => setLoginPhotos({}));
      void readLoginPhotoTexts()
        .then((texts) => setAppSettings((current) => ({ ...current, loginPhotoTexts: texts })))
        .catch(() => { });
    };

    window.addEventListener(loginPhotosUpdatedEvent, handleLoginPhotosUpdate);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(loginPhotosUpdatedEvent, handleLoginPhotosUpdate);
    };
  }, []);

  const updateLoginPhoto = async (slotId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!isAdmin) {
      setStatus("请先进入管理员模式");
      event.target.value = "";
      return;
    }
    if (!file || isWorking) return;

    setIsWorking(true);
    setStatus("");

    try {
      const image = await compressImageFile(file);
      await writeLoginPhoto(slotId, image);
      setLoginPhotos(await readLoginPhotos());
      setStatus("登录照片已更新");
    } catch {
      setStatus("登录照片更新失败，请选择一张图片");
    } finally {
      setIsWorking(false);
      event.target.value = "";
    }
  };

  const resetLoginPhoto = (slotId: string) => {
    if (!isAdmin) {
      setStatus("请先进入管理员模式");
      return;
    }

    void deleteLoginPhoto(slotId)
      .then(async () => {
        setLoginPhotos(await readLoginPhotos());
        setStatus("登录照片已恢复默认");
      })
      .catch(() => setStatus("登录照片恢复失败，请稍后再试"));
  };

  const updateLoginPhotoText = (slotId: string, field: keyof LoginPhotoText, value: string) => {
    if (!isAdmin) {
      setStatus("请先进入管理员模式");
      return;
    }

    const nextText = {
      ...(appSettings.loginPhotoTexts?.[slotId] ?? {}),
      [field]: value,
    };
    const nextSettings = {
      ...appSettings,
      loginPhotoTexts: {
        ...(appSettings.loginPhotoTexts ?? {}),
        [slotId]: nextText,
      },
    };

    setAppSettings(nextSettings);
    void writeLoginPhotoText(slotId, nextText)
      .then(() => setStatus("登录文字已更新"))
      .catch(() => setStatus("登录文字更新失败，请稍后再试"));
  };

  const resetLoginPhotoText = (slotId: string) => {
    if (!isAdmin) {
      setStatus("请先进入管理员模式");
      return;
    }

    const nextTexts = { ...(appSettings.loginPhotoTexts ?? {}) };
    delete nextTexts[slotId];

    setAppSettings({ ...appSettings, loginPhotoTexts: nextTexts });
    void deleteLoginPhotoText(slotId)
      .then(() => setStatus("登录文字已恢复默认"))
      .catch(() => setStatus("登录文字恢复失败，请稍后再试"));
  };

  const anniversaryDate = appSettings.anniversaryDate ?? "";
  const anniversaryLabel = appSettings.anniversaryLabel ?? "";

  const updateBasicSetting = (patch: Partial<AppSettings>) => {
    if (!isAdmin) {
      setStatus("请先进入管理员模式");
      return;
    }

    const next = { ...appSettings, ...patch };
    setAppSettings(next);
    writeAppSettings(next);
    setStatus("基础设置已更新");
  };

  const coupleLogo = appSettings.coupleLogo ?? defaultCoupleLogo;

  const updateCoupleLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!isAdmin) {
      setStatus("请先进入管理员模式");
      event.target.value = "";
      return;
    }
    if (!file || isWorking) return;

    setIsWorking(true);
    setStatus("");

    try {
      const image = await compressImageFile(file);
      updateBasicSetting({ coupleLogo: image });
      setStatus("头像 logo 已更新");
    } catch {
      setStatus("头像 logo 更新失败，请选择一张图片");
    } finally {
      setIsWorking(false);
      event.target.value = "";
    }
  };

  const resetCoupleLogo = () => {
    if (!isAdmin) {
      setStatus("请先进入管理员模式");
      return;
    }
    updateBasicSetting({ coupleLogo: undefined });
    setStatus("头像 logo 已恢复默认");
  };

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
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, newPassword: trimmed }),
    }).catch(() => null);
    setIsWorking(false);

    if (response?.ok) {
      setStatus(target === "site" ? "进入密码已修改" : "管理员密码已修改");
      if (target === "site") setNewEntryPassword("");
      else setNewAdminPassword("");
    } else {
      setStatus("密码修改失败，请重试");
    }
  };

  const exportLocalData = async () => {
    if (!isAdmin) {
      setStatus("请先进入管理员模式");
      return;
    }

    setIsWorking(true);
    setStatus("");

    const memories = await loadMemoryCount();
    const assetResponse = await fetch("/api/city-assets", { cache: "no-store" }).catch(() => null);
    const assetData = (await assetResponse?.json().catch(() => null)) as { assets?: CityAssetStore } | null;
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      memories,
      cityAssets: assetData?.assets ?? {},
      auxiliary: Object.fromEntries(auxiliaryStorageKeys.map((key) => [key, readJsonArray(key)])),
      settings: {
        ...readAppSettings(),
        loginPhotos: await readLoginPhotos(),
        loginPhotoTexts: await readLoginPhotoTexts(),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `map-of-us-backup-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("已导出完整备份");
    setIsWorking(false);
  };

  const importLocalData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!isAdmin) {
      setStatus("请先进入管理员模式");
      if (importInputRef.current) importInputRef.current.value = "";
      return;
    }
    if (!file || isWorking) return;

    setIsWorking(true);
    setStatus("");

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Invalid backup");
      }

      const payload = parsed as {
        memories?: unknown;
        cityAssets?: unknown;
        auxiliary?: Record<string, unknown>;
        settings?: unknown;
      };
      const [memoryResponse, assetResponse] = await Promise.all([
        fetch("/api/memories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memories: payload.memories ?? {} }),
        }),
        fetch("/api/city-assets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assets: payload.cityAssets ?? {} }),
        }),
      ]);

      if (!memoryResponse.ok || !assetResponse.ok) throw new Error("Import failed");

      const data = (await memoryResponse.json()) as { memories: LocalMemoryStore };
      auxiliaryStorageKeys.forEach((key) => {
        const value = payload.auxiliary?.[key];
        if (Array.isArray(value)) window.localStorage.setItem(key, JSON.stringify(value));
      });
      if (payload.settings) {
        const nextSettings = normalizeAppSettings(payload.settings);
        await Promise.all(
          Object.entries(nextSettings.loginPhotos ?? {}).map(([slotId, image]) => writeLoginPhoto(slotId, image)),
        );
        await Promise.all(
          Object.entries(nextSettings.loginPhotoTexts ?? {}).map(([slotId, text]) => writeLoginPhotoText(slotId, text)),
        );
        const settingsWithoutPhotos = { ...nextSettings, loginPhotos: undefined };
        writeAppSettings(settingsWithoutPhotos);
        setAppSettings(settingsWithoutPhotos);
        setLoginPhotos(await readLoginPhotos());
      }
      window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent, { detail: data.memories }));
      setMemoryCount(Object.values(data.memories).flat().length);
      setStatus("导入完成，地图和回忆记录已刷新");
    } catch {
      setStatus("导入失败，请确认选择的是 Map For Everyone 备份文件");
    } finally {
      setIsWorking(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const unlockAdmin = async () => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "admin", password: adminCode }),
    }).catch(() => null);

    if (response?.ok) {
      writeAdminMode(true);
      setAdminCode("");
      setAdminError("");
      setStatus("管理员模式已开启");
      return;
    }

    setAdminError(response?.status === 503 ? "管理员认证未配置" : "密码不对");
  };

  const lockAdmin = () => {
    void fetch("/api/auth/login", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "admin" }),
    }).catch(() => null);
    writeAdminMode(false);
    setAdminCode("");
    setAdminError("");
    setStatus("管理员模式已关闭");
  };

  return (
    <MemoryPageShell active="settings">
      <header>
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-[#A8C8DC]" />
          <h1 className="text-[34px] font-semibold leading-tight text-[#5A6670]">设置</h1>
        </div>
        <p className="mt-2 text-sm font-medium text-[#5A6670]/58">管理本地数据和当前项目状态。</p>
      </header>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/76 p-5 shadow-[0_12px_28px_rgba(90,102,112,0.06)] md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isAdmin ? (
                <ShieldCheck className="h-6 w-6 text-[#A8C8DC]" />
              ) : (
                <ShieldOff className="h-6 w-6 text-[#E8B8C2]" />
              )}
              <div>
                <p className="text-sm font-semibold text-[#5A6670]">管理员模式</p>
                <p className="mt-1 text-xs text-[#5A6670]/52">
                  {isAdmin ? "已开启，可以编辑和导入数据。" : "未开启，设置改动和删除操作已锁定。"}
                </p>
              </div>
            </div>

            {isAdmin ? (
              <button
                className="rounded-[7px] border border-[#D8DDD8] px-4 py-2 text-sm font-semibold text-[#5A6670]/64 transition hover:bg-white/60"
                type="button"
                onClick={lockAdmin}
              >
                退出管理员
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="min-h-10 w-36 rounded-[7px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/70 px-3 text-sm text-[#5A6670] outline-none transition focus:border-[#A8C8DC] focus:bg-white"
                  value={adminCode}
                  onChange={(event) => {
                    setAdminCode(event.target.value);
                    setAdminError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void unlockAdmin();
                  }}
                  placeholder="管理员密码"
                  type="password"
                />
                <button
                  className="rounded-[7px] bg-[#F5DCE0] px-4 py-2 text-sm font-semibold text-[#E8B8C2] transition hover:bg-[#E8B8C2] hover:text-[#FAFBF7]"
                  type="button"
                  onClick={() => void unlockAdmin()}
                >
                  开启
                </button>
                {adminError && <span className="text-xs font-semibold text-[#E8B8C2]">{adminError}</span>}
              </div>
            )}
          </div>
        </div>

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
                  className="min-h-10 w-full rounded-[7px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/70 px-3 text-sm text-[#5A6670] outline-none transition focus:border-[#A8C8DC] focus:bg-white disabled:opacity-50"
                  value={newAdminPassword}
                  onChange={(event) => setNewAdminPassword(event.target.value)}
                  type="password"
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

        <div className="rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/76 p-6 shadow-[0_12px_28px_rgba(90,102,112,0.06)] md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="text-lg font-semibold text-[#5A6670]">个性化设置</p>
              <p className="mt-1 text-sm leading-6 text-[#5A6670]/62">
                修改地图右下角的专属双人头像 Logo。
              </p>
            </div>
            <div className="flex items-center gap-5">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-[#E8B8C2]/40 bg-white shadow-sm">
                <LocalPrivacyImage
                  src={coupleLogo}
                  alt="头像 logo 预览"
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  className={`cursor-pointer rounded-[7px] bg-[#A8C8DC] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-[#85b0ca] ${isAdmin ? "" : "pointer-events-none opacity-50"
                    }`}
                >
                  上传新头像
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={updateCoupleLogo}
                    disabled={!isAdmin}
                  />
                </label>
                <button
                  type="button"
                  className="rounded-[7px] border border-[#D8DDD8] px-4 py-2 text-xs font-semibold text-[#5A6670]/64 transition hover:bg-white/60 disabled:opacity-50"
                  onClick={resetCoupleLogo}
                  disabled={!isAdmin}
                >
                  恢复默认头像
                </button>
              </div>
            </div>
          </div>
        </div>


        <div className="rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/76 p-5 shadow-[0_12px_28px_rgba(90,102,112,0.06)]">
          <p className="text-sm font-semibold text-[#5A6670]">本地回忆</p>
          <p className="mt-2 text-3xl font-semibold text-[#E8B8C2]">{memoryCount}</p>
          <p className="mt-2 text-sm text-[#5A6670]/58">网页里新增的城市回忆数量。</p>
        </div>
        <div className="rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/76 p-5 shadow-[0_12px_28px_rgba(90,102,112,0.06)]">
          <p className="text-sm font-semibold text-[#5A6670]">完整备份</p>
          <p className="mt-2 text-sm leading-6 text-[#5A6670]/62">
            导出城市回忆、城市地标图、地点收藏、纪念日和时光宝盒。换电脑前先备份一下。
          </p>
          <button
            className="mt-4 flex items-center gap-2 rounded-[7px] border border-[#A8C8DC] px-4 py-2 text-sm font-semibold text-[#A8C8DC] transition hover:bg-[#D6E8F0]/36"
            type="button"
            onClick={exportLocalData}
            disabled={isWorking || !isAdmin}
          >
            <Download className="h-4 w-4" />
            导出备份
          </button>
        </div>
        <div className="rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/76 p-5 shadow-[0_12px_28px_rgba(90,102,112,0.06)]">
          <p className="text-sm font-semibold text-[#5A6670]">导入恢复</p>
          <p className="mt-2 text-sm leading-6 text-[#5A6670]/62">
            选择之前导出的备份文件，会覆盖当前城市回忆，并恢复辅助页面数据。
          </p>
          <input
            ref={importInputRef}
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={importLocalData}
            disabled={!isAdmin}
          />
          <button
            className="mt-4 flex items-center gap-2 rounded-[7px] border border-[#E8B8C2] px-4 py-2 text-sm font-semibold text-[#E8B8C2] transition hover:bg-[#F5DCE0]/42 disabled:opacity-45"
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={isWorking || !isAdmin}
          >
            <Upload className="h-4 w-4" />
            导入备份
          </button>
        </div>
      </section>
      {status && (
        <p className="mt-5 rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/72 px-4 py-3 text-sm text-[#5A6670]/66">
          {status}
        </p>
      )}
    </MemoryPageShell>
  );
}
