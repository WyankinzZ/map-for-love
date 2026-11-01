"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  PlaneTakeoff,
  Heart,
  Sparkles,
  MapPin,
  Calendar,
  Plus,
  X,
  ImagePlus,
  Pencil,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Luggage,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  Train,
  Car,
  Ship,
  Wallet,
  Tag,
  Dices,
  Flame,
  Check,
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

export interface PackingItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TripRecord {
  id: string;
  title: string;
  date?: string;          // 出发日期 (YYYY.MM.DD)
  returnDate?: string;    // 返程日期 (可选)
  note: string;           // 旅行备忘 / 期待寄语
  cityId?: string;        // 关联城市 (国内可选)
  destination?: string;   // 自定义目的地 (如: 日本·京都、川西大环线)

  // 📸 图片画廊 (风景照、攻略图、酒店机票凭证)
  images: string[];
  coverImage?: string;

  // ✈️ 交通与风格
  transport?: "flight" | "train" | "car" | "ship" | "other";
  tripStyle?: string;     // 风格: 🏖️ 海滨度假 / 🎒 深度探索 / 🌸 赏花季 / 🍜 美食狂欢 / ⛺ 露营
  budget?: string;        // 预算

  // 🧳 行李备忘与行前清单
  packingList?: PackingItem[];

  // ❤️ 喜欢与珍藏
  liked?: boolean;
  likeCount?: number;
}

const STORAGE_KEY = "mapofus:trips";

export const TRANSPORT_OPTIONS = [
  { id: "flight", label: "飞机", icon: PlaneTakeoff },
  { id: "train", label: "高铁", icon: Train },
  { id: "car", label: "自驾", icon: Car },
  { id: "ship", label: "轮船", icon: Ship },
  { id: "other", label: "漫游", icon: Compass },
] as const;

export const STYLE_PRESETS = [
  "🏖️ 海滨度假",
  "🎒 深度探索",
  "🍜 美食逛吃",
  "🌸 浪漫赏花",
  "⛺ 星空露营",
  "📸 情侣旅拍",
  "🏔️ 徒步自驾",
  "🎡 乐园狂欢",
];

export const DEFAULT_PACKING_ITEMS = [
  "身份证 / 护照证件",
  "充电宝与充电线",
  "拍立得与情侣衣服",
  "常用药品与创口贴",
  "防晒霜与晴雨伞",
];

