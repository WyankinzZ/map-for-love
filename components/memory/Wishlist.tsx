"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Check,
  CheckCircle2,
  Compass,
  Edit2,
  Heart,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  BookOpen,
  PlaneTakeoff,
  Camera,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Flame,
  Tag,
  DollarSign,
  Layers,
  Waves,
  UtensilsCrossed,
  Mountain,
  Flower2,
  FerrisWheel,
  Landmark,
  Tent,
  Footprints,
  Clock,
} from "lucide-react";
import { cities } from "@/data/cities";
import { MemoryPageShell } from "@/components/MemoryNav";
import { CitySearchSelect } from "@/components/shared/CitySearchSelect";
import { DateDropdownSelect } from "@/components/shared/DateDropdownSelect";
import { Lightbox, type LightboxPhoto } from "@/components/shared/Lightbox";
import { LocalPrivacyImg } from "@/components/LocalPrivacyImage";
import { readCompressedImageDataUrl } from "@/utils/imageUtils";
import { scrollToPageTop } from "@/lib/client/scroll";
import {
  readWishlist,
  writeWishlist,
  addWish,
  removeWish,
  toggleWishFulfilled,
  toggleWishLiked,
  WISHLIST_UPDATED_EVENT,
  WISH_CATEGORIES,
  WISH_BUDGETS,
  normalizeWishCategory,
  type WishItem,
} from "./wishlistStore";
import { fetchMemoriesDeduplicated } from "@/components/province/Shared";
import {
  memoryStoreUpdatedEvent,
  type LocalMemoryStore,
} from "@/data/progress";

type FilterType = "all" | "pending" | "fulfilled" | "liked";

const PRIORITY_OPTIONS = [
  { id: "high", label: "强烈想去", icon: Flame, badgeBg: "bg-[#FFF0F2] text-[#D86F82] border-[#E86F82]/30" },
  { id: "normal", label: "计划成行", icon: Sparkles, badgeBg: "bg-[#F0F5FA] text-[#60809C] border-[#B8D0E0]" },
  { id: "someday", label: "未来随缘", icon: Clock, badgeBg: "bg-[#F3F7F2] text-[#6B8572] border-[#C8DBCB]" },
] as const;

export const WISH_CATEGORY_CONFIG = [
  { id: "beach", label: "海滨漫步", icon: Waves },
  { id: "food", label: "寻味美食", icon: UtensilsCrossed },
  { id: "mountain", label: "攀登雪山", icon: Mountain },
  { id: "season", label: "季节限定", icon: Flower2 },
  { id: "carnival", label: "乐园狂欢", icon: FerrisWheel },
  { id: "history", label: "人文历史", icon: Landmark },
  { id: "camping", label: "治愈露营", icon: Tent },
  { id: "citywalk", label: "城市漫步", icon: Footprints },
] as const;

