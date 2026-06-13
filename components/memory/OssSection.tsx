"use client";

import { useEffect, useState } from "react";
import { Cloud, Save } from "lucide-react";

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
    fetch("/api/settings/oss")
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          setRegion(data.config.region || "");
          setAccessKeyId(data.config.accessKeyId || "");
          setAccessKeySecret(data.config.accessKeySecret || "");
          setBucket(data.config.bucket || "");
        }
        setHasLoaded(true);
      })
      .catch(() => {
        setHasLoaded(true);
      });
  }, [isAdmin]);

  const handleSave = async () => {
    setIsWorking(true);
    setStatus("");
    try {
      const response = await fetch("/api/settings/oss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, accessKeyId, accessKeySecret, bucket }),
      });
      if (!response.ok) throw new Error("Failed to save OSS config");
      setStatus("阿里云 OSS 配置已保存，照片将优先上传至云端");
    } catch {
      setStatus("保存 OSS 配置失败");
    } finally {
      setIsWorking(false);
    }
  };

  const handleClear = async () => {
    setIsWorking(true);
    setStatus("");
    try {
      const response = await fetch("/api/settings/oss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: "", accessKeyId: "", accessKeySecret: "", bucket: "" }),
      });
      if (!response.ok) throw new Error("Failed to clear OSS config");
      setRegion("");
      setAccessKeyId("");
      setAccessKeySecret("");
      setBucket("");
      setStatus("阿里云 OSS 配置已清除，照片将恢复为本地存储");
    } catch {
      setStatus("清除 OSS 配置失败");
    } finally {
      setIsWorking(false);
    }
  };

  const isConfigured = Boolean(region && accessKeyId && accessKeySecret && bucket);

  return (
    <div className="md:col-span-2 rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/76 p-5 shadow-[0_12px_28px_rgba(90,102,112,0.06)]">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#5A6670]">
        <Cloud className="h-4 w-4" /> 阿里云 OSS 存储配置
      </p>
      <p className="mt-2 text-sm leading-6 text-[#5A6670]/62">
        如果绑定了 AccessKey，之后上传的照片将直接存入阿里云 OSS 云端；如果没有绑定或信息不完整，照片将默认存储在本地。（只在管理员模式下可见）
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
            <label className="block text-xs font-semibold text-[#5A6670]/70 mb-1">Region (如 oss-cn-hangzhou)</label>
            <input
              type="password"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-[6px] border border-[#D8DDD8] px-3 py-2 text-sm outline-none transition focus:border-[#A8C8DC]"
              placeholder="oss-cn-hangzhou"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5A6670]/70 mb-1">Bucket 名称</label>
            <input
              type="password"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full rounded-[6px] border border-[#D8DDD8] px-3 py-2 text-sm outline-none transition focus:border-[#A8C8DC]"
              placeholder="你的 bucket 名称"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5A6670]/70 mb-1">AccessKeyId</label>
            <input
              type="password"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              className="w-full rounded-[6px] border border-[#D8DDD8] px-3 py-2 text-sm outline-none transition focus:border-[#A8C8DC]"
              placeholder="你的 AccessKeyId"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5A6670]/70 mb-1">AccessKeySecret</label>
            <input
              type="password"
              value={accessKeySecret}
              onChange={(e) => setAccessKeySecret(e.target.value)}
              className="w-full rounded-[6px] border border-[#D8DDD8] px-3 py-2 text-sm outline-none transition focus:border-[#A8C8DC]"
              placeholder="你的 AccessKeySecret"
            />
          </div>
        </div>
      )}

      {isAdmin && hasLoaded && (
        <div className="mt-6 flex items-center justify-between border-t border-[#D8DDD8]/50 pt-5">
          <span className={`text-xs font-semibold ${isConfigured ? 'text-[#A8C8DC]' : 'text-[#5A6670]/50'}`}>
            {isConfigured ? '✅ OSS 参数已填写' : 'ℹ️ 未开启云端存储，使用本地存储'}
          </span>
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2 rounded-[7px] border border-[#D8DDD8] px-4 py-2 text-sm font-semibold text-[#5A6670]/70 transition hover:bg-[#FAFBF7] disabled:opacity-50"
              type="button"
              onClick={handleClear}
              disabled={isWorking}
            >
              一键清除
            </button>
            <button
              className="flex items-center gap-2 rounded-[7px] bg-[#5A6670] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5A6670]/80 disabled:opacity-50"
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