// Helper: Calculate days between target date string (YYYY.MM.DD) and today
function calculateTripDaysDiff(targetDateStr?: string): number {
  if (!targetDateStr) return 0;
  const parts = targetDateStr.split(/[./-]/).map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return 0;
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffTime = target.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Normalize trip record
function normalizeTrip(raw: any): TripRecord {
  return {
    id: raw.id || `trip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: raw.title || "未命名旅行",
    date: raw.date || new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "."),
    returnDate: raw.returnDate || "",
    note: raw.note || raw.content || "",
    cityId: raw.cityId,
    destination: raw.destination || raw.location || "",
    images: Array.isArray(raw.images) ? raw.images : (raw.image ? [raw.image] : []),
    coverImage: raw.coverImage || raw.images?.[0] || "",
    transport: raw.transport || "flight",
    tripStyle: raw.tripStyle || "🏖️ 海滨度假",
    budget: raw.budget || "",
    packingList: Array.isArray(raw.packingList) ? raw.packingList : [],
    liked: Boolean(raw.liked),
    likeCount: typeof raw.likeCount === "number" ? raw.likeCount : 1,
  };
}

export default function TripsPage() {
  const isAdmin = useAdminMode();
  const [items, setItems] = useState<TripRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [filterTab, setFilterTab] = useState<"all" | "upcoming" | "past">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Detail Modal
  const [activeTrip, setActiveTrip] = useState<TripRecord | null>(null);
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formDestination, setFormDestination] = useState("");
  const [formCityId, setFormCityId] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formTransport, setFormTransport] = useState<"flight" | "train" | "car" | "ship" | "other">("flight");
  const [formTripStyle, setFormTripStyle] = useState("🏖️ 海滨度假");
  const [formBudget, setFormBudget] = useState("");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formPackingList, setFormPackingList] = useState<PackingItem[]>([]);
  const [customPackingInput, setCustomPackingInput] = useState("");

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
    let localData: TripRecord[] = [];
    if (typeof window !== "undefined") {
      try {
        const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
        if (Array.isArray(raw)) {
          localData = raw.map(normalizeTrip);
          setItems(localData);
        }
      } catch (err) {
        console.error("Failed to parse local trips", err);
      }
    }

    readJson<any[]>("trips", localData)
      .then((remoteData) => {
        if (Array.isArray(remoteData) && remoteData.length > 0) {
          const normalized = remoteData.map(normalizeTrip);
          setItems(normalized);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          }
        }
      })
      .catch((err) => console.warn("Remote trips sync note:", err))
      .finally(() => setIsLoading(false));
  }, []);

  // Persist items
  const persistItems = useCallback((next: TripRecord[]) => {
    setItems(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    writeJson("trips", next).catch((err) => {
      console.warn("Server persist failed, local data is safe:", err);
    });
  }, []);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const diff = calculateTripDaysDiff(item.date);
      if (filterTab === "upcoming" && diff < 0) return false;
      if (filterTab === "past" && diff >= 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const city = cities.find((c) => c.id === item.cityId);
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDest = item.destination?.toLowerCase().includes(q);
        const matchNote = item.note.toLowerCase().includes(q);
        const matchCity = city?.name.toLowerCase().includes(q);
        const matchStyle = item.tripStyle?.toLowerCase().includes(q);
        if (!matchTitle && !matchDest && !matchNote && !matchCity && !matchStyle) {
          return false;
        }
      }
      return true;
    });
  }, [items, filterTab, searchQuery]);

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
  }, [filterTab, searchQuery, isMobile]);

  // Nearest upcoming trip for hero card
  const nearestUpcomingTrip = useMemo(() => {
    const upcoming = items
      .filter((item) => calculateTripDaysDiff(item.date) >= 0)
      .sort((a, b) => calculateTripDaysDiff(a.date) - calculateTripDaysDiff(b.date));
    return upcoming[0] || null;
  }, [items]);

  // Toggle checklist item in active trip
  const togglePackingItemInDetail = (itemId: string, checkId: string) => {
    const next = items.map((t) => {
      if (t.id === itemId && t.packingList) {
        const updatedList = t.packingList.map((p) =>
          p.id === checkId ? { ...p, done: !p.done } : p,
        );
        return { ...t, packingList: updatedList };
      }
      return t;
    });
    persistItems(next);
    if (activeTrip && activeTrip.id === itemId && activeTrip.packingList) {
      setActiveTrip((prev) =>
        prev
          ? {
              ...prev,
              packingList: prev.packingList?.map((p) =>
                p.id === checkId ? { ...p, done: !p.done } : p,
              ),
            }
          : null,
      );
    }
  };

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
    if (activeTrip && activeTrip.id === id) {
      setActiveTrip((prev) =>
        prev ? { ...prev, liked: !prev.liked, likeCount: (prev.likeCount ?? 0) + (!prev.liked ? 1 : -1) } : null,
      );
    }
  };

  // Delete
  const removeItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    if (!window.confirm("确定要删除这条旅行倒计时记录吗？")) return;
    const next = items.filter((item) => item.id !== id);
    persistItems(next);
    if (activeTrip?.id === id) setActiveTrip(null);
  };

  // Open Create Form
  const openCreateForm = () => {
    if (!isAdmin) return;
    setEditingId(null);
    setFormTitle("");
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    setFormDate(futureDate.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "."));
    setFormDestination("");
    setFormCityId("");
    setFormNote("");
    setFormTransport("flight");
    setFormTripStyle("🏖️ 海滨度假");
    setFormBudget("");
    setFormImages([]);
    setFormPackingList(
      DEFAULT_PACKING_ITEMS.map((text, idx) => ({
        id: `pack-${idx}`,
        text,
        done: false,
      })),
    );
    setCustomPackingInput("");
    setIsFormOpen(true);
  };

  // Open Edit Form
  const openEditForm = (item: TripRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormDate(item.date || "");
    setFormDestination(item.destination || "");
    setFormCityId(item.cityId || "");
    setFormNote(item.note);
    setFormTransport(item.transport || "flight");
    setFormTripStyle(item.tripStyle || "🏖️ 海滨度假");
    setFormBudget(item.budget || "");
    setFormImages(item.images || []);
    setFormPackingList(item.packingList || []);
    setCustomPackingInput("");
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

  // Packing list helpers
  const addPackingItem = () => {
    const text = customPackingInput.trim();
    if (!text) return;
    setFormPackingList((prev) => [
      ...prev,
      { id: `pack-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, text, done: false },
    ]);
    setCustomPackingInput("");
  };

  const removePackingItem = (id: string) => {
    setFormPackingList((prev) => prev.filter((p) => p.id !== id));
  };

  // Save Form
  const handleSaveForm = () => {
    if (!formTitle.trim()) {
      alert("请填写旅行计划名称");
      return;
    }

    const newRecord: TripRecord = {
      id: editingId || `trip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: formTitle.trim(),
      date: formDate.trim(),
      destination: formDestination.trim(),
      cityId: formCityId || undefined,
      note: formNote.trim(),
      transport: formTransport,
      tripStyle: formTripStyle,
      budget: formBudget.trim(),
      images: formImages,
      coverImage: formImages[0] || "",
      packingList: formPackingList,
      liked: editingId ? (items.find((i) => i.id === editingId)?.liked ?? false) : false,
      likeCount: editingId ? (items.find((i) => i.id === editingId)?.likeCount ?? 1) : 1,
    };

    const next = editingId
      ? items.map((item) => (item.id === editingId ? newRecord : item))
      : [newRecord, ...items];

    persistItems(next);
    setIsFormOpen(false);
    if (activeTrip && activeTrip.id === editingId) {
      setActiveTrip(newRecord);
    }
  };

  return (
    <MemoryPageShell active="trips">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full bg-[#D6E8F0]/80 text-[#A8C8DC] shadow-sm">
              <PlaneTakeoff className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight text-[#5A6670]">旅行倒计时</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm font-medium text-[#5A6670]/60">
            期待下一次牵手出发，计算距离下趟旅行还有多少天，整理行囊，奔赴山海。
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-full border border-[#D8DDD8]/80 bg-[#FAFBF7]/80 px-3 py-1.5 text-xs font-semibold text-[#5A6670]/70 shadow-sm backdrop-blur">
            <span>{items.length} 个旅程</span>
            <span className="text-[#D8DDD8]">|</span>
            <span className="text-[#A8C8DC]">
              {items.filter((i) => calculateTripDaysDiff(i.date) >= 0).length} 期待出发
            </span>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={openCreateForm}
              className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-[#E8B8C2] px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_6px_16px_rgba(232,184,194,0.4)] transition hover:bg-[#D6A6B0] active:scale-95"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>新增旅行</span>
            </button>
          )}
        </div>
      </header>

      {/* ✈️ Hero Nearest Upcoming Trip Countdown Banner (最临近出行倒计时高光卡片) */}
      {nearestUpcomingTrip && (
        <div className="mb-6 sm:mb-8 overflow-hidden rounded-[20px] border border-[#A8C8DC]/50 bg-gradient-to-r from-white via-[#F4F9FB] to-white p-4 sm:p-6 shadow-[0_12px_32px_rgba(168,200,220,0.12)] backdrop-blur">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-[#A8C8DC] to-[#D6E8F0] text-white shadow-md">
                <PlaneTakeoff className="h-7 w-7 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#A8C8DC]/20 px-2.5 py-0.5 text-xs font-bold text-[#A8C8DC]">
                    下一站即将启程
                  </span>
                  <span className="text-xs text-[#5A6670]/60">
                    {nearestUpcomingTrip.tripStyle || "浪漫出行"}
                  </span>
                </div>
                <h2 className="mt-1 text-xl sm:text-2xl font-black text-[#5A6670]">
                  {nearestUpcomingTrip.destination || nearestUpcomingTrip.title}
                </h2>
                <p className="mt-1 text-xs text-[#5A6670]/65">
                  计划出发日期：<strong className="text-[#5A6670]">{nearestUpcomingTrip.date}</strong>
                  {nearestUpcomingTrip.note && ` · “${nearestUpcomingTrip.note}”`}
                </p>
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="flex items-center gap-4 bg-white/80 p-3.5 rounded-2xl border border-[#A8C8DC]/40 shadow-xs">
              <div className="text-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#A8C8DC]">
                  COUNTDOWN
                </span>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-[#E8B8C2]">
                    {calculateTripDaysDiff(nearestUpcomingTrip.date)}
                  </span>
                  <span className="text-xs font-bold text-[#5A6670]/70">天</span>
                </div>
                <span className="text-[10px] text-[#5A6670]/50">距离出发</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTrip(nearestUpcomingTrip);
                  setDetailPhotoIndex(0);
                }}
                className="rounded-xl bg-[#A8C8DC] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#96B8CC] transition"
              >
                查看行程
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="mb-5 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6670]/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索旅行名称、目的地、出行风格..."
            className="w-full rounded-full border border-[#D8DDD8]/80 bg-white/70 py-2 pl-9 pr-8 text-xs sm:text-sm text-[#5A6670] outline-none transition placeholder:text-[#5A6670]/35 focus:border-[#A8C8DC] focus:bg-white focus:shadow-sm"
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

        {/* Status Filter Tabs (Balanced segmented control on mobile) */}
        <div className="grid grid-cols-3 sm:flex items-center gap-1 rounded-full border border-[#D8DDD8]/80 bg-[#FAFBF7]/80 p-1 w-full sm:w-auto shrink-0 shadow-2xs">
          {[
            { id: "all", label: "全部旅程" },
            { id: "upcoming", label: "✈️ 期待出发" },
            { id: "past", label: "✨ 已完成回忆" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id as any)}
              className={`flex items-center justify-center whitespace-nowrap rounded-full px-2 sm:px-3.5 py-1.5 text-xs font-semibold transition ${
                filterTab === tab.id
                  ? "bg-[#A8C8DC] text-white shadow-xs"
                  : "text-[#5A6670]/70 hover:text-[#5A6670]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Trip Cards */}
      {filteredItems.length > 0 ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-5">
            {paginatedItems.map((item) => {
              const diff = calculateTripDaysDiff(item.date);
              const isFuture = diff >= 0;
              const isToday = diff === 0;
              const city = cities.find((c) => c.id === item.cityId);
              const cover = item.images && item.images.length > 0 ? item.images[0] : item.coverImage;
              const completedPackingCount = item.packingList?.filter((p) => p.done).length ?? 0;
              const totalPackingCount = item.packingList?.length ?? 0;

              return (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => {
                    setActiveTrip(item);
                    setDetailPhotoIndex(0);
                  }}
                  className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[16px] border border-[#D8DDD8]/80 bg-white/85 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#A8C8DC]/60 hover:shadow-[0_16px_36px_rgba(90,102,112,0.12)] backdrop-blur"
                >
                  {/* Card Media Preview */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#D6E8F0]/40 via-[#FAFBF7] to-[#F5DCE0]/30">
                    {cover ? (
                      <LocalPrivacyImg
                        src={cover}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/80 text-[#A8C8DC] shadow-inner">
                          <PlaneTakeoff className="h-6 w-6" />
                        </span>
                        <p className="mt-2 text-xs font-semibold text-[#5A6670]/70">
                          {item.destination || item.title}
                        </p>
                        <span className="mt-1 text-[10px] text-[#5A6670]/40">点开上传旅行风景与攻略图</span>
                      </div>
                    )}

                    {/* Gradient shadow */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none" />

                    {/* Top-left Countdown Badge */}
                    <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold backdrop-blur-md shadow-xs ${
                          isToday
                            ? "bg-[#E8B8C2] text-white animate-bounce"
                            : isFuture
                            ? "bg-[#A8C8DC] text-white"
                            : "bg-black/50 text-white/90"
                        }`}
                      >
                        {isToday ? "🎉 今天出发！" : isFuture ? `✈️ 还有 ${diff} 天` : `✨ 已去过 ${Math.abs(diff)} 天`}
                      </span>
                    </div>

                    {/* Top-right Photo count */}
                    {item.images && item.images.length > 1 && (
                      <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                        <Camera className="h-3 w-3" />
                        {item.images.length}
                      </span>
                    )}

                    {/* Bottom overlay: Style & Transport */}
                    <div className="absolute inset-x-2.5 bottom-2 flex items-center justify-between text-[11px] font-semibold text-white drop-shadow-md">
                      <span>{item.tripStyle || "🏖️ 度假"}</span>
                      {item.budget && <span>¥{item.budget} 预算</span>}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                    {/* Title */}
                    <h3 className="line-clamp-2 text-sm sm:text-base font-semibold leading-snug text-[#5A6670] group-hover:text-[#A8C8DC] transition-colors">
                      {item.title}
                    </h3>

                    {/* Destination & Departure Date */}
                    <div className="mt-2 flex items-center justify-between text-xs text-[#5A6670]/60">
                      <div className="flex items-center gap-1 text-[#A8C8DC] truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {item.destination || city?.name || "未知远方"}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#5A6670]/50 shrink-0">
                        {item.date}
                      </span>
                    </div>

                    {/* Note */}
                    {item.note && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#5A6670]/65">
                        {item.note}
                      </p>
                    )}

                    {/* Packing progress pill */}
                    {totalPackingCount > 0 && (
                      <div className="mt-2.5 flex items-center justify-between rounded-lg bg-[#FAFBF7] px-2.5 py-1 text-[11px] text-[#5A6670]/70 border border-[#D8DDD8]/50">
                        <div className="flex items-center gap-1">
                          <Luggage className="h-3 w-3 text-[#A8C8DC]" />
                          <span>行前备忘清单</span>
                        </div>
                        <span className="font-bold text-[#A8C8DC]">
                          {completedPackingCount}/{totalPackingCount}
                        </span>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-auto flex items-center justify-between border-t border-[#D8DDD8]/40 pt-3">
                      <span className="text-[11px] text-[#5A6670]/40">
                        {isFuture ? "期待启程" : "美好珍藏"}
                      </span>

                      <div className="flex items-center gap-2">
                        {/* Like button */}
                        <button
                          type="button"
                          onClick={(e) => toggleLike(item.id, e)}
                          className={`flex items-center gap-1 text-xs font-semibold transition active:scale-125 ${
                            item.liked ? "text-[#E8B8C2]" : "text-[#5A6670]/40 hover:text-[#E8B8C2]"
                          }`}
                          title="喜欢"
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
                共 {filteredItems.length} 个旅行倒计时 · 第 {safeCurrentPage} / {totalPages} 页
              </span>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(Math.max(1, safeCurrentPage - 1))}
                  disabled={safeCurrentPage === 1}
                  className="flex items-center gap-1 rounded-[8px] border border-[#D8DDD8] bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#5A6670] transition hover:border-[#A8C8DC] hover:text-[#A8C8DC] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
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
                            ? "bg-[#A8C8DC] text-white shadow-xs"
                            : "border border-[#D8DDD8] bg-white text-[#5A6670] hover:border-[#A8C8DC]"
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
                  className="flex items-center gap-1 rounded-[8px] border border-[#D8DDD8] bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#5A6670] transition hover:border-[#A8C8DC] hover:text-[#A8C8DC] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
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
          <span className="grid h-16 w-16 place-items-center rounded-full bg-[#D6E8F0]/60 text-[#A8C8DC]">
            <PlaneTakeoff className="h-8 w-8" />
          </span>
          <h3 className="mt-4 text-base sm:text-lg font-semibold text-[#5A6670]">暂无符合条件的旅行计划</h3>
          <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-[#5A6670]/60">
            {searchQuery || filterTab !== "all"
              ? "试着切换筛选分类或清空搜索关键词吧。"
              : "还没有计划下一次旅行？点击右上角“新增旅行”，把想和TA一起去的远方提上日程吧！"}
          </p>
          {isAdmin && (
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={openCreateForm}
                className="flex items-center gap-1.5 rounded-full bg-[#E8B8C2] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-[#D6A6B0]"
              >
                <Plus className="h-4 w-4" />
                新增第一个旅行倒计时
              </button>
            </div>
          )}
        </div>
      )}

      {/* ✈️ Trip Detail Modal (沉浸式旅行详情) */}
      <AnimatePresence>
        {activeTrip && (
          <div
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-sm"
            onClick={() => setActiveTrip(null)}
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
                onClick={() => setActiveTrip(null)}
                className="absolute right-3.5 top-3.5 z-30 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-[#5A6670] shadow-md backdrop-blur transition hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Modal Left: Photo Gallery (Warm framed photo with ambient backdrop, no dark black bars) */}
              <div className="relative md:w-1/2 h-64 md:h-full bg-gradient-to-b from-[#F7F3EE] via-[#F2EAE9] to-[#EFE5E8] flex flex-col overflow-hidden">
                {activeTrip.images && activeTrip.images.length > 0 ? (
                  <>
                    {/* Ambient blurred backdrop of the current photo */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                      <LocalPrivacyImg
                        src={activeTrip.images[detailPhotoIndex] || activeTrip.images[0]}
                        alt=""
                        className="h-full w-full object-cover blur-2xl scale-125 opacity-25"
                      />
                      <div className="absolute inset-0 bg-[#FAFBF7]/40 backdrop-blur-xs" />
                    </div>

                    {/* Centered Framed Photo */}
                    <div className="relative z-10 flex-1 w-full p-3 sm:p-5 flex items-center justify-center overflow-hidden">
                      <div className="relative max-h-full max-w-full rounded-[14px] border-[3px] border-white/95 bg-white p-1.5 shadow-[0_10px_28px_rgba(90,102,112,0.16)] flex items-center justify-center transition-transform duration-300">
                        <LocalPrivacyImg
                          src={activeTrip.images[detailPhotoIndex] || activeTrip.images[0]}
                          alt={activeTrip.title}
                          className="max-h-[195px] md:max-h-[440px] w-auto max-w-full rounded-[10px] object-contain select-none"
                        />
                        <button
                          type="button"
                          onClick={() => setLightboxIndex(detailPhotoIndex)}
                          className="absolute right-3 bottom-3 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-md transition hover:bg-black/70 hover:scale-105 active:scale-95"
                          title="查看高清大图"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Refined Thumbnail Bar */}
                    {activeTrip.images.length > 1 && (
                      <div className="relative z-10 no-scrollbar flex gap-2 overflow-x-auto border-t border-[#D8DDD8]/60 bg-white/80 p-2 backdrop-blur-md">
                        {activeTrip.images.map((img, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setDetailPhotoIndex(idx)}
                            className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-[8px] border-2 transition ${
                              detailPhotoIndex === idx
                                ? "border-[#A8C8DC] scale-105 shadow-sm"
                                : "border-white/80 opacity-60 hover:opacity-100"
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
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-[#5A6670]/50 h-full">
                    <PlaneTakeoff className="h-12 w-12 text-[#A8C8DC]/60" />
                    <p className="mt-2 text-sm font-medium">暂无风景照片</p>
                  </div>
                )}
              </div>

              {/* Modal Right: Details & Checklist */}
              <div className="flex flex-1 flex-col overflow-y-auto p-5 sm:p-7 md:w-1/2">
                {/* Meta Header */}
                <div className="flex items-center justify-between border-b border-[#D8DDD8]/40 pb-3">
                  <span className="rounded-full bg-[#D6E8F0]/80 px-2.5 py-0.5 text-xs font-semibold text-[#A8C8DC]">
                    {activeTrip.tripStyle || "🏖️ 度假出行"}
                  </span>

                  <span className="text-xs font-bold text-[#E8B8C2]">
                    {calculateTripDaysDiff(activeTrip.date) >= 0
                      ? `✈️ 距离出发还有 ${calculateTripDaysDiff(activeTrip.date)} 天`
                      : `✨ 这趟旅程已珍藏 ${Math.abs(calculateTripDaysDiff(activeTrip.date))} 天`}
                  </span>
                </div>

                {/* Title & Destination */}
                <h2 className="mt-4 text-xl sm:text-2xl font-bold leading-snug text-[#5A6670]">
                  {activeTrip.title}
                </h2>

                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#A8C8DC]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    目的地：{activeTrip.destination || cities.find((c) => c.id === activeTrip.cityId)?.name || "待定远方"}
                  </span>
                  <span className="mx-1 text-[#D8DDD8]">|</span>
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>出发日期：{activeTrip.date}</span>
                </div>

                {/* Note */}
                <div className="mt-4">
                  <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-[#5A6670]/85 bg-[#FAFBF7] p-3.5 rounded-xl border border-[#D8DDD8]/50">
                    {activeTrip.note || "（暂无备忘，快记录下你们的行程期待吧！）"}
                  </p>
                </div>

                {/* Packing Checklist in Detail view */}
                {activeTrip.packingList && activeTrip.packingList.length > 0 && (
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#5A6670]">
                      <span className="flex items-center gap-1.5">
                        <Luggage className="h-4 w-4 text-[#A8C8DC]" />
                        <span>行李行前备忘清单 (点击打勾)</span>
                      </span>
                      <span className="text-[#A8C8DC]">
                        {activeTrip.packingList.filter((p) => p.done).length}/{activeTrip.packingList.length} 完成
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {activeTrip.packingList.map((pack) => (
                        <button
                          key={pack.id}
                          type="button"
                          onClick={() => togglePackingItemInDetail(activeTrip.id, pack.id)}
                          className={`flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs transition border ${
                            pack.done
                              ? "bg-green-50/60 border-green-200 text-green-700 line-through opacity-80"
                              : "bg-[#FAFBF7] border-[#D8DDD8]/60 text-[#5A6670] hover:border-[#A8C8DC]"
                          }`}
                        >
                          {pack.done ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-[#5A6670]/40 shrink-0" />
                          )}
                          <span className="flex-1">{pack.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="mt-auto flex items-center justify-between border-t border-[#D8DDD8]/40 pt-4">
                  <button
                    type="button"
                    onClick={() => toggleLike(activeTrip.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      activeTrip.liked
                        ? "border-[#E8B8C2] bg-[#F5DCE0]/40 text-[#E8B8C2]"
                        : "border-[#D8DDD8] bg-white text-[#5A6670]/70 hover:border-[#E8B8C2]"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${activeTrip.liked ? "fill-[#E8B8C2]" : ""}`} />
                    <span>心动期待</span>
                    <span>({activeTrip.likeCount ?? 0})</span>
                  </button>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          const target = activeTrip;
                          setActiveTrip(null);
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
                          const id = activeTrip.id;
                          setActiveTrip(null);
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
                  <PlaneTakeoff className="h-5 w-5 text-[#A8C8DC]" />
                  <h2 className="text-base sm:text-lg font-bold text-[#5A6670]">
                    {editingId ? "编辑旅行计划" : "新增旅行倒计时计划"}
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
                {/* Title */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                    旅行计划名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="如：日本京都樱花季之约 / 三亚海棠湾度蜜月..."
                    className="w-full rounded-[10px] border border-[#D8DDD8] px-3.5 py-2 text-xs sm:text-sm text-[#5A6670] outline-none transition focus:border-[#A8C8DC]"
                  />
                </div>

                {/* Destination */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                      目的地名称
                    </label>
                    <input
                      type="text"
                      value={formDestination}
                      onChange={(e) => setFormDestination(e.target.value)}
                      placeholder="如：日本·京都、川西大环线、三亚"
                      className="w-full rounded-[10px] border border-[#D8DDD8] px-3.5 py-2 text-xs text-[#5A6670] outline-none transition focus:border-[#A8C8DC]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                      关联国内城市 (可选)
                    </label>
                    <CitySearchSelect
                      value={formCityId}
                      onChange={(id) => setFormCityId(id)}
                      accent="blue"
                    />
                  </div>
                </div>

                {/* 📅 Date Dropdown Selector */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#5A6670]">
                    计划出发日期 (年月日下拉选择)
                  </label>
                  <DateDropdownSelect
                    value={formDate}
                    onChange={(val) => setFormDate(val)}
                    presets={[
                      {
                        label: "+30天后",
                        getDate: () => {
                          const d = new Date();
                          d.setDate(d.getDate() + 30);
                          return d
                            .toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
                            .replace(/\//g, ".");
                        },
                      },
                      {
                        label: "+100天后",
                        getDate: () => {
                          const d = new Date();
                          d.setDate(d.getDate() + 100);
                          return d
                            .toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
                            .replace(/\//g, ".");
                        },
                      },
                      {
                        label: "五一假期",
                        getDate: () => {
                          const now = new Date();
                          const y = now.getMonth() >= 4 ? now.getFullYear() + 1 : now.getFullYear();
                          return `${y}.05.01`;
                        },
                      },
                      {
                        label: "国庆假期",
                        getDate: () => {
                          const now = new Date();
                          const y = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
                          return `${y}.10.01`;
                        },
                      },
                    ]}
                    accent="blue"
                  />
                </div>

                {/* Transport & Travel Style */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                      出行交通方式
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {TRANSPORT_OPTIONS.map((t) => {
                        const Icon = t.icon;
                        const isSelected = formTransport === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setFormTransport(t.id)}
                            className={`flex flex-col items-center justify-center rounded-[10px] p-2 text-center transition border ${
                              isSelected
                                ? "border-[#A8C8DC] bg-[#D6E8F0]/30 text-[#A8C8DC] font-bold shadow-2xs"
                                : "border-[#D8DDD8]/70 bg-white text-[#5A6670]/60 hover:border-[#A8C8DC]"
                            }`}
                          >
                            <Icon className="h-4 w-4 mb-0.5" />
                            <span className="text-[10px]">{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                      旅行风格
                    </label>
                    <select
                      value={formTripStyle}
                      onChange={(e) => setFormTripStyle(e.target.value)}
                      className="w-full rounded-[10px] border border-[#D8DDD8] px-3 py-2 text-xs text-[#5A6670] outline-none bg-white transition focus:border-[#A8C8DC]"
                    >
                      {STYLE_PRESETS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                    预估预算 (可选)
                  </label>
                  <select
                    value={formBudget}
                    onChange={(e) => setFormBudget(e.target.value)}
                    className="w-full rounded-[10px] border border-[#D8DDD8] bg-white px-3.5 py-2 text-xs text-[#5A6670] outline-none transition focus:border-[#A8C8DC]"
                  >
                    <option value="">未设定预算 / 随心漫游</option>
                    <option value="1,000 ~ 3,000 元 (穷游小确幸 / 周末短途)">1,000 ~ 3,000 元 (穷游小确幸 / 周末短途)</option>
                    <option value="3,000 ~ 6,000 元 (舒适经济游)">3,000 ~ 6,000 元 (舒适经济游)</option>
                    <option value="6,000 ~ 10,000 元 (品质度假游)">6,000 ~ 10,000 元 (品质度假游)</option>
                    <option value="10,000 ~ 20,000 元 (轻奢深度游)">10,000 ~ 20,000 元 (轻奢深度游)</option>
                    <option value="20,000 ~ 35,000 元 (蜜月出境大环线)">20,000 ~ 35,000 元 (蜜月出境大环线)</option>
                    <option value="35,000 元以上 (浪漫无上限)">35,000 元以上 (浪漫无上限)</option>
                    {formBudget && ![
                      "1,000 ~ 3,000 元 (穷游小确幸 / 周末短途)",
                      "3,000 ~ 6,000 元 (舒适经济游)",
                      "6,000 ~ 10,000 元 (品质度假游)",
                      "10,000 ~ 20,000 元 (轻奢深度游)",
                      "20,000 ~ 35,000 元 (蜜月出境大环线)",
                      "35,000 元以上 (浪漫无上限)",
                    ].includes(formBudget) && (
                      <option value={formBudget}>{formBudget}</option>
                    )}
                  </select>
                </div>

                {/* Image Upload Gallery */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-bold text-[#5A6670]">
                      上传风景灵感照 / 凭证图 ({formImages.length}/9)
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
                          <span className="absolute left-1.5 top-1.5 rounded bg-[#A8C8DC] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
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
                        className="flex aspect-square flex-col items-center justify-center rounded-[10px] border border-dashed border-[#D8DDD8] bg-[#FAFBF7]/80 text-[#5A6670]/50 transition hover:border-[#A8C8DC] hover:text-[#A8C8DC]"
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
                    行程期待与备忘备注
                  </label>
                  <textarea
                    rows={3}
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="写下你们关于这次旅行的浪漫期待，如：一定要在海边看日出、去吃那家老店的刺身..."
                    className="w-full rounded-[10px] border border-[#D8DDD8] p-3 text-xs sm:text-sm text-[#5A6670] outline-none transition focus:border-[#A8C8DC]"
                  />
                </div>

                {/* Packing List Editor */}
                <div className="rounded-[12px] bg-[#FAFBF7] p-3.5 border border-[#D8DDD8]/60 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#5A6670]">
                    <span className="flex items-center gap-1.5">
                      <Luggage className="h-4 w-4 text-[#A8C8DC]" />
                      <span>行前行李备忘清单 ({formPackingList.length}项)</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {formPackingList.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs border border-[#D8DDD8]/70 text-[#5A6670]"
                      >
                        <span>{item.text}</span>
                        <button
                          type="button"
                          onClick={() => removePackingItem(item.id)}
                          className="text-[#5A6670]/40 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customPackingInput}
                      onChange={(e) => setCustomPackingInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addPackingItem();
                        }
                      }}
                      placeholder="添加物品或待办，如: 预定租车、准备胶卷..."
                      className="flex-1 rounded-[8px] border border-[#D8DDD8] bg-white px-3 py-1.5 text-xs text-[#5A6670] outline-none focus:border-[#A8C8DC]"
                    />
                    <button
                      type="button"
                      onClick={addPackingItem}
                      className="rounded-[8px] border border-[#D8DDD8] bg-white px-3 py-1.5 text-xs font-semibold text-[#5A6670] hover:border-[#A8C8DC]"
                    >
                      添加
                    </button>
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
                  className="rounded-full bg-[#A8C8DC] px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#96B8CC] active:scale-95"
                >
                  {editingId ? "保存修改" : "确认添加旅行"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox for large photos */}
      {lightboxIndex !== null && activeTrip?.images && activeTrip.images.length > 0 && (
        <Lightbox
          photos={activeTrip.images.map((src) => ({ src, alt: activeTrip.title }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </MemoryPageShell>
  );
}
