"use client";

import { useEffect, useState } from "react";
import { Cloud, Save } from "lucide-react";
import { getStoredOssConfig, saveOssConfig, type OssConfig } from "@/lib/client/oss";
import { getStorageMode } from "@/lib/client/storage";

interface OssSectionProps {
  isAdmin: boolean;
  setStatus: (v: string) => void;
  setIsWorking: (v: boolean) => void;
  isWorking: boolean;
}

export function OssSection({
  isAdmin,
  setStatus,
  setIsWorking,
  isWorking,
}: Readonly<OssSectionProps>) {
  const [region, setRegion] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [accessKeySecret, setAccessKeySecret] = useState("");
  const [bucket, setBucket] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    getStoredOssConfig().then((localConfig) => {
      if (localConfig?.accessKeyId) {
        setRegion(localConfig.region || "");
        setAccessKeyId(localConfig.accessKeyId || "");
        setAccessKeySecret(localConfig.accessKeySecret || "");
        setBucket(localConfig.bucket || "");
        setHasLoaded(true);
        return;
      }

      // Try server-side OSS config (desktop)
      fetch("/api/settings/oss")
        .then((res) => {
          if (!res.ok) throw new Error("API not available");
          return res.json();
        })
        .then((data: { config?: OssConfig }) => {
          if (data.config?.accessKeyId) {
            setRegion(data.config.region || "");
            setAccessKeyId(data.config.accessKeyId || "");
            setAccessKeySecret(data.config.accessKeySecret || "");
            setBucket(data.config.bucket || "");
            saveOssConfig(data.config);
          }
          setHasLoaded(true);
        })
        .catch(() => setHasLoaded(true));
    });
  }, [isAdmin]);

  const handleSave = async () => {
    setIsWorking(true);
    setStatus("");
    const config = {
      region: region.trim(),
      accessKeyId: accessKeyId.trim(),
      accessKeySecret: accessKeySecret.trim(),
      bucket: bucket.trim(),
    };

    if (!config.region || !config.accessKeyId || !config.accessKeySecret || !config.bucket) {
      setIsWorking(false);
      setStatus("请完整填写 OSS 参数");
      return;
    }

    // Save to client localStorage
    await saveOssConfig(config);

    // Save to server-side OSS config (desktop / backend)
    try {
      await fetch("/api/settings/oss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    } catch {
      // Offline or client-only
    }

    setIsWorking(false);
    setStatus("阿里云 OSS 配置已保存，新上传照片将备份至云端");
  };

  const handleClear = async () => {
    setIsWorking(true);
    setStatus("");

    // Clear client localStorage
    await saveOssConfig(null);

    // Clear server-side OSS config
    try {
      await fetch("/api/settings/oss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: "", accessKeyId: "", accessKeySecret: "", bucket: "" }),
      });
    } catch {
      // ignore
    }

    setRegion("");
    setAccessKeyId("");
    setAccessKeySecret("");
    setBucket("");
    setIsWorking(false);
    setStatus("OSS 配置已清除，新照片将直接保存在本地");
  };

  const isConfigured = Boolean(region && accessKeyId && accessKeySecret && bucket);

  return (
    <div className="md:col-span-2 rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/76 p-5 shadow-[0_12px_28px_rgba(90,102,112,0.06)]">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#5A6670]">
        <Cloud className="h-4 w-4" /> 阿里云 OSS 云端存储配置（选填）
      </p>
      <p className="mt-2 text-sm leading-6 text-[#5A6670]/62">
        系统默认使用<strong>纯本地存储</strong>，所有照片保存在本机电脑中，无需任何云端配置，开箱即用。若希望将照片备份同步至阿里云 OSS 云端，可在此填写 AccessKey；随时可点击“一键清除”恢复本地存储。（仅管理员模式下可见）
      </p>
      
      {!isAdmin ? (
        <div className="mt-4 rounded-[6px] border border-dashed border-[#E8B8C2] bg-[#F5DCE0]/20 p-4 text-center">
          <p className="text-sm font-semibold text-[#E8B8C2]">请先开启管理员模式</p>
        </div>
      ) : !hasLoaded ? (
        <div className="mt-4 p-4 text-center text-sm text-[#5A6670]/50">加载中...</div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ossRegion" className="block text-xs font-semibold text-[#5A6670]/70 mb-1">Region (如 oss-cn-hangzhou)</label>
            <input
              id="ossRegion"
              name="ossRegion"
              type="text"
              autoComplete="off"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-[6px] border border-[#D8DDD8] px-3 py-2 text-sm outline-none transition focus:border-[#A8C8DC]"
              placeholder="oss-cn-hangzhou"
            />
          </div>
          <div>
            <label htmlFor="ossBucket" className="block text-xs font-semibold text-[#5A6670]/70 mb-1">Bucket 名称</label>
            <input
              id="ossBucket"
              name="ossBucket"
              type="text"
              autoComplete="off"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full rounded-[6px] border border-[#D8DDD8] px-3 py-2 text-sm outline-none transition focus:border-[#A8C8DC]"
              placeholder="你的 bucket 名称"
            />
          </div>
          <div>
            <label htmlFor="ossAccessKeyId" className="block text-xs font-semibold text-[#5A6670]/70 mb-1">AccessKeyId</label>
            <input
              id="ossAccessKeyId"
              name="ossAccessKeyId"
              type="password"
              autoComplete="off"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              className="w-full rounded-[6px] border border-[#D8DDD8] px-3 py-2 text-sm outline-none transition focus:border-[#A8C8DC]"
              placeholder="你的 AccessKeyId"
            />
          </div>
          <div>
            <label htmlFor="ossAccessKeySecret" className="block text-xs font-semibold text-[#5A6670]/70 mb-1">AccessKeySecret</label>
            <input
              id="ossAccessKeySecret"
              name="ossAccessKeySecret"
              type="password"
              autoComplete="off"
              value={accessKeySecret}
              onChange={(e) => setAccessKeySecret(e.target.value)}
              className="w-full rounded-[6px] border border-[#D8DDD8] px-3 py-2 text-sm outline-none transition focus:border-[#A8C8DC]"
              placeholder="你的 AccessKeySecret"
            />
          </div>
        </div>
      )}

      {isAdmin && hasLoaded && (
        <div className="mt-6 flex flex-col gap-4 border-t border-[#D8DDD8]/50 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <span className={`text-xs font-semibold ${isConfigured ? 'text-[#A8C8DC]' : 'text-[#5A6670]/70'}`}>
            {isConfigured ? '✅ OSS 云端存储已开启' : '🏠 纯本地存储模式（无需 OSS，照片直接保存在本机）'}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="whitespace-nowrap flex items-center gap-2 rounded-[7px] border border-[#D8DDD8] px-4 py-2 text-sm font-semibold text-[#5A6670]/70 transition hover:bg-[#FAFBF7] disabled:opacity-50"
              type="button"
              onClick={handleClear}
              disabled={isWorking}
            >
              一键清除
            </button>
            <button
              className="whitespace-nowrap flex items-center gap-2 rounded-[7px] bg-[#5A6670] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5A6670]/80 disabled:opacity-50"
              type="button"
              onClick={handleSave}
              disabled={isWorking}
            >
              <Save className="h-4 w-4" />
              保存 OSS 配置
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
