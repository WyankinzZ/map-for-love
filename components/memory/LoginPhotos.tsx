"use client";

import { type ChangeEvent, useEffect, useState } from 'react';
import { Image as ImageIcon, Pencil, Trash2, Upload, X } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import { MemoryPageShell } from '@/components/MemoryNav';
import { useAdminMode } from '@/hooks/useAdminMode';
import { compressImageFile } from '@/utils/imageCompression';
import {
  readAppSettings,
  writeAppSettings,
  type AppSettings,
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
import { LocalPrivacyImage } from '@/components/LocalPrivacyImage';
import { loginPhotoSlots } from './Shared';

export default function LoginPhotosPage() {
  const isAdmin = useAdminMode();
  const [appSettings, setAppSettings] = useState<AppSettings>({});
  const [loginPhotos, setLoginPhotos] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      setAppSettings(readAppSettings());
      setLoginPhotos(await readLoginPhotos());
      const loginPhotoTexts = await readLoginPhotoTexts();
      setAppSettings((current) => ({ ...current, loginPhotoTexts }));
    };
    void loadSettings();

    const handleLoginPhotosUpdate = () => {
      void loadSettings();
    };

    window.addEventListener(loginPhotosUpdatedEvent, handleLoginPhotosUpdate);
    return () => {
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
    setStatus("正在压缩照片...");
    try {
      const compressedImage = await compressImageFile(file);
      setStatus("正在上传到云端...");
      await writeLoginPhoto(slotId, compressedImage);
      setLoginPhotos((prev) => ({ ...prev, [slotId]: compressedImage }));
      setStatus("照片已更新");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "处理照片失败");
    } finally {
      setIsWorking(false);
      event.target.value = "";
    }
  };

  const resetLoginPhoto = async (slotId: string) => {
    if (!isAdmin) {
      setStatus("请先进入管理员模式");
      return;
    }
    setIsWorking(true);
    setStatus("正在恢复默认照片...");
    try {
      await deleteLoginPhoto(slotId);
      setLoginPhotos((prev) => {
        const next = { ...prev };
        delete next[slotId];
        return next;
      });
      setStatus("已恢复默认照片");
    } catch (error) {
      setStatus("恢复默认照片失败");
    } finally {
      setIsWorking(false);
    }
  };

  const updateLoginPhotoText = (slotId: string, key: "city" | "label", value: string) => {
    if (!isAdmin) return;
    setAppSettings((prev) => {
      const currentTexts = prev.loginPhotoTexts ?? {};
      const currentSlotText = currentTexts[slotId] ?? {};
      const nextSlotText = { ...currentSlotText, [key]: value };
      const nextTexts = { ...currentTexts, [slotId]: nextSlotText };
      void writeLoginPhotoText(slotId, nextSlotText).catch(() => {});
      return { ...prev, loginPhotoTexts: nextTexts };
    });
  };

  const resetLoginPhotoText = async (slotId: string) => {
    if (!isAdmin) return;
    setIsWorking(true);
    try {
      await deleteLoginPhotoText(slotId);
      setAppSettings((prev) => {
        const nextTexts = { ...prev.loginPhotoTexts };
        delete nextTexts[slotId];
        return { ...prev, loginPhotoTexts: nextTexts };
      });
      setStatus("已恢复默认文字");
    } catch (error) {
      setStatus("恢复默认文字失败");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <MemoryPageShell active="loginPhotos">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <ImageIcon className="h-8 w-8 fill-[#F5DCE0] text-[#E8B8C2]" />
            <h1 className="text-[34px] font-semibold leading-tight text-[#5A6670]">登录照片</h1>
          </div>
          <p className="mt-2 text-sm font-medium text-[#5A6670]/58">
            对应登录界面底部的 9 张照片。替换某一格后，大背景、相框和缩略图都会同步使用这一张。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/72 px-4 py-2 text-sm font-semibold text-[#5A6670]/62 shadow-[0_8px_24px_rgba(90,102,112,0.08)] backdrop-blur">
            已自定义 {Object.keys(loginPhotos).length} / {loginPhotoSlots.length}
          </div>
        </div>
      </header>

      <section className="mt-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loginPhotoSlots.map((slot) => {
            const customPhoto = loginPhotos[slot.id];
            const customText = appSettings.loginPhotoTexts?.[slot.id];
            const src = customPhoto ?? slot.fallback;
            const titleValue = customText?.city ?? slot.city;
            const isCustom = Boolean(customPhoto || customText);

            return (
              <div
                key={slot.id}
                className="group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-[12px] border border-[#D8DDD8]/70 bg-[#D6E8F0]/24 shadow-sm transition hover:shadow-md"
                onClick={() => {
                  if (isAdmin) setEditingSlotId(slot.id);
                }}
              >
                <LocalPrivacyImage
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  src={src}
                  alt={`${slot.city} 登录照片预览`}
                  fill
                  sizes="(max-width: 768px) 50vw, 360px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-80" />
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-white drop-shadow-sm">{titleValue}</p>
                    {isCustom && (
                      <p className="mt-1 text-xs text-white/80 drop-shadow-sm">已自定义</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white opacity-0 backdrop-blur-md transition group-hover:opacity-100">
                      <Pencil className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <AnimatePresence>
        {editingSlotId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#5A6670]/20 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm rounded-[16px] bg-white p-6 shadow-[0_20px_60px_rgba(90,102,112,0.12)]"
            >
              {(() => {
                const slot = loginPhotoSlots.find(s => s.id === editingSlotId)!;
                const customPhoto = loginPhotos[slot.id];
                const customText = appSettings.loginPhotoTexts?.[slot.id];
                const titleValue = customText?.city ?? slot.city;
                const labelValue = customText?.label ?? slot.label;
                const src = customPhoto ?? slot.fallback;

                return (
                  <>
                    <div className="mb-5 flex items-center justify-between">
                      <h2 className="text-base font-semibold text-[#5A6670]">编辑展示卡片</h2>
                      <button
                        onClick={() => setEditingSlotId(null)}
                        className="grid h-8 w-8 place-items-center rounded-full text-[#5A6670]/40 transition hover:bg-[#FAFBF7] hover:text-[#5A6670]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="relative mb-5 aspect-[4/3] overflow-hidden rounded-[8px] bg-[#D6E8F0]/24 border border-[#D8DDD8]">
                      <LocalPrivacyImage
                        className="h-full w-full object-cover"
                        src={src}
                        alt={`${slot.city} 登录照片预览`}
                        fill
                        sizes="320px"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                        <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/30">
                          <Upload className="h-4 w-4" />
                          更换图片
                          <input
                            className="hidden"
                            type="file"
                            accept="image/*"
                            onChange={(event) => updateLoginPhoto(slot.id, event)}
                            disabled={isWorking || !isAdmin}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[#5A6670]/60">标题</label>
                        <input
                          className="w-full rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] px-3 py-2 text-sm font-semibold text-[#5A6670] outline-none transition focus:border-[#E8B8C2] focus:bg-white"
                          value={titleValue}
                          onChange={(event) => updateLoginPhotoText(slot.id, "city", event.target.value)}
                          disabled={!isAdmin}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[#5A6670]/60">副标题</label>
                        <input
                          className="w-full rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] px-3 py-2 text-sm text-[#5A6670] outline-none transition focus:border-[#E8B8C2] focus:bg-white"
                          value={labelValue}
                          onChange={(event) => updateLoginPhotoText(slot.id, "label", event.target.value)}
                          disabled={!isAdmin}
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-[#D8DDD8]/40 pt-4">
                      <div className="flex gap-2">
                        <button
                          className="flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-xs font-semibold text-[#5A6670]/60 transition hover:bg-[#FAFBF7] hover:text-[#5A6670] disabled:opacity-30"
                          type="button"
                          onClick={() => resetLoginPhotoText(slot.id)}
                          disabled={isWorking || !isAdmin || !customText}
                        >
                          恢复文字
                        </button>
                        <button
                          className="flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-xs font-semibold text-[#E8B8C2] transition hover:bg-[#F5DCE0]/30 disabled:opacity-30"
                          type="button"
                          onClick={() => resetLoginPhoto(slot.id)}
                          disabled={isWorking || !isAdmin || !customPhoto}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          恢复图片
                        </button>
                      </div>
                      <button
                        className="rounded-[8px] bg-[#E8B8C2] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#D6A6B0]"
                        type="button"
                        onClick={() => setEditingSlotId(null)}
                      >
                        完成
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {status && (
        <div className="fixed bottom-6 right-6 z-50 rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/90 px-4 py-3 text-sm text-[#5A6670]/80 shadow-lg backdrop-blur">
          {status}
        </div>
      )}
    </MemoryPageShell>
  );
}
