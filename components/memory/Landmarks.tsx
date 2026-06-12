"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { MemoryPageShell } from "@/components/MemoryNav";
import { useAdminMode } from "@/hooks/useAdminMode";
import { cities, cityFallbackSprite } from "@/data/cities";
import { ImagePlus, MapPin, Search, Trash2 } from "lucide-react";
import { readCompressedImageDataUrl } from "@/utils/imageUtils";
import { landmarkPhotoMaxDimension, landmarkPhotoQuality, type CityAssetStore } from "@/components/province/Shared";
import { LocalPrivacyImg } from "@/components/LocalPrivacyImage";
import { writeAdminMode } from "@/data/adminMode";

export default function LandmarksPage() {
  const isAdmin = useAdminMode();
  const [cityAssets, setCityAssets] = useState<CityAssetStore>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingCityId, setSavingCityId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeCityIdRef = useRef<string>("");

  const ITEMS_PER_PAGE = 9;

  useEffect(() => {
    fetch("/api/city-assets")
      .then((res) => res.json())
      .then((data) => {
        if (data.assets) setCityAssets(data.assets);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return cities;
    const q = searchQuery.toLowerCase();
    return cities.filter(
      (c) => c.name.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredCities.length / ITEMS_PER_PAGE);
  const paginatedCities = filteredCities.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handlePickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const cityId = activeCityIdRef.current;
    if (!isAdmin) {
      alert("请先进入管理员模式");
      return;
    }
    if (!file || !file.type.startsWith("image/") || !cityId) return;

    setSavingCityId(cityId);
    try {
      const dataUrl = await readCompressedImageDataUrl(file, {
        maxDimension: landmarkPhotoMaxDimension,
        quality: landmarkPhotoQuality,
      });

      const response = await fetch("/api/city-assets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId, image: dataUrl }),
      });

      if (response.status === 401 || response.status === 403) {
        writeAdminMode(false);
        throw new Error("Admin session expired");
      }
      if (!response.ok) throw new Error("Failed to save city asset");

      const data = await response.json();
      setCityAssets(data.assets);
    } catch (err) {
      alert("保存地标失败，请重试");
    } finally {
      setSavingCityId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (cityId: string) => {
    if (!isAdmin) {
      alert("请先进入管理员模式");
      return;
    }
    const confirmed = window.confirm("确定要删除这个自定义地标吗？");
    if (!confirmed) return;

    setSavingCityId(cityId);
    try {
      const response = await fetch("/api/city-assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId }),
      });

      if (response.status === 401 || response.status === 403) {
        writeAdminMode(false);
        throw new Error("Admin session expired");
      }
      if (!response.ok) throw new Error("Failed to delete city asset");

      const data = await response.json();
      setCityAssets(data.assets);
    } catch (err) {
      alert("删除失败，请重试");
    } finally {
      setSavingCityId("");
    }
  };

  const handleUploadClick = (cityId: string) => {
    activeCityIdRef.current = cityId;
    fileInputRef.current?.click();
  };

  return (
    <MemoryPageShell active="landmarks">
      <div className="mx-auto max-w-4xl pb-24">
        <header className="mb-10 flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-3">
              <MapPin className="h-8 w-8 fill-[#D6E8F0] text-[#A8C8DC]" />
              <h1 className="text-[34px] font-semibold leading-tight text-[#5A6670]">地标管理</h1>
            </div>
            <p className="mt-2 text-sm font-medium text-[#5A6670]/58">
              为地图上的城市上传独一无二的自定义地标小圆图标
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/72 px-4 py-2 text-sm font-semibold text-[#5A6670]/62 shadow-[0_8px_24px_rgba(90,102,112,0.08)] backdrop-blur">
              已自定义 {Object.keys(cityAssets).length} / {cities.length}
            </div>
          </div>
        </header>

        <div className="mb-6 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6670]/40" />
            <input
              type="text"
              placeholder="搜索城市..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] py-2.5 pl-9 pr-4 text-sm text-[#5A6670] outline-none transition focus:border-[#E8B8C2]"
            />
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePickFile}
        />

        {loading ? (
          <div className="py-20 text-center text-sm text-[#5A6670]/50">加载中...</div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {paginatedCities.map((city) => {
                const customAsset = cityAssets[city.id];
                const displaySprite = customAsset ?? city.sprite;
                const isCustom = Boolean(customAsset);

                return (
                  <div
                    key={city.id}
                    className="flex flex-col items-center gap-3 rounded-[12px] border border-[#D8DDD8]/70 bg-white/50 p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7]">
                      <LocalPrivacyImg
                        src={displaySprite}
                        alt={city.name}
                        className="h-full w-full object-contain"
                      />
                    </div>

                    <div className="text-center min-w-0 w-full">
                      <p className="truncate text-base font-semibold text-[#5A6670]">{city.name}</p>
                      <p className="mt-0.5 text-xs text-[#5A6670]/50">
                        {isCustom ? "已自定义" : "默认地标"}
                      </p>
                    </div>

                    <div className="mt-2 flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUploadClick(city.id)}
                        disabled={savingCityId === city.id || !isAdmin}
                        className="flex items-center gap-1.5 rounded-[6px] border border-[#A8C8DC] px-3 py-1.5 text-xs font-semibold text-[#A8C8DC] transition hover:bg-[#D6E8F0]/30 disabled:opacity-50"
                        title={isCustom ? "替换地标" : "上传地标"}
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        {isCustom ? "替换" : "上传"}
                      </button>
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDelete(city.id)}
                          disabled={savingCityId === city.id || !isAdmin}
                          className="flex items-center gap-1.5 rounded-[6px] border border-[#F5DCE0] px-3 py-1.5 text-xs font-semibold text-[#E8B8C2] transition hover:bg-[#F5DCE0]/50 disabled:opacity-50"
                          title="删除自定义地标"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          重置
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-[6px] border border-[#D8DDD8] px-3 py-1.5 text-sm text-[#5A6670]/70 transition hover:bg-[#FAFBF7] disabled:opacity-30"
                >
                  上一页
                </button>
                <span className="px-3 text-sm font-medium text-[#5A6670]/60">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-[6px] border border-[#D8DDD8] px-3 py-1.5 text-sm text-[#5A6670]/70 transition hover:bg-[#FAFBF7] disabled:opacity-30"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
        
        {!loading && filteredCities.length === 0 && (
          <div className="py-20 text-center text-sm text-[#5A6670]/50">
            没有找到相关城市
          </div>
        )}
      </div>
    </MemoryPageShell>
  );
}
