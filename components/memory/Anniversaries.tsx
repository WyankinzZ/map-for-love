"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  CalendarDays,
  Heart,
  Sparkles,
  Cake,
  HeartHandshake,
  Gift,
  Flame,
  Plus,
  X,
  ImagePlus,
  Pencil,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  MapPin,
  Calendar,
  Clock,
  Wine,
  PartyPopper,
  Crown,
  Quote,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cities } from "@/data/cities";
import { MemoryPageShell } from "@/components/MemoryNav";
import { useAdminMode } from "@/hooks/useAdminMode";
import { CitySearchSelect } from "@/components/shared/CitySearchSelect";
import { Lightbox } from "@/components/shared/Lightbox";
import { LocalPrivacyImg } from "@/components/LocalPrivacyImage";
import { readCompressedImageDataUrl } from "@/utils/imageUtils";
import { readJson, writeJson } from "@/lib/client/storage";
import { scrollToPageTop } from "@/lib/client/scroll";
import { DateDropdownSelect } from "@/components/shared/DateDropdownSelect";

export type AnniversaryCategory = "love" | "marriage" | "birthday" | "first" | "special";

export interface AnniversaryRecord {
  id: string;
  title: string;
  date?: string;          // 纪念日期 (YYYY.MM.DD)
  note: string;           // 纪念感悟 / 故事
  cityId?: string;        // 关联城市 (可选)
  customLocation?: string;// 自定义发生地点 (可选)

  // 📸 图片画廊 (纪念照、合影、蛋糕鲜花、礼物照片)
  images: string[];
  coverImage?: string;

  // 🏷️ 类别
  category: AnniversaryCategory;

  // 🎂 周年循环设置 (默认每年倒计时)
  isAnnual?: boolean;

  // 🎁 庆祝心愿与礼物纪念
  celebrationPlan?: string; // 庆祝计划 (如: 定好江景餐厅、准备手写信)
  giftMemory?: string;      // 纪念礼物 (如: 拍立得相机、银质对戒)

  // ❤️ 喜欢与珍藏
  liked?: boolean;
  likeCount?: number;
}

const STORAGE_KEY = "mapofus:anniversaries";

export const CATEGORY_CONFIG: Record<
  AnniversaryCategory,
  { label: string; icon: any; color: string; bg: string; text: string }
> = {
  love: { label: "相恋相守", icon: Heart, color: "#E8B8C2", bg: "bg-[#F5DCE0]/70", text: "text-[#D98A98]" },
  marriage: { label: "领证结婚", icon: HeartHandshake, color: "#F2A97F", bg: "bg-[#FDE8DD]/70", text: "text-[#E69363]" },
  birthday: { label: "彼此生日", icon: Cake, color: "#A8C8DC", bg: "bg-[#D6E8F0]/70", text: "text-[#7BA6C0]" },
  first: { label: "初次初见", icon: Sparkles, color: "#9BBDA8", bg: "bg-[#E2EFE7]/70", text: "text-[#729A81]" },
  special: { label: "特别纪念", icon: Gift, color: "#D4A5C6", bg: "bg-[#F6EBF3]/70", text: "text-[#BA7EA8]" },
};

// Helper: Calculate total cumulative days since start date
function calculateTotalDays(dateStr?: string): number {
  if (!dateStr) return 1;
  const parts = dateStr.split(/[./-]/).map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return 1;
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffTime = start.getTime() - target.getTime();
  return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
}

// Helper: Calculate next annual recurrence milestone
function calculateNextAnnual(dateStr?: string): { daysLeft: number; targetYear: number; milestoneYears: number } {
  if (!dateStr) return { daysLeft: 0, targetYear: new Date().getFullYear(), milestoneYears: 1 };
  const parts = dateStr.split(/[./-]/).map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return { daysLeft: 0, targetYear: new Date().getFullYear(), milestoneYears: 1 };
  }

  const [origYear, origMonth, origDay] = parts;
  const today = new Date();
  const currentYear = today.getFullYear();

  let target = new Date(currentYear, origMonth - 1, origDay);
  target.setHours(0, 0, 0, 0);

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let targetYear = currentYear;
  if (target.getTime() < start.getTime()) {
    targetYear = currentYear + 1;
    target = new Date(targetYear, origMonth - 1, origDay);
  }

  const diffTime = target.getTime() - start.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const milestoneYears = Math.max(1, targetYear - origYear);

  return { daysLeft, targetYear, milestoneYears };
}