export default function WishlistPage() {
  const [wishes, setWishes] = useState<WishItem[]>([]);
  const [localMemories, setLocalMemories] = useState<LocalMemoryStore>({});
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState("");
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [category, setCategory] = useState<string>(WISH_CATEGORIES[0]);
  const [priority, setPriority] = useState<"high" | "normal" | "someday">("normal");
  const [budget, setBudget] = useState<string>("");
  const [note, setNote] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string>("");
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox state
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load wishlist & memories
  useEffect(() => {
    setWishes(readWishlist());

    const handleWishUpdate = (e: Event) => {
      const detail = (e as CustomEvent<WishItem[]>).detail;
      if (detail) setWishes(detail);
      else setWishes(readWishlist());
    };

    window.addEventListener(WISHLIST_UPDATED_EVENT, handleWishUpdate);

    let cancelled = false;
    async function loadMemories() {
      const data = await fetchMemoriesDeduplicated().catch(() => ({}));
      if (!cancelled) setLocalMemories(data);
    }

    const handleMemoryUpdate = (e: Event) => {
      const detail = (e as CustomEvent<LocalMemoryStore>).detail;
      if (detail) setLocalMemories(detail);
    };

    window.addEventListener(memoryStoreUpdatedEvent, handleMemoryUpdate);
    loadMemories();

    return () => {
      cancelled = true;
      window.removeEventListener(WISHLIST_UPDATED_EVENT, handleWishUpdate);
      window.removeEventListener(memoryStoreUpdatedEvent, handleMemoryUpdate);
    };
  }, []);

  // Compute fulfilled status: either explicitly marked, or city has recorded memories
  const processedWishes = useMemo(() => {
    return wishes.map((wish) => {
      const hasMemory = Boolean(
        localMemories[wish.cityId] && localMemories[wish.cityId].length > 0
      );
      const isFulfilled = Boolean(wish.isFulfilled || hasMemory);
      const city = cities.find((c) => c.id === wish.cityId);
      return {
        ...wish,
        isFulfilled,
        city,
        hasMemory,
      };
    });
  }, [wishes, localMemories]);

  // Filtered list
  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return processedWishes.filter((item) => {
      if (filter === "pending" && item.isFulfilled) return false;
      if (filter === "fulfilled" && !item.isFulfilled) return false;
      if (filter === "liked" && !item.liked) return false;
      if (selectedCategory !== "all" && normalizeWishCategory(item.category) !== normalizeWishCategory(selectedCategory)) return false;

      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.cityName.toLowerCase().includes(q) ||
        (item.note && item.note.toLowerCase().includes(q)) ||
        (item.targetDate && item.targetDate.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });
  }, [processedWishes, filter, selectedCategory, searchQuery]);

  // Responsive Pagination
  const itemsPerPage = isMobile ? 2 : 6;
  const totalPages = Math.max(1, Math.ceil(filteredList.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedWishes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage, itemsPerPage]);

  const handlePageChange = (p: number) => {
    setCurrentPage(p);
    scrollToPageTop();
  };

  const stats = useMemo(() => {
    const total = processedWishes.length;
    const fulfilled = processedWishes.filter((w) => w.isFulfilled).length;
    const pending = total - fulfilled;
    const liked = processedWishes.filter((w) => w.liked).length;
    return { total, fulfilled, pending, liked };
  }, [processedWishes]);

  // Date Presets for Dropdown
  const datePresets = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    return [
      { label: "今年五一", getDate: () => `${curYear}.05.01` },
      { label: "暑期旅行", getDate: () => `${curYear}.07.15` },
      { label: "十一国庆", getDate: () => `${curYear}.10.01` },
      { label: "元旦跨年", getDate: () => `${curYear}.12.31` },
      { label: "明年春天", getDate: () => `${curYear + 1}.04.01` },
    ];
  }, []);

  const handleOpenAdd = () => {
    const today = new Date();
    const defaultDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(
      today.getDate()
    ).padStart(2, "0")}`;
    setEditingId(null);
    setSelectedCityId("");
    setTitle("");
    setTargetDate(defaultDate);
    setCategory(WISH_CATEGORIES[0]);
    setPriority("normal");
    setBudget("");
    setNote("");
    setImages([]);
    setCoverImage("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: WishItem) => {
    setEditingId(item.id);
    setSelectedCityId(item.cityId);
    setTitle(item.title);
    setTargetDate(item.targetDate || "");
    setCategory(item.category || WISH_CATEGORIES[0]);
    setPriority(item.priority || "normal");
    setBudget(item.budget || "");
    setNote(item.note || "");
    setImages(item.images || []);
    setCoverImage(item.coverImage || item.images?.[0] || "");
    setIsModalOpen(true);
  };

  // Photo Upload Handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressing(true);
    const newImages: string[] = [];

    for (let i = 0; i < files.length; i++) {
      if (images.length + newImages.length >= 9) break;
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      try {
        const compressed = await readCompressedImageDataUrl(file, {
          maxDimension: 1200,
          quality: 0.82,
        });
        newImages.push(compressed);
      } catch (err) {
        console.error("Failed to compress image:", err);
      }
    }

    setImages((prev) => {
      const merged = [...prev, ...newImages].slice(0, 9);
      if (!coverImage && merged.length > 0) {
        setCoverImage(merged[0]);
      }
      return merged;
    });

    setIsCompressing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = (index: number) => {
    const removedSrc = images[index];
    const nextImages = images.filter((_, i) => i !== index);
    setImages(nextImages);
    if (coverImage === removedSrc) {
      setCoverImage(nextImages[0] || "");
    }
  };

  const handleSetCover = (imgUrl: string) => {
    setCoverImage(imgUrl);
  };

  const handleSave = () => {
    if (!selectedCityId || !title.trim()) return;

    const city = cities.find((c) => c.id === selectedCityId);
    const cityName = city?.name || selectedCityId;
    const finalCover = coverImage || images[0] || "";

    if (editingId) {
      // Edit existing
      const updated = wishes.map((w) =>
        w.id === editingId
          ? {
              ...w,
              cityId: selectedCityId,
              cityName,
              title: title.trim(),
              targetDate: targetDate.trim(),
              category,
              priority,
              budget: budget.trim(),
              note: note.trim(),
              images,
              coverImage: finalCover,
            }
          : w
      );
      writeWishlist(updated);
    } else {
      // Add new
      addWish({
        cityId: selectedCityId,
        cityName,
        title: title.trim(),
        targetDate: targetDate.trim(),
        category,
        priority,
        budget: budget.trim(),
        note: note.trim(),
        images,
        coverImage: finalCover,
      });
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("确定要删除这个心愿吗？")) {
      removeWish(id);
    }
  };

  const openLightboxForWish = (item: WishItem, startIdx = 0) => {
    const list = item.images && item.images.length > 0 ? item.images : item.coverImage ? [item.coverImage] : [];
    if (list.length === 0) return;
    const photos: LightboxPhoto[] = list.map((src, i) => ({
      src,
      alt: `${item.title} 照片 ${i + 1}`,
      caption: `${item.cityName} · ${item.title}`,
    }));
    setLightboxPhotos(photos);
    setLightboxIndex(startIdx);
    setIsLightboxOpen(true);
  };

  return (
    <MemoryPageShell active="wishlist">
      <div className="w-full space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-[#F5DCE0] text-[#D86F82] shadow-2xs">
                <Compass className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3F4951]">
                  未来想去 · 心愿清单
                </h1>
              </div>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-[#5A6670]/70">
              写下那些想和TA一起奔赴的远方，上传憧憬的照片，等我们踏上旅途时，心愿便会化作点亮的星光
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 rounded-[10px] bg-[#D86F82] px-4 py-2 sm:px-4.5 sm:py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#c95d70] active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>许个新心愿</span>
            </button>
          </div>
        </header>

        {/* Stats & Filter Bar */}
        <div className="space-y-2.5 rounded-[14px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/90 p-3 sm:p-4 shadow-2xs backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex rounded-[10px] border border-[#D8DDD8] bg-white p-1 overflow-x-auto whitespace-nowrap scrollbar-none shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-xs font-semibold transition ${
                  filter === "all"
                    ? "bg-[#F5DCE0] text-[#D86F82] shadow-2xs"
                    : "text-[#5A6670]/70 hover:text-[#5A6670]"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>全部心愿</span>
                <span className="text-[10px] opacity-75">({stats.total})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilter("pending");
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-xs font-semibold transition ${
                  filter === "pending"
                    ? "bg-[#F5DCE0] text-[#D86F82] shadow-2xs"
                    : "text-[#5A6670]/70 hover:text-[#5A6670]"
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span>待出发</span>
                <span className="text-[10px] opacity-75">({stats.pending})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilter("fulfilled");
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-xs font-semibold transition ${
                  filter === "fulfilled"
                    ? "bg-[#F5DCE0] text-[#D86F82] shadow-2xs"
                    : "text-[#5A6670]/70 hover:text-[#5A6670]"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>已圆梦</span>
                <span className="text-[10px] opacity-75">({stats.fulfilled})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilter("liked");
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-xs font-semibold transition ${
                  filter === "liked"
                    ? "bg-[#FFF0F2] text-[#D86F82] shadow-2xs"
                    : "text-[#5A6670]/70 hover:text-[#5A6670]"
                }`}
              >
                <Heart className="h-3.5 w-3.5 fill-[#D86F82] text-[#D86F82]" />
                <span>心动珍藏</span>
                <span className="text-[10px] opacity-75">({stats.liked})</span>
              </button>
            </div>

            {/* Search box */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5A6670]/40" />
              <input
                type="text"
                placeholder="搜索城市、心愿或分类..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-[10px] border border-[#D8DDD8] bg-white py-1.5 pl-8 pr-8 text-xs text-[#5A6670] outline-none transition focus:border-[#D86F82] shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A6670]/40 hover:text-[#5A6670]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category Pills Bar */}
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("all");
                setCurrentPage(1);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                selectedCategory === "all"
                  ? "bg-[#E8B8C2] text-white shadow-sm"
                  : "border border-[#D8DDD8]/80 bg-[#FAFBF7]/80 text-[#5A6670]/70 hover:border-[#E8B8C2]/60 hover:text-[#5A6670]"
              }`}
            >
              <Compass className={`h-3.5 w-3.5 ${selectedCategory === "all" ? "text-white" : "text-[#5A6670]/60"}`} />
              <span>全部类型</span>
              <span className={`text-[10px] ${selectedCategory === "all" ? "text-white/80" : "text-[#5A6670]/40"}`}>
                {wishes.length}
              </span>
            </button>
            {WISH_CATEGORY_CONFIG.map((cat) => {
              const Icon = cat.icon;
              const isSelected = normalizeWishCategory(selectedCategory) === cat.label;
              const count = wishes.filter(
                (w) => normalizeWishCategory(w.category) === cat.label
              ).length;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.label);
                    setCurrentPage(1);
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    isSelected
                      ? "bg-[#E8B8C2] text-white shadow-sm"
                      : "border border-[#D8DDD8]/80 bg-[#FAFBF7]/80 text-[#5A6670]/70 hover:border-[#E8B8C2]/60 hover:text-[#5A6670]"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-white" : "text-[#5A6670]/60"}`} />
                  <span>{cat.label}</span>
                  <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-[#5A6670]/40"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Wishes Cards Grid */}
        {filteredList.length === 0 ? (
          <div className="grid min-h-[360px] place-items-center rounded-[16px] border border-dashed border-[#D8DDD8] bg-[#FAFBF7]/60 p-8 text-center backdrop-blur">
            <div className="max-w-md">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5DCE0]/50 text-[#D86F82]">
                <Compass className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-[#3F4951]">
                {searchQuery || selectedCategory !== "all"
                  ? "未找到匹配的心愿"
                  : "还没有添加旅行心愿"}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#5A6670]/70">
                {searchQuery || selectedCategory !== "all"
                  ? "尝试更换筛选条件或搜索关键词。"
                  : "点击上方「许个新心愿」，挑选一个一直想和TA一起去的城市，上传美美的向往照片吧！在地图上记录该城市回忆后，心愿会自动圆梦！"}
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#D86F82] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#c95d70]"
                >
                  <Plus className="h-4 w-4" />
                  许下第一个心愿
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
              {paginatedWishes.map((item) => {
                const priorityInfo = PRIORITY_OPTIONS.find((p) => p.id === item.priority) || PRIORITY_OPTIONS[1];
                const hasPhotos = (item.images && item.images.length > 0) || Boolean(item.coverImage);
                const displayCover = item.coverImage || item.images?.[0];

                return (
                  <article
                    key={item.id}
                    className={`group relative flex flex-col justify-between overflow-hidden rounded-[16px] border transition duration-300 ${
                      item.isFulfilled
                        ? "border-[#E8B8C2]/70 bg-gradient-to-br from-[#FFFDF9] via-[#FFF8F9] to-[#FFF0F3] shadow-[0_8px_24px_rgba(216,111,130,0.08)]"
                        : "border-[#D8DDD8]/80 bg-[#FFFDF9] shadow-[0_8px_20px_rgba(90,102,112,0.05)] hover:border-[#D86F82]/50 hover:shadow-[0_12px_28px_rgba(90,102,112,0.1)]"
                    }`}
                  >
                    {/* Visual Banner / Cover Photo */}
                    {hasPhotos && displayCover ? (
                      <div
                        className="relative h-44 sm:h-48 w-full cursor-pointer overflow-hidden bg-[#F0EAE1]"
                        onClick={() => openLightboxForWish(item, 0)}
                      >
                        <LocalPrivacyImg
                          src={displayCover}
                          alt={item.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                        {/* Top float badges */}
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                          <span className="flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white">
                            <MapPin className="h-3 w-3 text-[#FFCAD4]" />
                            {item.cityName}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWishLiked(item.id);
                            }}
                            className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition ${
                              item.liked
                                ? "bg-[#D86F82] text-white shadow-sm"
                                : "bg-black/35 text-white/80 hover:text-white hover:bg-black/50"
                            }`}
                            title={item.liked ? "取消喜欢" : "珍藏心动"}
                          >
                            <Heart className={`h-4 w-4 ${item.liked ? "fill-white" : ""}`} />
                          </button>
                        </div>

                        {/* Bottom float photo count & status */}
                        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
                          <div className="flex items-center gap-1.5">
                            {item.category && (
                              <span className="rounded-md bg-white/20 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-white">
                                {normalizeWishCategory(item.category)}
                              </span>
                            )}
                            {item.images && item.images.length > 1 && (
                              <span className="flex items-center gap-1 rounded-md bg-black/40 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-white/90">
                                <Camera className="h-2.5 w-2.5" />
                                {item.images.length} 张图
                              </span>
                            )}
                          </div>

                          {item.isFulfilled ? (
                            <span className="flex items-center gap-1 rounded-full bg-[#D86F82] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                              <Sparkles className="h-2.5 w-2.5" />
                              {item.hasMemory ? "打卡圆梦" : "已圆梦"}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md ${priorityInfo.badgeBg}`}>
                              <priorityInfo.icon className="h-2.5 w-2.5" />
                              {priorityInfo.label}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Stylized header without image */
                      <div className="relative border-b border-[#D8DDD8]/50 bg-gradient-to-r from-[#FAF6F0] via-[#FFFDF9] to-[#FDF4F5] p-3.5 sm:p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-xl shadow-2xs ${
                                item.isFulfilled
                                  ? "bg-[#E86F82] text-white"
                                  : "bg-[#F5DCE0] text-[#D86F82]"
                              }`}
                            >
                              <MapPin className="h-4 w-4" />
                            </span>
                            <div>
                              <span className="text-sm font-bold text-[#3F4951]">
                                {item.cityName}
                              </span>
                              {item.city?.landmark && (
                                <p className="text-[10px] text-[#5A6670]/60 truncate max-w-[130px]">
                                  {item.city.landmark}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleWishLiked(item.id)}
                              className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                                item.liked
                                  ? "bg-[#FFF0F2] text-[#D86F82]"
                                  : "text-[#5A6670]/40 hover:text-[#D86F82]"
                              }`}
                              title={item.liked ? "取消喜欢" : "珍藏心动"}
                            >
                              <Heart className={`h-4 w-4 ${item.liked ? "fill-[#D86F82]" : ""}`} />
                            </button>

                            {item.isFulfilled ? (
                              <span className="flex items-center gap-1 rounded-full border border-[#E86F82]/40 bg-[#FFF0F2] px-2.5 py-0.5 text-[11px] font-bold text-[#D86F82] shadow-2xs">
                                <Sparkles className="h-3 w-3" />
                                {item.hasMemory ? "打卡圆梦" : "已圆梦"}
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityInfo.badgeBg}`}>
                                <priorityInfo.icon className="h-3 w-3" />
                                {priorityInfo.label}
                              </span>
                            )}
                          </div>
                        </div>

                        {item.category && (
                          <div className="mt-2.5 flex items-center gap-2">
                            <span className="rounded-md bg-[#FAF4ED] px-2 py-0.5 text-[10px] font-medium text-[#7A6E63] border border-[#EADFD0]/80">
                              {normalizeWishCategory(item.category)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card Body */}
                    <div className="flex-1 p-3.5 sm:p-5">
                      {/* Title */}
                      <h3 className="text-base font-bold text-[#3F4951] leading-snug">
                        {item.title}
                      </h3>

                      {/* Info Pills (Date & Budget) */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                        {item.targetDate && (
                          <div className="flex items-center gap-1 rounded-[6px] bg-[#FAF8F5] px-2 py-1 text-[11px] text-[#D86F82] font-medium border border-[#EAE4DC]/70">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>期待日期：{item.targetDate}</span>
                          </div>
                        )}

                        {item.budget && (
                          <div className="flex items-center gap-1 rounded-[6px] bg-[#FAF8F5] px-2 py-1 text-[11px] text-[#5A6670]/70 font-medium border border-[#EAE4DC]/70">
                            <DollarSign className="h-3 w-3 shrink-0 text-[#8CA38D]" />
                            <span>预算：{item.budget}</span>
                          </div>
                        )}
                      </div>

                      {/* Note quote */}
                      {item.note && (
                        <div className="mt-3 rounded-[10px] bg-[#FAF8F2] p-3 text-xs leading-relaxed text-[#5A6670]/85 border border-[#EBEBE6]">
                          “{item.note}”
                        </div>
                      )}

                      {/* Photo Thumbnail Strip if > 1 photo */}
                      {item.images && item.images.length > 1 && (
                        <div className="mt-3.5 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                          {item.images.map((img, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => openLightboxForWish(item, idx)}
                              className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[8px] border border-[#D8DDD8]/80 hover:border-[#D86F82] transition"
                            >
                              <LocalPrivacyImg
                                src={img}
                                alt={`照片 ${idx + 1}`}
                                className="h-full w-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Card Actions */}
                    <div className="flex items-center justify-between border-t border-[#D8DDD8]/60 bg-[#FAFBF7]/60 px-3.5 sm:px-5 py-2.5 text-xs">
                      {/* Mark fulfilled manual button */}
                      <button
                        type="button"
                        onClick={() => toggleWishFulfilled(item.id, !item.isFulfilled)}
                        className={`flex items-center gap-1 rounded-[6px] px-2.5 py-1 text-[11px] font-medium transition ${
                          item.isFulfilled
                            ? "bg-[#F5DCE0]/50 text-[#D86F82] hover:bg-[#F5DCE0]"
                            : "text-[#5A6670]/70 hover:text-[#D86F82] hover:bg-[#FAF0F2]"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{item.isFulfilled ? "已标记达成" : "标记达成"}</span>
                      </button>

                      <div className="flex items-center gap-1 sm:gap-1.5">
                        {item.hasMemory ? (
                          <Link
                            href="/memories"
                            className="flex items-center gap-1 rounded-[6px] bg-[#F5DCE0]/60 px-2 py-1 text-[11px] font-semibold text-[#D86F82] hover:bg-[#F5DCE0] transition"
                            title="查看在该城市的回忆"
                          >
                            <BookOpen className="h-3 w-3" />
                            <span className="hidden xs:inline">看回忆</span>
                          </Link>
                        ) : (
                          <Link
                            href="/trips"
                            className="flex items-center gap-1 rounded-[6px] border border-[#D8DDD8] bg-white px-2 py-1 text-[11px] font-semibold text-[#5A6670]/70 hover:border-[#D86F82] hover:text-[#D86F82] transition"
                            title="设为旅行倒数计划"
                          >
                            <PlaneTakeoff className="h-3 w-3" />
                            <span className="hidden xs:inline">计划出发</span>
                          </Link>
                        )}

                        {item.city && (
                          <Link
                            href={`/province/${item.city.provinceId}?city=${item.city.id}`}
                            className="rounded-[6px] p-1.5 text-[#5A6670]/60 hover:text-[#D86F82] transition"
                            title="在地图中查看该城市"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                          </Link>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="rounded-[6px] p-1.5 text-[#5A6670]/60 hover:text-[#5A6670] transition"
                          title="编辑心愿"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="rounded-[6px] p-1.5 text-[#5A6670]/40 hover:text-red-500 transition"
                          title="删除心愿"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-[14px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/90 px-3.5 sm:px-4 py-3 shadow-2xs backdrop-blur-md">
                <span className="text-xs text-[#5A6670]/70 text-center sm:text-left">
                  共 {filteredList.length} 个心愿 · 第 {currentPage} / {totalPages} 页
                </span>

                <div className="flex items-center justify-center gap-1 sm:gap-1.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 rounded-[8px] border border-[#D8DDD8] bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#5A6670] transition hover:bg-[#FAFBF7] disabled:opacity-30 disabled:cursor-not-allowed shrink-0 whitespace-nowrap shadow-2xs cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                    <span>上一页</span>
                  </button>

                  <div className="flex items-center gap-1 px-0.5 sm:px-1">
                    {(() => {
                      if (totalPages <= 5) {
                        return Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handlePageChange(p)}
                            className={`h-7 min-w-[28px] sm:min-w-[32px] px-1.5 rounded-[7px] text-xs font-semibold transition cursor-pointer shrink-0 ${
                              currentPage === p
                                ? "bg-[#D86F82] text-white shadow-2xs"
                                : "border border-[#D8DDD8] bg-white text-[#5A6670] hover:bg-[#FAFBF7]"
                            }`}
                          >
                            {p}
                          </button>
                        ));
                      }

                      const pages: (number | string)[] = [];
                      if (currentPage <= 3) {
                        pages.push(1, 2, 3, "...", totalPages);
                      } else if (currentPage >= totalPages - 2) {
                        pages.push(1, "...", totalPages - 2, totalPages - 1, totalPages);
                      } else {
                        pages.push(1, "...", currentPage, "...", totalPages);
                      }

                      return pages.map((item, idx) => {
                        if (item === "...") {
                          return (
                            <span key={`dots-${idx}`} className="px-1 text-xs text-[#5A6670]/40 select-none shrink-0">
                              …
                            </span>
                          );
                        }
                        const p = item as number;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handlePageChange(p)}
                            className={`h-7 min-w-[28px] sm:min-w-[32px] px-1.5 rounded-[7px] text-xs font-semibold transition cursor-pointer shrink-0 ${
                              currentPage === p
                                ? "bg-[#D86F82] text-white shadow-2xs"
                                : "border border-[#D8DDD8] bg-white text-[#5A6670] hover:bg-[#FAFBF7]"
                            }`}
                          >
                            {p}
                          </button>
                        );
                      });
                    })()}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 rounded-[8px] border border-[#D8DDD8] bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#5A6670] transition hover:bg-[#FAFBF7] disabled:opacity-30 disabled:cursor-not-allowed shrink-0 whitespace-nowrap shadow-2xs cursor-pointer"
                  >
                    <span>下一页</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add / Edit Wish Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="w-full max-w-lg rounded-[20px] border border-[#D8DDD8] bg-[#FFFDF9] p-5 sm:p-6 shadow-2xl my-6 max-h-[90vh] flex flex-col"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-[#D8DDD8]/60 pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F5DCE0] text-[#D86F82]">
                      <Compass className="h-4 w-4" />
                    </span>
                    <h3 className="text-base font-bold text-[#3F4951]">
                      {editingId ? "编辑心愿" : "许下新的旅行心愿"}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="p-1 text-[#5A6670]/40 hover:text-[#5A6670]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Modal Body (Scrollable) */}
                <div className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
                  {/* Select City */}
                  <div>
                    <label className="block text-xs font-semibold text-[#5A6670]/80 mb-1.5">
                      想去的城市 *
                    </label>
                    <CitySearchSelect
                      value={selectedCityId}
                      onChange={setSelectedCityId}
                      placeholder="搜索并选择城市..."
                    />
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-xs font-semibold text-[#5A6670]/80 mb-1.5">
                      心愿名称 *
                    </label>
                    <input
                      type="text"
                      placeholder="例如：想一起去洱海边看日落吹风..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-[10px] border border-[#D8DDD8] bg-white px-3 py-2 text-xs sm:text-sm text-[#5A6670] outline-none transition focus:border-[#D86F82]"
                    />
                  </div>

                  {/* Target Date with Dropdown Select */}
                  <div>
                    <label className="block text-xs font-semibold text-[#5A6670]/80 mb-1.5">
                      期望出行时间（年月日下拉框选择）
                    </label>
                    <DateDropdownSelect
                      value={targetDate}
                      onChange={setTargetDate}
                      presets={datePresets}
                      accent="pink"
                    />
                  </div>

                  {/* Wish Category */}
                  <div>
                    <label className="block text-xs font-semibold text-[#5A6670]/80 mb-1.5">
                      心愿类型
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {WISH_CATEGORY_CONFIG.map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = normalizeWishCategory(category) === cat.label;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.label)}
                            className={`flex items-center justify-center gap-1.5 rounded-[8px] py-2 px-2 text-xs font-medium transition text-center truncate ${
                              isSelected
                                ? "bg-[#F5DCE0] text-[#D86F82] font-semibold border border-[#E86F82]/30 shadow-2xs"
                                : "border border-[#D8DDD8] bg-white text-[#5A6670]/70 hover:border-[#D86F82]"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority & Budget */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Priority */}
                    <div>
                      <label className="block text-xs font-semibold text-[#5A6670]/80 mb-1.5">
                        心愿迫切度
                      </label>
                      <div className="flex rounded-[8px] border border-[#D8DDD8] bg-white p-1">
                        {PRIORITY_OPTIONS.map((p) => {
                          const Icon = p.icon;
                          const isSelected = priority === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPriority(p.id)}
                              className={`flex-1 flex items-center justify-center gap-1 rounded-[6px] py-1.5 text-xs font-medium transition text-center ${
                                isSelected
                                  ? "bg-[#D86F82] text-white shadow-2xs font-semibold"
                                  : "text-[#5A6670]/70 hover:text-[#5A6670]"
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              <span>{p.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Budget */}
                    <div>
                      <label className="block text-xs font-semibold text-[#5A6670]/80 mb-1.5">
                        预算预估
                      </label>
                      <select
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className="w-full rounded-[8px] border border-[#D8DDD8] bg-white py-1.5 px-2 text-xs text-[#5A6670] outline-none transition focus:border-[#D86F82]"
                      >
                        <option value="">未指定预算</option>
                        {WISH_BUDGETS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Photo Upload Area */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-[#5A6670]/80">
                        憧憬照片 / 种草攻略图（最多 9 张）
                      </label>
                      <span className="text-[11px] text-[#5A6670]/50">
                        {images.length} / 9 张
                      </span>
                    </div>

                    {/* Thumbnail Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {images.map((img, idx) => {
                        const isCover = (coverImage || images[0]) === img;
                        return (
                          <div
                            key={idx}
                            className={`group relative aspect-square rounded-[10px] overflow-hidden border ${
                              isCover ? "border-[#D86F82] ring-2 ring-[#D86F82]/30" : "border-[#D8DDD8]"
                            } bg-[#FAFBF7]`}
                          >
                            <LocalPrivacyImg
                              src={img}
                              alt={`预览 ${idx + 1}`}
                              className="h-full w-full object-cover"
                            />

                            {/* Cover Indicator */}
                            {isCover && (
                              <span className="absolute top-1 left-1 rounded-sm bg-[#D86F82] px-1 py-0.5 text-[9px] font-bold text-white shadow-2xs">
                                封面
                              </span>
                            )}

                            {/* Hover overlay actions */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 p-1">
                              {!isCover && (
                                <button
                                  type="button"
                                  onClick={() => handleSetCover(img)}
                                  className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-[#3F4951] hover:bg-white transition"
                                >
                                  设为封面
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(idx)}
                                className="rounded bg-red-500/90 p-1 text-white hover:bg-red-600 transition"
                                title="删除照片"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Add Image Button */}
                      {images.length < 9 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isCompressing}
                          className="flex aspect-square flex-col items-center justify-center rounded-[10px] border border-dashed border-[#D8DDD8] bg-[#FAF8F5] text-[#5A6670]/60 hover:border-[#D86F82] hover:text-[#D86F82] transition"
                        >
                          {isCompressing ? (
                            <span className="text-[10px]">压缩中...</span>
                          ) : (
                            <>
                              <Camera className="h-5 w-5 mb-1" />
                              <span className="text-[10px] font-medium">传照片</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.heic,.heif,.HEIC,.HEIF"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Note */}
                  <div>
                    <label className="block text-xs font-semibold text-[#5A6670]/80 mb-1.5">
                      心愿碎碎念 / 计划清单
                    </label>
                    <textarea
                      placeholder="写点想在当地做的事，比如吃什么特色美食、打卡哪个景点、看日落日出..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      className="w-full rounded-[10px] border border-[#D8DDD8] bg-white p-3 text-xs text-[#5A6670] outline-none transition focus:border-[#D86F82]"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-[#D8DDD8]/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-[10px] border border-[#D8DDD8] bg-white px-4 py-2 text-xs font-semibold text-[#5A6670] hover:bg-[#FAFBF7] transition"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!selectedCityId || !title.trim()}
                    className="rounded-[10px] bg-[#D86F82] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#c95d70] disabled:opacity-40"
                  >
                    {editingId ? "保存修改" : "许下心愿"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Lightbox */}
        {isLightboxOpen && lightboxPhotos.length > 0 && (
          <Lightbox
            photos={lightboxPhotos}
            initialIndex={lightboxIndex}
            onClose={() => setIsLightboxOpen(false)}
          />
        )}
      </div>
    </MemoryPageShell>
  );
}
