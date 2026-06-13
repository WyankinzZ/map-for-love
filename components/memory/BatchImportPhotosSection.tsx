"use client";

import { useRef, useState, useEffect } from 'react';
import { ImagePlus, CheckCircle2, AlertCircle, Loader2, Trash2, ChevronLeft, ChevronRight, UploadCloud } from 'lucide-react';
import exifr from 'exifr';
import { cities } from '@/data/cities';
import { memoryStoreUpdatedEvent } from '@/data/progress';
import { CitySearchSelect } from '@/components/shared/CitySearchSelect';
import { readCompressedImageDataUrl } from '@/utils/imageUtils';
import { memoryPhotoMaxDimension, memoryPhotoQuality } from '@/components/province/Shared';
import { type MemoryMood, moodConfig } from '@/data/memories';

interface BatchImportPhotosSectionProps {
  isAdmin: boolean;
  isWorking: boolean;
  setIsWorking: (v: boolean) => void;
  setStatus: (v: string) => void;
  setMemoryCount: (v: number) => void;
}

function findClosestCity(lat: number, lng: number) {
  let closestCity = cities[0];
  let minDistance = Number.MAX_VALUE;

  for (const city of cities) {
    const dist = Math.pow(city.lat - lat, 2) + Math.pow(city.lng - lng, 2);
    if (dist < minDistance) {
      minDistance = dist;
      closestCity = city;
    }
  }
  return closestCity;
}

interface StagedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  date: string;
  cityId: string;
  mood?: MemoryMood;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMsg?: string;
}

const PAGE_SIZE = 5;