// Normalize anniversary record
function normalizeAnniversary(raw: any): AnniversaryRecord {
  return {
    id: raw.id || `anniv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: raw.title || "未命名纪念日",
    date: raw.date || new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "."),
    note: raw.note || raw.content || "",
    cityId: raw.cityId,
    customLocation: raw.customLocation || "",
    images: Array.isArray(raw.images) ? raw.images : (raw.image ? [raw.image] : []),
    coverImage: raw.coverImage || raw.images?.[0] || "",
    category: raw.category || "love",
    isAnnual: raw.isAnnual !== undefined ? Boolean(raw.isAnnual) : true,
    celebrationPlan: raw.celebrationPlan || "",
    giftMemory: raw.giftMemory || "",
    liked: Boolean(raw.liked),
    likeCount: typeof raw.likeCount === "number" ? raw.likeCount : 1,
  };
}

export default function AnniversariesPage() {
  const isAdmin = useAdminMode();
  const [items, setItems] = useState<AnniversaryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Detail Modal
  const [activeAnniversary, setActiveAnniversary] = useState<AnniversaryRecord | null>(null);
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formCategory, setFormCategory] = useState<AnniversaryCategory>("love");
  const [formNote, setFormNote] = useState("");
  const [formCityId, setFormCityId] = useState("");
  const [formCustomLocation, setFormCustomLocation] = useState("");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formCelebrationPlan, setFormCelebrationPlan] = useState("");
  const [formGiftMemory, setFormGiftMemory] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination & responsive item count (桌面4个/页，手机端2个/页)
  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const isFirstMountRef = useRef(true);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== "undefined" ? window.innerWidth < 640 : false);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const itemsPerPage = isMobile ? 2 : 4;

  // Load items from localStorage & remote sync
  useEffect(() => {
    let localData: AnniversaryRecord[] = [];
    if (typeof window !== "undefined") {
      try {
        const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
        if (Array.isArray(raw)) {
          localData = raw.map(normalizeAnniversary);
          setItems(localData);
        }
      } catch (err) {
        console.error("Failed to parse local anniversaries", err);
      }
    }

    readJson<any[]>("anniversaries", localData)
      .then((remoteData) => {
        if (Array.isArray(remoteData) && remoteData.length > 0) {
          const normalized = remoteData.map(normalizeAnniversary);
          setItems(normalized);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          }
        }
      })
      .catch((err) => console.warn("Remote anniversaries sync note:", err))
      .finally(() => setIsLoading(false));
  }, []);

  // Persist items
  const persistItems = useCallback((next: AnniversaryRecord[]) => {
    setItems(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    writeJson("anniversaries", next).catch((err) => {
      console.warn("Server persist failed, local data is safe:", err);
    });
  }, []);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const city = cities.find((c) => c.id === item.cityId);
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchNote = item.note.toLowerCase().includes(q);
        const matchCity = city?.name.toLowerCase().includes(q);
        const matchLoc = item.customLocation?.toLowerCase().includes(q);
        const matchPlan = item.celebrationPlan?.toLowerCase().includes(q);
        const matchGift = item.giftMemory?.toLowerCase().includes(q);
        if (!matchTitle && !matchNote && !matchCity && !matchLoc && !matchPlan && !matchGift) {
          return false;
        }
      }
      return true;
    });
  }, [items, selectedCategory, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, safeCurrentPage, itemsPerPage]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    scrollToPageTop();
  }, [currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, isMobile]);

  // Nearest upcoming anniversary for hero spotlight
  const nearestUpcomingAnniversary = useMemo(() => {
    if (items.length === 0) return null;
    const sorted = [...items].sort((a, b) => {
      const nextA = calculateNextAnnual(a.date).daysLeft;
      const nextB = calculateNextAnnual(b.date).daysLeft;
      return nextA - nextB;
    });
    return sorted[0] || null;
  }, [items]);

  // Like toggling
  const toggleLike = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = items.map((item) => {
      if (item.id === id) {
        const liked = !item.liked;
        const likeCount = (item.likeCount ?? 0) + (liked ? 1 : -1);
        return { ...item, liked, likeCount: Math.max(0, likeCount) };
      }
      return item;
    });
    persistItems(next);
    if (activeAnniversary && activeAnniversary.id === id) {
      setActiveAnniversary((prev) =>
        prev ? { ...prev, liked: !prev.liked, likeCount: (prev.likeCount ?? 0) + (!prev.liked ? 1 : -1) } : null,
      );
    }
  };

  // Delete
  const removeItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    if (!window.confirm("确定要删除这个纪念日吗？")) return;
    const next = items.filter((item) => item.id !== id);
    persistItems(next);
    if (activeAnniversary?.id === id) setActiveAnniversary(null);
  };

  // Open Create Form
  const openCreateForm = (catPreset?: AnniversaryCategory) => {
    if (!isAdmin) return;
    setEditingId(null);
    setFormTitle("");
    const todayStr = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, ".");
    setFormDate(todayStr);
    setFormCategory(catPreset || "love");
    setFormNote("");
    setFormCityId("");
    setFormCustomLocation("");
    setFormImages([]);
    setFormCelebrationPlan("");
    setFormGiftMemory("");
    setIsFormOpen(true);
  };

  // Open Edit Form
  const openEditForm = (item: AnniversaryRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormDate(item.date || "");
    setFormCategory(item.category || "love");
    setFormNote(item.note);
    setFormCityId(item.cityId || "");
    setFormCustomLocation(item.customLocation || "");
    setFormImages(item.images || []);
    setFormCelebrationPlan(item.celebrationPlan || "");
    setFormGiftMemory(item.giftMemory || "");
    setIsFormOpen(true);
  };

  // Image Upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);

    try {
      const readPromises = files.map((file) =>
        readCompressedImageDataUrl(file, {
          maxDimension: 1440,
          quality: 0.82,
        }),
      );
      const dataUrls = await Promise.all(readPromises);
      setFormImages((prev) => [...prev, ...dataUrls].slice(0, 9));
    } catch {
      alert("部分图片处理失败，请重试");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFormImage = (index: number) => {
    setFormImages((prev) => prev.filter((_, i) => i !== index));
  };

  const setCoverImage = (index: number) => {
    setFormImages((prev) => {
      const target = prev[index];
      const rest = prev.filter((_, i) => i !== index);
      return [target, ...rest];
    });
  };

  // Save Form
  const handleSaveForm = () => {
    if (!formTitle.trim()) {
      alert("请填写纪念日名称");
      return;
    }

    const todayStr = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, ".");

    const newRecord: AnniversaryRecord = {
      id: editingId || `anniv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: formTitle.trim(),
      date: formDate.trim() || todayStr,
      category: formCategory,
      note: formNote.trim(),
      cityId: formCityId || undefined,
      customLocation: formCustomLocation.trim(),
      images: formImages,
      coverImage: formImages[0] || "",
      isAnnual: true,
      celebrationPlan: formCelebrationPlan.trim(),
      giftMemory: formGiftMemory.trim(),
      liked: editingId ? (items.find((i) => i.id === editingId)?.liked ?? false) : false,
      likeCount: editingId ? (items.find((i) => i.id === editingId)?.likeCount ?? 1) : 1,
    };

    const next = editingId
      ? items.map((item) => (item.id === editingId ? newRecord : item))
      : [newRecord, ...items];

    persistItems(next);
    setIsFormOpen(false);
    if (activeAnniversary && activeAnniversary.id === editingId) {
      setActiveAnniversary(newRecord);
    }
  };

  return (
    <MemoryPageShell active="anniversaries">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full bg-[#F5DCE0]/80 text-[#E8B8C2] shadow-sm">
              <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight text-[#5A6670]">恋爱与重要纪念日</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm font-medium text-[#5A6670]/60">
            把生命中重要的日子珍重安放，慢慢倒数下一个周年的惊喜与感动。
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-full border border-[#D8DDD8]/80 bg-[#FAFBF7]/80 px-3 py-1.5 text-xs font-semibold text-[#5A6670]/70 shadow-sm backdrop-blur">
            <span>{items.length} 个珍贵日子</span>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => openCreateForm("love")}
              className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-[#E8B8C2] px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_6px_16px_rgba(232,184,194,0.4)] transition hover:bg-[#D6A6B0] active:scale-95"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>新增纪念日</span>
            </button>
          )}
        </div>
      </header>

      {/* 🎂 Hero Nearest Anniversary Highlight Banner */}
      {nearestUpcomingAnniversary && (
        <div className="mb-6 sm:mb-8 overflow-hidden rounded-[20px] border border-[#E8B8C2]/60 bg-gradient-to-r from-white via-[#FFF9FA] to-white p-4 sm:p-6 shadow-[0_12px_32px_rgba(232,184,194,0.14)] backdrop-blur">
          {(() => {
            const nextInfo = calculateNextAnnual(nearestUpcomingAnniversary.date);
            const totalDays = calculateTotalDays(nearestUpcomingAnniversary.date);
            const catInfo = CATEGORY_CONFIG[nearestUpcomingAnniversary.category] || CATEGORY_CONFIG.love;
            const Icon = catInfo.icon;

            return (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-[#E8B8C2] to-[#F5DCE0] text-white shadow-md">
                    <Icon className="h-7 w-7 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#F5DCE0] px-2.5 py-0.5 text-xs font-bold text-[#E8B8C2]">
                        最近即将到来
                      </span>
                      <span className="text-xs text-[#5A6670]/60">
                        {catInfo.label}
                      </span>
                    </div>
                    <h2 className="mt-1 text-xl sm:text-2xl font-black text-[#5A6670]">
                      {nearestUpcomingAnniversary.title}
                    </h2>
                    <p className="mt-1 text-xs text-[#5A6670]/65">
                      纪念日起源于 <strong className="text-[#5A6670]">{nearestUpcomingAnniversary.date}</strong> · 已相知相伴{" "}
                      <span className="font-bold text-[#E8B8C2]">{totalDays}</span> 天
                    </p>
                  </div>
                </div>

                {/* Annual Countdown Badge */}
                <div className="flex items-center gap-4 bg-white/80 p-3.5 rounded-2xl border border-[#E8B8C2]/40 shadow-xs">
                  <div className="text-center">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[#E8B8C2]">
                      第 {nextInfo.milestoneYears} 周年倒计时
                    </span>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-[#E8B8C2]">
                        {nextInfo.daysLeft === 0 ? "🎉 今天" : nextInfo.daysLeft}
                      </span>
                      {nextInfo.daysLeft !== 0 && <span className="text-xs font-bold text-[#5A6670]/70">天</span>}
                    </div>
                    <span className="text-[10px] text-[#5A6670]/50">
                      {nextInfo.daysLeft === 0 ? "纪念日快乐！" : "迎来下一个周年"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveAnniversary(nearestUpcomingAnniversary);
                      setDetailPhotoIndex(0);
                    }}
                    className="rounded-xl bg-[#E8B8C2] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#D6A6B0] transition"
                  >
                    重温回忆
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="mb-5 sm:mb-8 space-y-2.5 sm:space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6670]/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索纪念日名称、感悟、礼物灵感、地点..."
            className="w-full rounded-full border border-[#D8DDD8]/80 bg-white/70 py-2 pl-9 pr-8 text-xs sm:text-sm text-[#5A6670] outline-none transition placeholder:text-[#5A6670]/35 focus:border-[#E8B8C2] focus:bg-white focus:shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A6670]/40 hover:text-[#5A6670]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              selectedCategory === "all"
                ? "bg-[#E8B8C2] text-white shadow-sm"
                : "border border-[#D8DDD8]/80 bg-[#FAFBF7]/80 text-[#5A6670]/70 hover:border-[#E8B8C2]/60"
            }`}
          >
            <CalendarDays className={`h-3.5 w-3.5 ${selectedCategory === "all" ? "text-white" : "text-[#5A6670]/60"}`} />
            <span>全部纪念日</span>
            <span className={`text-[10px] ${selectedCategory === "all" ? "text-white/80" : "text-[#5A6670]/40"}`}>
              {items.length}
            </span>
          </button>

          {(Object.keys(CATEGORY_CONFIG) as AnniversaryCategory[]).map((cat) => {
            const conf = CATEGORY_CONFIG[cat];
            const Icon = conf.icon;
            const isSelected = selectedCategory === cat;
            const count = items.filter((i) => i.category === cat).length;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  isSelected
                    ? "bg-[#E8B8C2] text-white shadow-sm"
                    : "border border-[#D8DDD8]/80 bg-[#FAFBF7]/80 text-[#5A6670]/70 hover:border-[#E8B8C2]/60"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-white" : "text-[#5A6670]/60"}`} />
                <span>{conf.label}</span>
                <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-[#5A6670]/40"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Anniversary Cards */}
      {filteredItems.length > 0 ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-5">
            {paginatedItems.map((item) => {
              const totalDays = calculateTotalDays(item.date);
              const nextInfo = calculateNextAnnual(item.date);
              const catInfo = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.love;
              const Icon = catInfo.icon;
              const city = cities.find((c) => c.id === item.cityId);
              const cover = item.images && item.images.length > 0 ? item.images[0] : item.coverImage;

              return (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => {
                    setActiveAnniversary(item);
                    setDetailPhotoIndex(0);
                  }}
                  className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[16px] border border-[#D8DDD8]/80 bg-white/85 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#E8B8C2]/60 hover:shadow-[0_16px_36px_rgba(90,102,112,0.12)] backdrop-blur"
                >
                  {/* Card Media Preview */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#F5DCE0]/40 via-[#FAFBF7] to-[#D6E8F0]/30">
                    {cover ? (
                      <LocalPrivacyImg
                        src={cover}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#FAFBF7]/90 text-[#E8B8C2] shadow-inner">
                          <Icon className="h-6 w-6" />
                        </span>
                        <p className="mt-2 text-xs font-semibold text-[#5A6670]/70">
                          {item.title}
                        </p>
                        <span className="mt-1 text-[10px] text-[#5A6670]/40">点开上传纪念照与感悟</span>
                      </div>
                    )}

                    {/* Gradient shadow */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none" />

                    {/* Top-left Category Badge */}
                    <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                      <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                        {catInfo.label}
                      </span>
                    </div>

                    {/* Top-right Photo count */}
                    {item.images && item.images.length > 1 && (
                      <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                        <Camera className="h-3 w-3" />
                        {item.images.length}
                      </span>
                    )}

                    {/* Bottom overlay: Next Anniversary Countdown */}
                    <div className="absolute inset-x-2.5 bottom-2 flex items-center justify-between text-[11px] font-semibold text-white drop-shadow-md">
                      <span>{item.date} 起</span>
                      <span>
                        {nextInfo.daysLeft === 0 ? "🎉 今天是纪念日！" : `还有 ${nextInfo.daysLeft} 天迎第 ${nextInfo.milestoneYears} 周年`}
                      </span>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                    {/* Title */}
                    <h3 className="line-clamp-2 text-sm sm:text-base font-semibold leading-snug text-[#5A6670] group-hover:text-[#E8B8C2] transition-colors">
                      {item.title}
                    </h3>

                    {/* Cumulative Days & Location */}
                    <div className="mt-2 flex items-center justify-between text-xs text-[#5A6670]/60">
                      <span className="font-bold text-[#E8B8C2] text-xs">
                        已相知相守 {totalDays} 天
                      </span>
                      {(item.customLocation || city?.name) && (
                        <div className="flex items-center gap-1 text-[#A8C8DC] truncate max-w-[120px]">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{item.customLocation || city?.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Note */}
                    {item.note && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#5A6670]/65">
                        {item.note}
                      </p>
                    )}

                    {/* Celebration plan / Gift hint */}
                    {item.celebrationPlan && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-[#5A6670]/70 bg-[#FAFBF7] p-1.5 rounded border border-[#D8DDD8]/50 truncate">
                        <Wine className="h-3 w-3 text-[#E8B8C2] shrink-0" />
                        <span className="truncate">心愿：{item.celebrationPlan}</span>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-auto flex items-center justify-between border-t border-[#D8DDD8]/40 pt-3">
                      <span className="text-[11px] text-[#5A6670]/40">
                        {item.date}
                      </span>

                      <div className="flex items-center gap-2">
                        {/* Like button */}
                        <button
                          type="button"
                          onClick={(e) => toggleLike(item.id, e)}
                          className={`flex items-center gap-1 text-xs font-semibold transition active:scale-125 ${
                            item.liked ? "text-[#E8B8C2]" : "text-[#5A6670]/40 hover:text-[#E8B8C2]"
                          }`}
                          title="珍藏"
                        >
                          <Heart className={`h-4 w-4 ${item.liked ? "fill-[#E8B8C2]" : ""}`} />
                          <span>{item.likeCount ?? 0}</span>
                        </button>

                        {/* Admin actions */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => openEditForm(item, e)}
                              className="rounded p-1 text-[#5A6670]/50 hover:bg-[#D6E8F0]/40 hover:text-[#5A6670]"
                              title="编辑"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => removeItem(item.id, e)}
                              className="rounded p-1 text-[#5A6670]/50 hover:bg-[#F5DCE0]/50 hover:text-[#E8B8C2]"
                              title="删除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </section>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#D8DDD8]/40 pt-6">
              <span className="text-xs font-medium text-[#5A6670]/60 text-center sm:text-left">
                共 {filteredItems.length} 个纪念日 · 第 {safeCurrentPage} / {totalPages} 页
              </span>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(Math.max(1, safeCurrentPage - 1))}
                  disabled={safeCurrentPage === 1}
                  className="flex items-center gap-1 rounded-[8px] border border-[#D8DDD8] bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#5A6670] transition hover:border-[#E8B8C2] hover:text-[#E8B8C2] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>上一页</span>
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => handlePageChange(pageNum)}
                        className={`h-7 min-w-[28px] sm:min-w-[32px] px-1.5 rounded-[8px] text-xs font-semibold transition cursor-pointer ${
                          safeCurrentPage === pageNum
                            ? "bg-[#E8B8C2] text-white shadow-xs"
                            : "border border-[#D8DDD8] bg-white text-[#5A6670] hover:border-[#E8B8C2]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => handlePageChange(Math.min(totalPages, safeCurrentPage + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="flex items-center gap-1 rounded-[8px] border border-[#D8DDD8] bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#5A6670] transition hover:border-[#E8B8C2] hover:text-[#E8B8C2] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                >
                  <span>下一页</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[#D8DDD8] bg-white/40 py-20 px-4 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-[#F5DCE0]/60 text-[#E8B8C2]">
            <CalendarDays className="h-8 w-8" />
          </span>
          <h3 className="mt-4 text-base sm:text-lg font-semibold text-[#5A6670]">暂无符合条件的纪念日</h3>
          <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-[#5A6670]/60">
            {searchQuery || selectedCategory !== "all"
              ? "试着切换分类标签或清空搜索关键词吧。"
              : "把重要的相识、在一起、领证或生日等纪念日记录下来，慢慢倒数下一个周年的浪漫。"}
          </p>
          {isAdmin && (
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => openCreateForm("love")}
                className="flex items-center gap-1.5 rounded-full bg-[#E8B8C2] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-[#D6A6B0]"
              >
                <Plus className="h-4 w-4" />
                新增第一个纪念日
              </button>
            </div>
          )}
        </div>
      )}

      {/* 💌 Detail Modal */}
      <AnimatePresence>
        {activeAnniversary && (
          <div
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-sm"
            onClick={() => setActiveAnniversary(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative flex flex-col md:flex-row h-[90vh] max-h-[760px] w-full max-w-4xl overflow-hidden rounded-[20px] bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setActiveAnniversary(null)}
                className="absolute right-3.5 top-3.5 z-30 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-[#5A6670] shadow-md backdrop-blur transition hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Modal Left: Photo Gallery */}
              <div className="relative md:w-1/2 h-64 md:h-full bg-[#181C20] flex flex-col">
                <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center">
                  {activeAnniversary.images && activeAnniversary.images.length > 0 ? (
                    <>
                      <LocalPrivacyImg
                        src={activeAnniversary.images[detailPhotoIndex] || activeAnniversary.images[0]}
                        alt={activeAnniversary.title}
                        className="h-full w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(detailPhotoIndex)}
                        className="absolute right-3 bottom-3 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/75"
                        title="查看大图"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-white/50">
                      <Heart className="h-12 w-12 text-white/30" />
                      <p className="mt-2 text-sm">纯文字记录回忆</p>
                    </div>
                  )}
                </div>

                {/* Thumbnail bar */}
                {activeAnniversary.images && activeAnniversary.images.length > 1 && (
                  <div className="no-scrollbar flex gap-2 overflow-x-auto bg-black/40 p-2.5 backdrop-blur-md">
                    {activeAnniversary.images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDetailPhotoIndex(idx)}
                        className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-[8px] border-2 transition ${
                          detailPhotoIndex === idx
                            ? "border-[#E8B8C2] scale-105"
                            : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                      >
                        <LocalPrivacyImg
                          src={img}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Right: Details */}
              <div className="flex flex-1 flex-col overflow-y-auto p-5 sm:p-7 md:w-1/2">
                <div className="flex items-center justify-between border-b border-[#D8DDD8]/40 pb-3">
                  <span className="rounded-full bg-[#F5DCE0]/80 px-2.5 py-0.5 text-xs font-semibold text-[#E8B8C2]">
                    {CATEGORY_CONFIG[activeAnniversary.category]?.label || "相恋相守"}
                  </span>

                  <span className="text-xs font-bold text-[#E8B8C2]">
                    已相伴 {calculateTotalDays(activeAnniversary.date)} 天
                  </span>
                </div>

                <h2 className="mt-4 text-xl sm:text-2xl font-bold leading-snug text-[#5A6670]">
                  {activeAnniversary.title}
                </h2>

                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#A8C8DC]">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>纪念日：{activeAnniversary.date}</span>
                  {(activeAnniversary.customLocation || cities.find((c) => c.id === activeAnniversary.cityId)?.name) && (
                    <>
                      <span className="mx-1 text-[#D8DDD8]">|</span>
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span>{activeAnniversary.customLocation || cities.find((c) => c.id === activeAnniversary.cityId)?.name}</span>
                    </>
                  )}
                </div>

                {/* Next milestone reminder badge */}
                {(() => {
                  const nextInfo = calculateNextAnnual(activeAnniversary.date);
                  return (
                    <div className="mt-3.5 flex items-center justify-between rounded-xl bg-gradient-to-r from-[#F5DCE0]/40 to-[#FAFBF7] p-3 border border-[#E8B8C2]/40 text-xs">
                      <div className="flex items-center gap-2">
                        <Cake className="h-4 w-4 text-[#E8B8C2]" />
                        <span className="font-bold text-[#5A6670]">
                          第 {nextInfo.milestoneYears} 周年倒计时
                        </span>
                      </div>
                      <span className="font-extrabold text-[#E8B8C2]">
                        {nextInfo.daysLeft === 0 ? "🎉 今天整整一周年！" : `还有 ${nextInfo.daysLeft} 天`}
                      </span>
                    </div>
                  );
                })()}

                {/* Note */}
                <div className="mt-4 flex-1">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#5A6670]/85 bg-[#FAFBF7] p-4 rounded-xl border border-[#D8DDD8]/50">
                    {activeAnniversary.note || "（暂无文字感悟，回忆留存在心间...）"}
                  </p>
                </div>

                {/* Celebration Plan & Gift */}
                {(activeAnniversary.celebrationPlan || activeAnniversary.giftMemory) && (
                  <div className="mt-4 space-y-2 text-xs">
                    {activeAnniversary.celebrationPlan && (
                      <div className="flex items-center gap-1.5 text-[#5A6670]/80 bg-white p-2.5 rounded-lg border border-[#D8DDD8]/60">
                        <Wine className="h-4 w-4 text-[#E8B8C2] shrink-0" />
                        <span><strong>庆祝计划：</strong>{activeAnniversary.celebrationPlan}</span>
                      </div>
                    )}
                    {activeAnniversary.giftMemory && (
                      <div className="flex items-center gap-1.5 text-[#5A6670]/80 bg-white p-2.5 rounded-lg border border-[#D8DDD8]/60">
                        <Gift className="h-4 w-4 text-[#F2A97F] shrink-0" />
                        <span><strong>纪念信物/礼物：</strong>{activeAnniversary.giftMemory}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Actions */}
                <div className="mt-6 flex items-center justify-between border-t border-[#D8DDD8]/40 pt-4">
                  <button
                    type="button"
                    onClick={() => toggleLike(activeAnniversary.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      activeAnniversary.liked
                        ? "border-[#E8B8C2] bg-[#F5DCE0]/40 text-[#E8B8C2]"
                        : "border-[#D8DDD8] bg-white text-[#5A6670]/70 hover:border-[#E8B8C2]"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${activeAnniversary.liked ? "fill-[#E8B8C2]" : ""}`} />
                    <span>珍藏此日</span>
                    <span>({activeAnniversary.likeCount ?? 0})</span>
                  </button>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          const target = activeAnniversary;
                          setActiveAnniversary(null);
                          openEditForm(target, e);
                        }}
                        className="flex items-center gap-1 rounded-full border border-[#D8DDD8] bg-white px-3 py-1.5 text-xs font-semibold text-[#5A6670] hover:border-[#A8C8DC]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>编辑</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          const id = activeAnniversary.id;
                          setActiveAnniversary(null);
                          removeItem(id, e);
                        }}
                        className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50/50 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>删除</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 📝 Create / Edit Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative my-8 w-full max-w-2xl overflow-hidden rounded-[20px] bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#D8DDD8]/60 px-5 sm:px-6 py-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-[#E8B8C2]" />
                  <h2 className="text-base sm:text-lg font-bold text-[#5A6670]">
                    {editingId ? "编辑纪念日" : "新增重要纪念日"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-full p-1 text-[#5A6670]/50 hover:bg-[#FAFBF7] hover:text-[#5A6670]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <div className="max-h-[75vh] overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
                {/* Category Selector */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#5A6670]">
                    纪念日类别
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {(Object.keys(CATEGORY_CONFIG) as AnniversaryCategory[]).map((cat) => {
                      const conf = CATEGORY_CONFIG[cat];
                      const Icon = conf.icon;
                      const isSelected = formCategory === cat;

                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormCategory(cat)}
                          className={`flex flex-col items-center justify-center rounded-[12px] p-2 text-center transition border ${
                            isSelected
                              ? "border-[#E8B8C2] bg-[#F5DCE0]/30 text-[#E8B8C2] shadow-xs font-bold"
                              : "border-[#D8DDD8]/70 bg-[#FAFBF7]/60 text-[#5A6670]/70 hover:border-[#E8B8C2]/50"
                          }`}
                        >
                          <Icon className="h-4 w-4 mb-1" />
                          <span className="text-xs">{conf.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                    纪念日名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="如：我们在一起、领证结婚纪念日、宝贝生日..."
                    className="w-full rounded-[10px] border border-[#D8DDD8] px-3.5 py-2 text-xs sm:text-sm text-[#5A6670] outline-none transition focus:border-[#E8B8C2]"
                  />
                </div>

                {/* 📅 Date Dropdown Selector */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#5A6670]">
                    纪念日具体时间 (年月日下拉选择)
                  </label>
                  <DateDropdownSelect
                    value={formDate}
                    onChange={(val) => setFormDate(val)}
                    presets={[
                      {
                        label: "今天",
                        getDate: () =>
                          new Date()
                            .toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
                            .replace(/\//g, "."),
                      },
                      {
                        label: "520",
                        getDate: () => `${new Date().getFullYear()}.05.20`,
                      },
                      {
                        label: "情人节",
                        getDate: () => `${new Date().getFullYear()}.02.14`,
                      },
                    ]}
                    accent="pink"
                  />
                </div>

                {/* Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                      发生城市 (可选)
                    </label>
                    <CitySearchSelect
                      value={formCityId}
                      onChange={(id) => setFormCityId(id)}
                      accent="pink"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                      具体地点 / 浪漫场景 (可选)
                    </label>
                    <input
                      type="text"
                      value={formCustomLocation}
                      onChange={(e) => setFormCustomLocation(e.target.value)}
                      placeholder="如：外滩江边、民政局、第一家约会的咖啡馆"
                      className="w-full rounded-[10px] border border-[#D8DDD8] px-3.5 py-2 text-xs text-[#5A6670] outline-none transition focus:border-[#E8B8C2]"
                    />
                  </div>
                </div>

                {/* Image Upload Gallery */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-bold text-[#5A6670]">
                      上传纪念照片 / 礼物与合影 ({formImages.length}/9)
                    </label>
                    <span className="text-[10px] text-[#5A6670]/50">
                      支持离线高压缩，首张为封面
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {formImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="group relative aspect-square overflow-hidden rounded-[10px] border border-[#D8DDD8] bg-gray-50"
                      >
                        <LocalPrivacyImg
                          src={img}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {idx === 0 && (
                          <span className="absolute left-1.5 top-1.5 rounded bg-[#E8B8C2] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                            封面
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-1.5">
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => setCoverImage(idx)}
                              className="rounded bg-white/80 p-1 text-[10px] font-bold text-[#5A6670] hover:bg-white"
                            >
                              设封面
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFormImage(idx)}
                            className="rounded bg-red-500/80 p-1 text-white hover:bg-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {formImages.length < 9 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex aspect-square flex-col items-center justify-center rounded-[10px] border border-dashed border-[#D8DDD8] bg-[#FAFBF7]/80 text-[#5A6670]/50 transition hover:border-[#E8B8C2] hover:text-[#E8B8C2]"
                      >
                        <ImagePlus className="h-5 w-5" />
                        <span className="mt-1 text-[10px] font-medium">
                          {isUploading ? "处理中..." : "添加图片"}
                        </span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.heic,.heif,.HEIC,.HEIF"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>

                {/* Note */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                    纪念日感悟与悄悄话
                  </label>
                  <textarea
                    rows={3}
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="写下关于这天的回忆故事，或者每逢周年想对TA说的心里话..."
                    className="w-full rounded-[10px] border border-[#D8DDD8] p-3 text-xs sm:text-sm text-[#5A6670] outline-none transition focus:border-[#E8B8C2]"
                  />
                </div>

                {/* Celebration plan & Gift */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                      庆祝计划 / 惊喜心愿 (可选)
                    </label>
                    <input
                      type="text"
                      value={formCelebrationPlan}
                      onChange={(e) => setFormCelebrationPlan(e.target.value)}
                      placeholder="如：订法餐厅烛光晚餐、去拍拍立得写真"
                      className="w-full rounded-[10px] border border-[#D8DDD8] px-3.5 py-2 text-xs text-[#5A6670] outline-none transition focus:border-[#E8B8C2]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                      纪念信物 / 礼物灵感 (可选)
                    </label>
                    <input
                      type="text"
                      value={formGiftMemory}
                      onChange={(e) => setFormGiftMemory(e.target.value)}
                      placeholder="如：对戒、亲手织的围巾、定制相册"
                      className="w-full rounded-[10px] border border-[#D8DDD8] px-3.5 py-2 text-xs text-[#5A6670] outline-none transition focus:border-[#E8B8C2]"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-[#D8DDD8]/60 px-5 sm:px-6 py-3.5 bg-[#FAFBF7]/80">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-full border border-[#D8DDD8] bg-white px-4 py-2 text-xs font-semibold text-[#5A6670] hover:bg-[#FAFBF7]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveForm}
                  className="rounded-full bg-[#E8B8C2] px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#D6A6B0] active:scale-95"
                >
                  {editingId ? "保存修改" : "确认添加纪念日"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox for large photos */}
      {lightboxIndex !== null && activeAnniversary?.images && activeAnniversary.images.length > 0 && (
        <Lightbox
          photos={activeAnniversary.images.map((src) => ({ src, alt: activeAnniversary.title }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </MemoryPageShell>
  );
}
