"use client";

import { type ChangeEvent } from 'react';
import { LocalPrivacyImage } from '@/components/LocalPrivacyImage';
import { compressImageFile } from '@/utils/imageCompression';
import {
  writeAppSettings,
  defaultCoupleLogo,
  type AppSettings,
} from '@/data/appSettings';

interface LogoSectionProps {
  isAdmin: boolean;
  appSettings: AppSettings;
  setAppSettings: (v: AppSettings) => void;
  isWorking: boolean;
  setIsWorking: (v: boolean) => void;
  setStatus: (v: string) => void;
}

export function LogoSection({
  isAdmin,
  appSettings,
  setAppSettings,
  isWorking,
  setIsWorking,
  setStatus,
}: Readonly<LogoSectionProps>) {
  const coupleLogo = appSettings.coupleLogo ?? defaultCoupleLogo;

  const updateBasicSetting = (patch: Partial<AppSettings>) => {
    const next = { ...appSettings, ...patch };
    setAppSettings(next);
    writeAppSettings(next);
  };

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

  return (
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
                id="logoFileInput"
                name="logoFileInput"
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
  );
}