export function BatchImportPhotosSection({
  isAdmin,
  isWorking,
  setIsWorking,
  setStatus,
  setMemoryCount,
}: Readonly<BatchImportPhotosSectionProps>) {
  const importPhotosRef = useRef<HTMLInputElement>(null);
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Clean up object URLs when unmounting
  useEffect(() => {
    return () => {
      stagedPhotos.forEach(p => URL.revokeObjectURL(p.previewUrl));
    };
  }, [stagedPhotos]);

  const handleSelectPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!isAdmin) {
      setStatus("请先进入管理员模式");
      return;
    }
    if (!files.length || isWorking || isAnalyzing) return;

    setIsAnalyzing(true);
    setStatus(`正在分析 ${files.length} 张照片信息...`);

    const newPhotos: StagedPhoto[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let lat = null, lng = null, dateObj = null;

      try {
        const exifData = await exifr.parse(file, { tiff: true, exif: true, gps: true });
        if (exifData) {
          lat = exifData.latitude;
          lng = exifData.longitude;
          dateObj = exifData.DateTimeOriginal;
        }
      } catch (err) {
        console.error("EXIF parsing error", err);
      }

      let cityId = "";
      let formattedDate = "";

      if (lat && lng) {
        cityId = findClosestCity(lat, lng).id;
      }

      if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
      } else {
        // Fallback to file modification time
        const fileDate = new Date(file.lastModified);
        const year = fileDate.getFullYear();
        const month = String(fileDate.getMonth() + 1).padStart(2, '0');
        const day = String(fileDate.getDate()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
      }

      newPhotos.push({
        id: Math.random().toString(36).slice(2, 9),
        file,
        previewUrl: URL.createObjectURL(file),
        date: formattedDate,
        cityId,
        mood: 'happy',
        status: 'pending',
      });
    }

    setStagedPhotos(prev => [...prev, ...newPhotos]);
    setIsAnalyzing(false);
    setStatus("照片信息分析完成，请核对并导入。");
    if (importPhotosRef.current) importPhotosRef.current.value = "";
  };

  const updateStagedPhoto = (id: string, updates: Partial<StagedPhoto>) => {
    setStagedPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeStagedPhoto = (id: string) => {
    setStagedPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return prev.filter(p => p.id !== id);
    });
  };

  const clearCompleted = () => {
    setStagedPhotos(prev => {
      const remaining = prev.filter(p => p.status !== 'success');
      prev.filter(p => p.status === 'success').forEach(p => URL.revokeObjectURL(p.previewUrl));
      return remaining;
    });
    setCurrentPage(1);
  };

  const importPendingPhotos = async () => {
    const pending = stagedPhotos.filter(p => p.status === 'pending' || p.status === 'error');
    if (pending.length === 0) return;

    setIsWorking(true);
    setStatus(`开始导入 ${pending.length} 张照片...`);

    let successCount = 0;

    for (const photo of pending) {
      if (!photo.cityId) {
        updateStagedPhoto(photo.id, { status: 'error', errorMsg: '请选择城市' });
        continue;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(photo.date)) {
        updateStagedPhoto(photo.id, { status: 'error', errorMsg: '请选择有效日期' });
        continue;
      }

      updateStagedPhoto(photo.id, { status: 'uploading' });

      try {
        const city = cities.find(c => c.id === photo.cityId)!;
        const dataUrl = await readCompressedImageDataUrl(photo.file, {
          maxDimension: memoryPhotoMaxDimension,
          quality: memoryPhotoQuality,
        });
        
        const memoryPayload = {
          cityId: city.id,
          date: photo.date.replace(/-/g, '.'),
          text: `自动导入的${city.name}回忆。`,
          image: dataUrl,
          photos: [dataUrl],
          mood: photo.mood || 'happy',
        };

        const response = await fetch("/api/memories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memory: memoryPayload }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.memories) {
            window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent, { detail: data.memories }));
            setMemoryCount(Object.values(data.memories).flat().length);
            updateStagedPhoto(photo.id, { status: 'success', errorMsg: undefined });
            successCount++;
          }
        } else {
          const err = await response.json().catch(() => ({}));
          updateStagedPhoto(photo.id, { status: 'error', errorMsg: err.error || '导入失败' });
        }
      } catch (err) {
        updateStagedPhoto(photo.id, { status: 'error', errorMsg: '网络或处理错误' });
      }
    }

    setIsWorking(false);
    setStatus(`导入完成，成功 ${successCount} 张，失败 ${pending.length - successCount} 张。`);
  };

  const totalPages = Math.max(1, Math.ceil(stagedPhotos.length / PAGE_SIZE));
  const currentPhotos = stagedPhotos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/76 p-5 shadow-[0_12px_28px_rgba(90,102,112,0.06)] md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#5A6670]">批量导入照片与重处理</p>
          <p className="mt-2 text-sm leading-6 text-[#5A6670]/62">
            选择多张照片后，会在此处分页列出。你可以检查提取的城市和时间，若提取失败或有误，可手动修正后再导入。
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={importPhotosRef}
            className="hidden"
            type="file"
            multiple
            accept="image/*"
            onChange={handleSelectPhotos}
            disabled={!isAdmin}
          />
          <button
            className="flex items-center gap-2 rounded-[7px] bg-[#D6E8F0] px-4 py-2 text-sm font-semibold text-[#5A6670] transition hover:bg-[#A8C8DC] disabled:opacity-45"
            type="button"
            onClick={() => importPhotosRef.current?.click()}
            disabled={isWorking || isAnalyzing || !isAdmin}
          >
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {isAnalyzing ? '分析中...' : '选择照片'}
          </button>
        </div>
      </div>

      {stagedPhotos.length > 0 && (
        <div className="mt-6 border-t border-[#D8DDD8]/50 pt-5">
          <div className="space-y-4">
            {currentPhotos.map(photo => (
              <div key={photo.id} className="flex flex-wrap items-center gap-4 rounded-[8px] border border-[#D8DDD8]/50 bg-white p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[4px] border border-[#D8DDD8]">
                  <img src={photo.previewUrl} alt="preview" className="h-full w-full object-cover" />
                </div>
                
                <div className="flex flex-1 flex-wrap items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-[#5A6670]/70">时间</label>
                    <input
                      type="date"
                      className="h-[42px] w-36 rounded-[8px] border border-[#D8DDD8] px-3 py-1.5 text-sm text-[#5A6670] outline-none transition focus:border-[#A8C8DC] disabled:opacity-60 bg-[#FAFBF7]"
                      value={photo.date}
                      onChange={e => updateStagedPhoto(photo.id, { date: e.target.value })}
                      disabled={photo.status === 'uploading' || photo.status === 'success'}
                    />
                  </div>

                  <div className="flex flex-col gap-1 w-44">
                    <label className="text-xs font-semibold text-[#5A6670]/70">城市</label>
                    <CitySearchSelect
                      value={photo.cityId}
                      onChange={(cityId) => updateStagedPhoto(photo.id, { cityId })}
                      disabled={photo.status === 'uploading' || photo.status === 'success'}
                      accent="blue"
                    />
                  </div>

                  <div className="flex flex-col gap-1 w-28">
                    <label className="text-xs font-semibold text-[#5A6670]/70">心情</label>
                    <select
                      className="h-[42px] w-full rounded-[8px] border border-[#D8DDD8] px-3 py-1.5 text-sm text-[#5A6670] outline-none transition focus:border-[#A8C8DC] disabled:opacity-60 bg-[#FAFBF7]"
                      value={photo.mood || "happy"}
                      onChange={(e) => updateStagedPhoto(photo.id, { mood: e.target.value as MemoryMood })}
                      disabled={photo.status === 'uploading' || photo.status === 'success'}
                    >
                      {(Object.entries(moodConfig) as [MemoryMood, { emoji: string; label: string }][]).map(([key, info]) => (
                        <option key={key} value={key}>
                          {info.emoji} {info.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                  {photo.status === 'pending' && <span className="text-sm text-[#5A6670]/60">等待导入</span>}
                  {photo.status === 'uploading' && <Loader2 className="h-5 w-5 animate-spin text-[#A8C8DC]" />}
                  {photo.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  {photo.status === 'error' && (
                    <div className="flex items-center gap-1 text-red-400" title={photo.errorMsg}>
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-xs max-w-[100px] truncate">{photo.errorMsg}</span>
                    </div>
                  )}

                  {photo.status !== 'uploading' && (
                    <button
                      onClick={() => removeStagedPhoto(photo.id)}
                      className="rounded p-1.5 text-[#5A6670]/40 transition hover:bg-red-50 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                className="rounded p-1 text-[#5A6670] hover:bg-[#D8DDD8]/40 disabled:opacity-30"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-semibold text-[#5A6670]">
                {currentPage} / {totalPages}
              </span>
              <button
                className="rounded p-1 text-[#5A6670] hover:bg-[#D8DDD8]/40 disabled:opacity-30"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="ml-2 text-xs text-[#5A6670]/60">共 {stagedPhotos.length} 张</span>
            </div>

            <div className="flex gap-2">
              {stagedPhotos.some(p => p.status === 'success') && (
                <button
                  className="rounded-[7px] border border-[#D8DDD8] px-4 py-2 text-sm font-semibold text-[#5A6670]/70 transition hover:bg-[#FAFBF7]"
                  onClick={clearCompleted}
                  disabled={isWorking}
                >
                  清除已完成
                </button>
              )}
              {stagedPhotos.some(p => p.status === 'pending' || p.status === 'error') && (
                <button
                  className="flex items-center gap-2 rounded-[7px] bg-[#A8C8DC] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#8AB1C9] disabled:opacity-50"
                  onClick={importPendingPhotos}
                  disabled={isWorking}
                >
                  <UploadCloud className="h-4 w-4" />
                  导入待处理项
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
