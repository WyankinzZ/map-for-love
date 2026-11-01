"use client";

import { Download, Upload } from 'lucide-react';
import { type CityAssetStore, auxiliaryStorageKeys, readJsonArray } from './Shared';
import { memoryStoreUpdatedEvent, type LocalMemoryStore } from '@/data/progress';
import {
  readAppSettings,
  writeAppSettings,
} from '@/data/appSettings';
import {
  readLoginPhotoTexts,
  readLoginPhotos,
  writeLoginPhotoText,
  writeLoginPhoto,
} from '@/data/loginPhotoStore';
import { normalizeAppSettings } from './Shared';
import { readMemories, readCityAssets, writeMemories, writeCityAssets } from '@/lib/client/storage';
import { isMobileStaticApp } from '@/lib/client/idb';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface BackupSectionProps {
  isAdmin: boolean;
  isWorking: boolean;
  setIsWorking: (v: boolean) => void;
  setStatus: (v: string) => void;
  setMemoryCount: (v: number) => void;
  setAppSettings: (v: any) => void;
  setLoginPhotos: (v: Record<string, string>) => void;
  importInputRef: React.RefObject<HTMLInputElement | null>;
}

export function BackupSection({
  isAdmin,
  isWorking,
  setIsWorking,
  setStatus,
  setMemoryCount,
  setAppSettings,
  setLoginPhotos,
  importInputRef,
}: Readonly<BackupSectionProps>) {
  // In personal mobile APK app, administrative unlock is granted by default
  const isEffectiveAdmin = isAdmin || isMobileStaticApp();

  const loadMemoryCount = async () => {
    const memories = await readMemories().catch(() => ({}));
    setMemoryCount(Object.values(memories).flat().length);
    return memories;
  };

  const exportLocalData = async () => {
    if (!isEffectiveAdmin) {
      setStatus("请先进入管理员模式");
      return;
    }

    setIsWorking(true);
    setStatus("");

    try {
      const memories = await loadMemoryCount();
      const cityAssets = await readCityAssets().catch(() => ({}));
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        memories,
        cityAssets,
        auxiliary: Object.fromEntries(auxiliaryStorageKeys.map((key) => [key, readJsonArray(key)])),
        settings: {
          ...readAppSettings(),
          loginPhotos: await readLoginPhotos(),
          loginPhotoTexts: await readLoginPhotoTexts(),
        },
      };

      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = `MapForLove-backup-${stamp}.json`;
      const jsonString = JSON.stringify(payload, null, 2);

      // On Android / Capacitor mobile environment:
      if (isMobileStaticApp()) {
        try {
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: jsonString,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
          });

          await Share.share({
            title: "Map For Love 完整回忆备份",
            text: "Map For Love 完整回忆备份数据文件",
            url: savedFile.uri,
            dialogTitle: "保存或分享备份文件",
          });

          setStatus("已拉起保存/分享菜单，备份导出成功");
          setIsWorking(false);
          return;
        } catch (mobileErr) {
          console.warn("[BackupSection] Native file export failed, falling back to blob download:", mobileErr);
        }
      }

      // Web / Desktop fallback
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatus("已导出完整备份");
    } catch (err) {
      console.error("[BackupSection] Export error:", err);
      setStatus("导出备份失败，请重试");
    } finally {
      setIsWorking(false);
    }
  };

  const importLocalData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!isEffectiveAdmin) {
      setStatus("请先进入管理员模式");
      if (importInputRef.current) importInputRef.current.value = "";
      return;
    }
    if (!file || isWorking) return;

    setIsWorking(true);
    setStatus("");

    try {
      let fileText = "";
      try {
        fileText = await file.text();
      } catch {
        fileText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(file, "utf-8");
        });
      }

      // Remove BOM if present
      fileText = fileText.replace(/^\uFEFF/, "");

      const parsed = JSON.parse(fileText) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Invalid backup format");
      }

      const payload = parsed as {
        memories?: unknown;
        cityAssets?: Record<string, string>;
        auxiliary?: Record<string, unknown>;
        settings?: unknown;
      };

      const memories = (payload.memories ?? {}) as LocalMemoryStore;
      await writeMemories(memories);

      if (payload.cityAssets && typeof payload.cityAssets === "object") {
        await writeCityAssets(payload.cityAssets).catch(() => {});
      }

      auxiliaryStorageKeys.forEach((key) => {
        const value = payload.auxiliary?.[key];
        if (Array.isArray(value)) window.localStorage.setItem(key, JSON.stringify(value));
      });

      if (payload.settings) {
        const nextSettings = normalizeAppSettings(payload.settings);
        await Promise.all(
          Object.entries(nextSettings.loginPhotos ?? {}).map(([slotId, image]) =>
            writeLoginPhoto(slotId, image as string)
          ),
        );
        await Promise.all(
          Object.entries(nextSettings.loginPhotoTexts ?? {}).map(([slotId, text]) =>
            writeLoginPhotoText(slotId, text as { city?: string; label?: string })
          ),
        );
        const settingsWithoutPhotos = { ...nextSettings, loginPhotos: undefined };
        writeAppSettings(settingsWithoutPhotos);
        setAppSettings(settingsWithoutPhotos);
        setLoginPhotos(await readLoginPhotos());
      }

      window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent, { detail: memories }));
      setMemoryCount(Object.values(memories).flat().length);
      setStatus("导入完成，地图和回忆记录已刷新");
    } catch (err) {
      console.error("[BackupSection] Import error:", err);
      setStatus("导入失败，请确认选择的是正确的 Map For Love 备份文件");
    } finally {
      setIsWorking(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  return (
    <>
      {!isEffectiveAdmin && (
        <div className="md:col-span-2 rounded-[8px] border border-dashed border-[#E8B8C2] bg-[#F5DCE0]/20 p-4 text-center">
          <p className="text-sm font-semibold text-[#E8B8C2]">请先在上方开启管理员模式，才能使用导入导出功能</p>
        </div>
      )}
      <div className="rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/76 p-5 shadow-[0_12px_28px_rgba(90,102,112,0.06)]">
        <p className="text-sm font-semibold text-[#5A6670]">完整备份</p>
        <p className="mt-2 text-sm leading-6 text-[#5A6670]/62">
          导出城市回忆、城市地标图、地点收藏、纪念日、旅行倒计时和时光宝盒。随时备份珍惜数据。
        </p>
        <button
          className="mt-4 flex items-center gap-2 rounded-[7px] border border-[#A8C8DC] px-4 py-2 text-sm font-semibold text-[#A8C8DC] transition hover:bg-[#D6E8F0]/36 disabled:opacity-45"
          type="button"
          onClick={exportLocalData}
          disabled={isWorking || !isEffectiveAdmin}
        >
          <Download className="h-4 w-4" />
          导出备份
        </button>
      </div>
      <div className="rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/76 p-5 shadow-[0_12px_28px_rgba(90,102,112,0.06)]">
        <p className="text-sm font-semibold text-[#5A6670]">导入恢复</p>
        <p className="mt-2 text-sm leading-6 text-[#5A6670]/62">
          选择之前导出的备份文件，会恢复城市回忆、地标及全部辅助清单数据。
        </p>
        <input
          id="backupFileInput"
          name="backupFileInput"
          ref={importInputRef}
          className="hidden"
          type="file"
          accept=".json,application/json,text/plain,application/octet-stream,*/*"
          onChange={importLocalData}
          disabled={!isEffectiveAdmin}
        />
        <button
          className="mt-4 flex items-center gap-2 rounded-[7px] border border-[#E8B8C2] px-4 py-2 text-sm font-semibold text-[#E8B8C2] transition hover:bg-[#F5DCE0]/42 disabled:opacity-45"
          type="button"
          onClick={() => importInputRef.current?.click()}
          disabled={isWorking || !isEffectiveAdmin}
        >
          <Upload className="h-4 w-4" />
          导入备份
        </button>
      </div>
    </>
  );
}
