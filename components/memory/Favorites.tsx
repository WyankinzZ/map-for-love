"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Heart,
  Plus,
  Search,
  MapPin,
  Trash2,
  Pencil,
  X,
  ImagePlus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Compass,
  Utensils,
  Hotel,
  Camera,
  Calendar,
  Sparkles,
  Route as RouteIcon,
  CheckCircle2,
  Clock,
  ArrowRight,
  Maximize2,
  ChevronDown,
  Navigation,
  Dices,
  Shuffle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cities, type City } from "@/data/cities";
import { MemoryPageShell } from "@/components/MemoryNav";
import { useAdminMode } from "@/hooks/useAdminMode";
import { CitySearchSelect } from "@/components/shared/CitySearchSelect";
import { Lightbox } from "@/components/shared/Lightbox";
import { LocalPrivacyImg } from "@/components/LocalPrivacyImage";
import { readCompressedImageDataUrl } from "@/utils/imageUtils";
import { readJson, writeJson } from "@/lib/client/storage";
import { scrollToPageTop } from "@/lib/client/scroll";

export type FavoriteCategory = "all" | "spot" | "route" | "food" | "stay" | "guide";
export type FavoriteStatus = "wish" | "planned" | "visited";

export interface RouteStep {
  id: string;
  stepNumber: number;
  title: string;
  location?: string;
  cityId?: string;
  description?: string;
}

export interface FavoriteRecord {
  id: string;
  title: string;
  category: "spot" | "route" | "food" | "stay" | "guide";
  cityId?: string;
  customLocation?: string;
  coverImage?: string;
  images: string[];
  content: string;
  note?: string;
  date?: string;
  tags: string[];
  routeSteps?: RouteStep[];
  routeDuration?: string;
  budget?: string;
  bestSeason?: string;
  status: FavoriteStatus;
  liked?: boolean;
  likeCount?: number;
  rating?: number;
  externalLink?: string;
}

const STORAGE_KEY = "mapofus:favorites";

const CATEGORIES = [
  { id: "all", label: "全部灵感", icon: Sparkles, color: "#E8B8C2" },
  { id: "spot", label: "景点打卡", icon: Camera, color: "#E8B8C2" },
  { id: "route", label: "旅行路线", icon: RouteIcon, color: "#A8C8DC" },
  { id: "food", label: "美食探店", icon: Utensils, color: "#F2A97F" },
  { id: "stay", label: "宝藏住宿", icon: Hotel, color: "#9BBDA8" },
  { id: "guide", label: "游玩攻略", icon: Compass, color: "#D4A5C6" },
] as const;

const STATUS_CONFIG: Record<FavoriteStatus, { label: string; bg: string; text: string; icon: typeof Heart }> = {
  wish: { label: "心愿种草", bg: "bg-[#F5DCE0]/65", text: "text-[#D98A98]", icon: Heart },
  planned: { label: "已入计划", bg: "bg-[#D6E8F0]/70", text: "text-[#5A8CA8]", icon: Calendar },
  visited: { label: "已经去过", bg: "bg-[#D4E8D0]/70", text: "text-[#4A7D5C]", icon: CheckCircle2 },
};

// Preset Dropdown Options for Form
const DURATION_PRESETS = [
  "半日游 (3-5小时)",
  "一日暴走",
  "周末短途 (2天1晚)",
  "3天2晚 (经典行程)",
  "4天3晚",
  "5天4晚 (深度慢游)",
  "一周长假 (6-7天)",
  "大环线自驾 (8-10天)",
  "半月长游 (15天+)",
];

const BUDGET_PRESETS = [
  "穷游打卡 (¥200以内)",
  "人均 ¥300 - ¥500",
  "人均 ¥500 - ¥1000",
  "人均 ¥1000 - ¥2000",
  "人均 ¥2000 - ¥3500",
  "人均 ¥3500 - ¥5000",
  "品质轻奢 (¥5000+)",
  "丰俭由人",
];

const SEASON_PRESETS = [
  "四季皆宜",
  "春季踏青 (3 - 5月)",
  "夏季避暑 (6 - 8月)",
  "秋季金秋 (9 - 11月)",
  "冬季雪景 (12 - 2月)",
  "盛夏看海 (7 - 8月)",
  "深秋红叶 (10 - 11月)",
  "冬日温泉 / 暖冬",
  "节假日 / 周末限定",
];

const PRESET_TAGS = [
  "拍照出片",
  "绝美日落",
  "必吃老字号",
  "小众冷门",
  "情侣约会",
  "治愈系风景",
  "周末自驾",
  "夜市小吃",
  "避暑胜地",
  "雪景大片",
  "海边散步",
];

function normalizeFavorite(raw: any): FavoriteRecord {
  const images = Array.isArray(raw.images) && raw.images.length > 0
    ? raw.images
    : (raw.coverImage ? [raw.coverImage] : []);

  return {
    id: String(raw.id || `fav-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    title: String(raw.title || "未命名地点"),
    category: (["spot", "route", "food", "stay", "guide"].includes(raw.category)
      ? raw.category
      : (raw.routeSteps && raw.routeSteps.length > 0 ? "route" : "spot")),
    cityId: typeof raw.cityId === "string" && raw.cityId.trim() ? raw.cityId.trim() : undefined,
    customLocation: typeof raw.customLocation === "string" ? raw.customLocation : (typeof raw.location === "string" ? raw.location : ""),
    coverImage: images[0] || "",
    images,
    content: String(raw.content || raw.note || ""),
    note: String(raw.note || raw.content || ""),
    date: typeof raw.date === "string" ? raw.date : "",
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t: any) => typeof t === "string") : [],
    routeSteps: Array.isArray(raw.routeSteps)
      ? raw.routeSteps.map((step: any, idx: number) => ({
          id: String(step.id || `step-${idx + 1}`),
          stepNumber: typeof step.stepNumber === "number" ? step.stepNumber : idx + 1,
          title: String(step.title || `第 ${idx + 1} 站`),
          location: typeof step.location === "string" ? step.location : "",
          cityId: typeof step.cityId === "string" ? step.cityId : undefined,
          description: typeof step.description === "string" ? step.description : "",
        }))
      : [],
    routeDuration: typeof raw.routeDuration === "string" ? raw.routeDuration : "",
    budget: typeof raw.budget === "string" ? raw.budget : "",
    bestSeason: typeof raw.bestSeason === "string" ? raw.bestSeason : "",
    status: (["wish", "planned", "visited"].includes(raw.status) ? raw.status : "wish"),
    liked: Boolean(raw.liked),
    likeCount: typeof raw.likeCount === "number" ? raw.likeCount : (raw.liked ? 88 : Math.floor(Math.random() * 25) + 5),
    rating: typeof raw.rating === "number" ? raw.rating : 5,
    externalLink: typeof raw.externalLink === "string" ? raw.externalLink : "",
  };
}

export default function FavoritesPage() {
  const isAdmin = useAdminMode();
  const [items, setItems] = useState<FavoriteRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FavoriteCategory>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>("all");

  // Random Hero Carousel state (每次打开随机轮播)
  const [randomCarouselItems, setRandomCarouselItems] = useState<FavoriteRecord[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // Detail Modal
  const [activeRecord, setActiveRecord] = useState<FavoriteRecord | null>(null);
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Create / Edit Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCategory, setFormCategory] = useState<"spot" | "route" | "food" | "stay" | "guide">("spot");
  const [formTitle, setFormTitle] = useState("");
  const [formCityId, setFormCityId] = useState("");
  const [formCustomLocation, setFormCustomLocation] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [formStatus, setFormStatus] = useState<FavoriteStatus>("wish");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formRouteDuration, setFormRouteDuration] = useState("");
  const [formBudget, setFormBudget] = useState("");
  const [formBestSeason, setFormBestSeason] = useState("");
  const [formExternalLink, setFormExternalLink] = useState("");
  const [formRouteSteps, setFormRouteSteps] = useState<RouteStep[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Custom text toggles for dropdowns
  const [customDurationMode, setCustomDurationMode] = useState(false);
  const [customBudgetMode, setCustomBudgetMode] = useState(false);
  const [customSeasonMode, setCustomSeasonMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load items from local storage first, then try cloud storage
  useEffect(() => {
    let cancelled = false;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && !cancelled) {
          const list = parsed.map(normalizeFavorite);
          setItems(list);
          setIsLoaded(true);
        }
      }
    } catch {
      // fallback
    }

    readJson<any[]>("favorites", [])
      .then((cloudItems) => {
        if (cancelled || !Array.isArray(cloudItems) || cloudItems.length === 0) return;
        setItems((current) => {
          if (current.length === 0) {
            const normalized = cloudItems.map(normalizeFavorite);
            try {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
            } catch {}
            return normalized;
          }
          return current;
        });
        setIsLoaded(true);
      })
      .catch(() => {});

    setIsLoaded(true);
    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize and shuffle random carousel items whenever items change
  const shuffleCarousel = useCallback(() => {
    if (items.length === 0) {
      setRandomCarouselItems([]);
      return;
    }
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    setRandomCarouselItems(shuffled.slice(0, 8)); // Top 8 random picks
    setCarouselIndex(0);
  }, [items]);

  useEffect(() => {
    shuffleCarousel();
  }, [shuffleCarousel]);

  // Carousel auto-advance timer
  useEffect(() => {
    if (randomCarouselItems.length <= 1 || isCarouselPaused) return;

    const timer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % randomCarouselItems.length);
    }, 5500);

    return () => clearInterval(timer);
  }, [randomCarouselItems.length, isCarouselPaused]);

  // Random pick single inspiration action (用户点击“随机抽一篇”直接弹出)
  const pickRandomInspiration = () => {
    if (items.length === 0) {
      alert("还没有收藏任何地点或路线，先点击右上角新增一条吧！");
      return;
    }
    const randomIndex = Math.floor(Math.random() * items.length);
    const chosen = items[randomIndex];
    setActiveRecord(chosen);
    setDetailPhotoIndex(0);
  };

  // Save changes
  const persistItems = (next: FavoriteRecord[]) => {
    setItems(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    writeJson("favorites", next).catch(() => {});
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
    if (activeRecord && activeRecord.id === id) {
      setActiveRecord((prev) => (prev ? { ...prev, liked: !prev.liked, likeCount: (prev.likeCount ?? 0) + (!prev.liked ? 1 : -1) } : null));
    }
  };

  // Change status in detail
  const changeStatus = (id: string, newStatus: FavoriteStatus) => {
    const next = items.map((item) => (item.id === id ? { ...item, status: newStatus } : item));
    persistItems(next);
    if (activeRecord && activeRecord.id === id) {
      setActiveRecord((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  // Delete
  const removeItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    if (!window.confirm("确定要删除这条种草记录吗？")) return;
    const next = items.filter((item) => item.id !== id);
    persistItems(next);
    if (activeRecord?.id === id) setActiveRecord(null);
  };

  // Form open for create
  const openCreateForm = (categoryPreset?: "spot" | "route") => {
    if (!isAdmin) return;
    setEditingId(null);
    setFormCategory(categoryPreset || "spot");
    setFormTitle("");
    setFormCityId("");
    setFormCustomLocation("");
    setFormContent("");
    setFormTags([]);
    setCustomTagInput("");
    setFormStatus("wish");
    setFormImages([]);
    setFormRouteDuration("");
    setFormBudget("");
    setFormBestSeason("");
    setFormExternalLink("");
    setCustomDurationMode(false);
    setCustomBudgetMode(false);
    setCustomSeasonMode(false);
    setFormRouteSteps(
      categoryPreset === "route"
        ? [
            { id: "step-1", stepNumber: 1, title: "第一站", location: "", description: "" },
            { id: "step-2", stepNumber: 2, title: "第二站", location: "", description: "" },
          ]
        : [],
    );
    setIsFormOpen(true);
  };

  // Form open for edit
  const openEditForm = (item: FavoriteRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    setEditingId(item.id);
    setFormCategory(item.category);
    setFormTitle(item.title);
    setFormCityId(item.cityId || "");
    setFormCustomLocation(item.customLocation || "");
    setFormContent(item.content);
    setFormTags(item.tags || []);
    setCustomTagInput("");
    setFormStatus(item.status);
    setFormImages(item.images || []);
    setFormRouteDuration(item.routeDuration || "");
    setFormBudget(item.budget || "");
    setFormBestSeason(item.bestSeason || "");
    setFormExternalLink(item.externalLink || "");
    setCustomDurationMode(Boolean(item.routeDuration && !DURATION_PRESETS.includes(item.routeDuration)));
    setCustomBudgetMode(Boolean(item.budget && !BUDGET_PRESETS.includes(item.budget)));
    setCustomSeasonMode(Boolean(item.bestSeason && !SEASON_PRESETS.includes(item.bestSeason)));
    setFormRouteSteps(item.routeSteps && item.routeSteps.length > 0 ? item.routeSteps : []);
    setIsFormOpen(true);
  };

  // Image Upload handler (Compressed locally, 100% offline support without OSS)
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

  // Tag helpers
  const togglePresetTag = (tag: string) => {
    setFormTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const addCustomTag = () => {
    const trimmed = customTagInput.trim().replace(/^#/, "");
    if (trimmed && !formTags.includes(trimmed)) {
      setFormTags((prev) => [...prev, trimmed]);
      setCustomTagInput("");
    }
  };

  // Route step helpers
  const addRouteStep = () => {
    setFormRouteSteps((prev) => [
      ...prev,
      {
        id: `step-${Date.now()}`,
        stepNumber: prev.length + 1,
        title: `第 ${prev.length + 1} 站`,
        location: "",
        description: "",
      },
    ]);
  };

  const updateRouteStep = (index: number, patch: Partial<RouteStep>) => {
    setFormRouteSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    );
  };

  const removeRouteStep = (index: number) => {
    setFormRouteSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, stepNumber: i + 1 })),
    );
  };

  const moveRouteStep = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formRouteSteps.length) return;
    setFormRouteSteps((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((step, i) => ({ ...step, stepNumber: i + 1 }));
    });
  };

  // Save form
  const handleSaveForm = () => {
    if (!formTitle.trim()) {
      alert("请填写灵感或路线标题");
      return;
    }

    const newRecord: FavoriteRecord = {
      id: editingId || `fav-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: formTitle.trim(),
      category: formCategory,
      cityId: formCityId || undefined,
      customLocation: formCustomLocation.trim(),
      coverImage: formImages[0] || "",
      images: formImages,
      content: formContent.trim(),
      tags: formTags,
      status: formStatus,
      routeSteps: formCategory === "route" ? formRouteSteps : undefined,
      routeDuration: formRouteDuration.trim(),
      budget: formBudget.trim(),
      bestSeason: formBestSeason.trim(),
      externalLink: formExternalLink.trim(),
      liked: editingId ? (items.find((i) => i.id === editingId)?.liked ?? false) : false,
      likeCount: editingId ? (items.find((i) => i.id === editingId)?.likeCount ?? 1) : 1,
      date: new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "."),
    };

    const next = editingId
      ? items.map((item) => (item.id === editingId ? newRecord : item))
      : [newRecord, ...items];

    persistItems(next);
    setIsFormOpen(false);
    if (activeRecord && activeRecord.id === editingId) {
      setActiveRecord(newRecord);
    }
  };

  // Cities that have items
  const populatedCityIds = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.cityId) set.add(item.cityId);
    });
    return Array.from(set);
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      if (selectedStatus !== "all" && item.status !== selectedStatus) {
        return false;
      }
      if (selectedCityFilter !== "all" && item.cityId !== selectedCityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const city = cities.find((c) => c.id === item.cityId);
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchContent = item.content.toLowerCase().includes(q);
        const matchCity = city?.name.toLowerCase().includes(q);
        const matchLoc = item.customLocation?.toLowerCase().includes(q);
        const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
        const matchSteps = item.routeSteps?.some(
          (s) => s.title.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q),
        );
        if (!matchTitle && !matchContent && !matchCity && !matchLoc && !matchTags && !matchSteps) {
          return false;
        }
      }
      return true;
    });
  }, [items, selectedCategory, selectedStatus, selectedCityFilter, searchQuery]);

  // Current featured carousel item
  const currentCarouselItem = randomCarouselItems[carouselIndex] || null;

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
  }, [selectedCategory, selectedStatus, selectedCityFilter, searchQuery, isMobile]);

  // Stats
  const stats = useMemo(() => {
    const total = items.length;
    const routes = items.filter((i) => i.category === "route").length;
    const spots = items.filter((i) => i.category === "spot" || i.category === "food").length;
    const visited = items.filter((i) => i.status === "visited").length;
    return { total, routes, spots, visited };
  }, [items]);

  return (
    <MemoryPageShell active="favorites">
      {/* Header section with XiaoHongShu aesthetic */}
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full bg-[#F5DCE0]/80 text-[#E8B8C2] shadow-sm">
              <Heart className="h-4 w-4 sm:h-5 sm:w-5 fill-[#E8B8C2]" />
            </span>
            <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight text-[#5A6670]">地点种草与路线收藏</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm font-medium text-[#5A6670]/60">
            像小红书一样收藏心动景点、美食打卡与浪漫旅行路线，先存好攻略，随时出发。
          </p>
        </div>

        {/* Action buttons & Random draw */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-[#D8DDD8]/80 bg-[#FAFBF7]/80 px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-[#5A6670]/70 shadow-sm backdrop-blur">
            <span>💖 种草 {stats.total}</span>
            <span className="text-[#D8DDD8]">|</span>
            <span>🚗 路线 {stats.routes}</span>
            <span className="text-[#D8DDD8]">|</span>
            <span className="text-[#4A7D5C]">✨ 已打卡 {stats.visited}</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* 🎲 随机抽一篇 按钮 */}
            <button
              type="button"
              onClick={pickRandomInspiration}
              className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-[#E8B8C2]/80 bg-[#F5DCE0]/50 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#D98A98] shadow-sm transition hover:bg-[#F5DCE0] active:scale-95"
              title="随机弹出一篇收藏的攻略或路线"
            >
              <Dices className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#E8B8C2]" />
              <span>抽一篇</span>
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => openCreateForm("route")}
                  className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-[#A8C8DC]/80 bg-[#D6E8F0]/50 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#4A7490] shadow-sm transition hover:bg-[#D6E8F0] active:scale-95"
                >
                  <RouteIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>路线</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCreateForm("spot")}
                  className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-[#E8B8C2] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_6px_16px_rgba(232,184,194,0.4)] transition hover:bg-[#D6A6B0] active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>种草</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="mb-5 sm:mb-8 space-y-2.5 sm:space-y-3">
        {/* Search bar & quick city filter */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6670]/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索地名、攻略关键词、标签、路线站点..."
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

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            {/* City Filter */}
            <div className="relative">
              <select
                value={selectedCityFilter}
                onChange={(e) => setSelectedCityFilter(e.target.value)}
                className="w-full sm:w-auto h-9 appearance-none rounded-full border border-[#D8DDD8]/80 bg-white/70 pl-3 pr-7 text-xs font-medium text-[#5A6670] outline-none transition focus:border-[#E8B8C2]"
              >
                <option value="all">📍 全部城市 ({items.length})</option>
                {populatedCityIds.map((cid) => {
                  const c = cities.find((cand) => cand.id === cid);
                  const count = items.filter((i) => i.cityId === cid).length;
                  return (
                    <option key={cid} value={cid}>
                      {c?.name || cid} ({count})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5A6670]/50" />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full sm:w-auto h-9 appearance-none rounded-full border border-[#D8DDD8]/80 bg-white/70 pl-3 pr-7 text-xs font-medium text-[#5A6670] outline-none transition focus:border-[#E8B8C2]"
              >
                <option value="all">🌱 全部状态</option>
                <option value="wish">🌱 心愿种草</option>
                <option value="planned">✈️ 已入计划</option>
                <option value="visited">🎉 已经去过</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5A6670]/50" />
            </div>
          </div>
        </div>

        {/* Category Pills (Xiaohongshu style) */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            const count =
              cat.id === "all" ? items.length : items.filter((i) => i.category === cat.id).length;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as FavoriteCategory)}
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

      {/* 🎲 全部灵感：随机轮播图推荐 (Random Inspiration Hero Carousel) */}
      {selectedCategory === "all" && currentCarouselItem && !searchQuery && selectedCityFilter === "all" && (
        <div
          onMouseEnter={() => setIsCarouselPaused(true)}
          onMouseLeave={() => setIsCarouselPaused(false)}
          className="relative mb-6 sm:mb-8 overflow-hidden rounded-[18px] sm:rounded-[20px] border border-[#D8DDD8]/80 bg-gradient-to-r from-white via-[#FAFBF7] to-white p-3.5 sm:p-6 shadow-[0_12px_32px_rgba(90,102,112,0.08)] backdrop-blur transition-all"
        >
          {/* Top banner bar: random badge and shuffle button */}
          <div className="mb-3.5 flex items-center justify-between border-b border-[#D8DDD8]/40 pb-2.5 gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="flex items-center gap-1 rounded-full bg-[#F5DCE0]/70 px-2 py-0.5 sm:px-2.5 sm:py-0.5 text-[11px] sm:text-xs font-bold text-[#E8B8C2] whitespace-nowrap shrink-0">
                <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                <span className="hidden sm:inline">今日偶遇灵感 · 随机翻牌</span>
                <span className="inline sm:hidden">随机翻牌</span>
              </span>
              <span className="hidden md:inline text-xs text-[#5A6670]/50 truncate">
                每次打开都是不一样的旅行攻略
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={shuffleCarousel}
                className="flex items-center gap-1 rounded-full border border-[#D8DDD8]/70 bg-white/80 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-semibold text-[#5A6670] shadow-xs transition hover:border-[#E8B8C2] hover:text-[#E8B8C2]"
                title="打乱顺序，重新换一批随机灵感"
              >
                <Shuffle className="h-3 w-3 text-[#A8C8DC]" />
                <span>换一批</span>
              </button>
              <div className="flex items-center gap-0.5 sm:gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setCarouselIndex((prev) =>
                      prev > 0 ? prev - 1 : randomCarouselItems.length - 1,
                    )
                  }
                  className="grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-full border border-[#D8DDD8]/70 bg-white/80 text-[#5A6670]/70 transition hover:bg-white hover:text-[#5A6670]"
                  aria-label="上一篇"
                >
                  <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <span className="text-[11px] sm:text-xs font-medium text-[#5A6670]/50 min-w-[28px] sm:min-w-[32px] text-center">
                  {carouselIndex + 1}/{randomCarouselItems.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCarouselIndex((prev) =>
                      (prev + 1) % randomCarouselItems.length,
                    )
                  }
                  className="grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-full border border-[#D8DDD8]/70 bg-white/80 text-[#5A6670]/70 transition hover:bg-white hover:text-[#5A6670]"
                  aria-label="下一篇"
                >
                  <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Carousel Body */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            {/* Carousel Left/Top: Hero Image */}
            <div
              onClick={() => {
                setActiveRecord(currentCarouselItem);
                setDetailPhotoIndex(0);
              }}
              className="relative aspect-[16/9] md:aspect-[16/10] md:col-span-7 w-full cursor-pointer overflow-hidden rounded-[14px] bg-[#1f2429] group shadow-sm"
            >
              {currentCarouselItem.images && currentCarouselItem.images.length > 0 ? (
                <LocalPrivacyImg
                  src={currentCarouselItem.images[0]}
                  alt={currentCarouselItem.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-white/50 bg-gradient-to-br from-[#F5DCE0]/40 via-[#D6E8F0]/40 to-[#FAFBF7]">
                  {currentCarouselItem.category === "route" ? (
                    <RouteIcon className="h-10 w-10 text-[#A8C8DC]" />
                  ) : (
                    <Camera className="h-10 w-10 text-[#E8B8C2]" />
                  )}
                  <p className="mt-2 text-sm font-semibold text-[#5A6670]">
                    {currentCarouselItem.title}
                  </p>
                </div>
              )}

              {/* Gradient & badges */}
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
              <div className="absolute left-3 top-3 flex items-center gap-1.5">
                <span className="rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-md">
                  {currentCarouselItem.category === "route"
                    ? "🚗 旅行路线"
                    : currentCarouselItem.category === "food"
                    ? "🍜 美食探店"
                    : currentCarouselItem.category === "stay"
                    ? "🏡 宝藏住宿"
                    : "🌄 景点打卡"}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md ${STATUS_CONFIG[currentCarouselItem.status].bg} ${STATUS_CONFIG[currentCarouselItem.status].text}`}>
                  {STATUS_CONFIG[currentCarouselItem.status].label}
                </span>
              </div>

              {currentCarouselItem.images && currentCarouselItem.images.length > 1 && (
                <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-md">
                  <Camera className="h-3 w-3" />
                  {currentCarouselItem.images.length}
                </span>
              )}

              {/* Bottom Route Summary on image */}
              {currentCarouselItem.category === "route" && currentCarouselItem.routeSteps && (
                <div className="absolute inset-x-3 bottom-2.5 flex items-center justify-between text-xs font-semibold text-white drop-shadow-md">
                  <span>🗺️ 途经 {currentCarouselItem.routeSteps.length} 个站点</span>
                  {currentCarouselItem.routeDuration && <span>⏱️ {currentCarouselItem.routeDuration}</span>}
                </div>
              )}
            </div>

            {/* Carousel Right/Bottom: Description & quick actions */}
            <div className="flex flex-col justify-between md:col-span-5 h-full space-y-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#A8C8DC]">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>
                    {cities.find((c) => c.id === currentCarouselItem.cityId)?.name || ""}
                    {currentCarouselItem.customLocation
                      ? (currentCarouselItem.cityId ? ` · ${currentCarouselItem.customLocation}` : currentCarouselItem.customLocation)
                      : ""}
                    {!currentCarouselItem.cityId && !currentCarouselItem.customLocation && "美好远方"}
                  </span>
                </div>

                <h2
                  onClick={() => {
                    setActiveRecord(currentCarouselItem);
                    setDetailPhotoIndex(0);
                  }}
                  className="mt-1.5 text-lg sm:text-2xl font-bold leading-snug text-[#5A6670] hover:text-[#E8B8C2] cursor-pointer transition-colors"
                >
                  {currentCarouselItem.title}
                </h2>

                {/* Route milestones breadcrumb */}
                {currentCarouselItem.category === "route" && currentCarouselItem.routeSteps && currentCarouselItem.routeSteps.length > 0 && (
                  <div className="mt-2.5 rounded-[10px] bg-[#FAFBF7] p-2.5 border border-[#D8DDD8]/60 text-xs text-[#5A6670]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {currentCarouselItem.routeSteps.map((step, idx) => (
                        <span key={step.id} className="flex items-center gap-1">
                          {idx > 0 && <span className="text-[#A8C8DC]">➔</span>}
                          <span className="font-semibold text-[#5A6670]">
                            {step.location || step.title}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content snippet */}
                {currentCarouselItem.content && (
                  <p className="mt-2.5 line-clamp-3 text-xs sm:text-sm leading-relaxed text-[#5A6670]/70">
                    {currentCarouselItem.content}
                  </p>
                )}

                {/* Badges: duration, budget, season */}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {currentCarouselItem.routeDuration && (
                    <span className="flex items-center gap-1 rounded-md bg-[#FAFBF7] px-2 py-1 text-[#5A6670]/80 border border-[#D8DDD8]/60">
                      <Clock className="h-3 w-3 text-[#A8C8DC]" />
                      {currentCarouselItem.routeDuration}
                    </span>
                  )}
                  {currentCarouselItem.budget && (
                    <span className="flex items-center gap-1 rounded-md bg-[#FAFBF7] px-2 py-1 text-[#5A6670]/80 border border-[#D8DDD8]/60">
                      <span className="font-bold text-[#F2A97F]">¥</span>
                      {currentCarouselItem.budget}
                    </span>
                  )}
                  {currentCarouselItem.bestSeason && (
                    <span className="flex items-center gap-1 rounded-md bg-[#FAFBF7] px-2 py-1 text-[#5A6670]/80 border border-[#D8DDD8]/60">
                      <Calendar className="h-3 w-3 text-[#9BBDA8]" />
                      {currentCarouselItem.bestSeason}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex items-center justify-between border-t border-[#D8DDD8]/40">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRecord(currentCarouselItem);
                    setDetailPhotoIndex(0);
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-[#E8B8C2] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#D6A6B0] active:scale-95"
                >
                  <span>查看完整攻略</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={(e) => toggleLike(currentCarouselItem.id, e)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-110 ${
                    currentCarouselItem.liked
                      ? "border-[#E8B8C2] bg-[#F5DCE0]/50 text-[#E8B8C2]"
                      : "border-[#D8DDD8] bg-white text-[#5A6670]/70 hover:border-[#E8B8C2]"
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${currentCarouselItem.liked ? "fill-[#E8B8C2]" : ""}`} />
                  <span>{currentCarouselItem.likeCount ?? 0}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Dots Indicator */}
          {randomCarouselItems.length > 1 && (
            <div className="mt-4 flex items-center justify-center gap-1.5">
              {randomCarouselItems.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCarouselIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    carouselIndex === idx ? "w-6 bg-[#E8B8C2]" : "w-1.5 bg-[#D8DDD8] hover:bg-[#A8C8DC]"
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Xiaohongshu Waterfall Grid of Note Cards */}
      {filteredItems.length > 0 ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-5">
            {paginatedItems.map((item) => {
            const city = cities.find((c) => c.id === item.cityId);
            const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.wish;
            const isRoute = item.category === "route";
            const cover = item.images && item.images.length > 0 ? item.images[0] : item.coverImage;

            return (
              <motion.article
                key={item.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => {
                  setActiveRecord(item);
                  setDetailPhotoIndex(0);
                }}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[14px] border border-[#D8DDD8]/80 bg-white/85 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#E8B8C2]/60 hover:shadow-[0_16px_36px_rgba(90,102,112,0.12)] backdrop-blur"
              >
                {/* Card Media Preview (Xiaohongshu aspect ratio) */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#F5DCE0]/35 via-[#D6E8F0]/30 to-[#FAFBF7]">
                  {cover ? (
                    <LocalPrivacyImg
                      src={cover}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-[#FAFBF7]/80 text-[#E8B8C2] shadow-inner">
                        {isRoute ? <RouteIcon className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
                      </span>
                      <p className="mt-2 text-xs font-semibold text-[#5A6670]/70">
                        {city?.name || item.customLocation || "美好打卡地"}
                      </p>
                      <span className="mt-1 text-[10px] text-[#5A6670]/40">点开可上传美照与攻略</span>
                    </div>
                  )}

                  {/* Gradient shadow for text readibility */}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 via-black/15 to-transparent pointer-events-none" />

                  {/* Top-left Badges */}
                  <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                    <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                      {isRoute ? "🚗 路线" : item.category === "food" ? "🍜 美食" : item.category === "stay" ? "🏡 住宿" : "🌄 景点"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md ${statusInfo.bg} ${statusInfo.text}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Top-right Photo count badge */}
                  {item.images && item.images.length > 1 && (
                    <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                      <Camera className="h-3 w-3" />
                      {item.images.length}
                    </span>
                  )}

                  {/* Bottom overlay for Route info */}
                  {isRoute && (
                    <div className="absolute inset-x-2.5 bottom-2 flex items-center justify-between text-[11px] font-semibold text-white drop-shadow-md">
                      <span className="flex items-center gap-1">
                        <Navigation className="h-3 w-3" />
                        {item.routeSteps && item.routeSteps.length > 0
                          ? `${item.routeSteps.length} 个途经站`
                          : "精品自驾路线"}
                      </span>
                      {item.routeDuration && <span>{item.routeDuration}</span>}
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                  {/* Title */}
                  <h3 className="line-clamp-2 text-sm sm:text-base font-semibold leading-snug text-[#5A6670] group-hover:text-[#E8B8C2] transition-colors">
                    {item.title}
                  </h3>

                  {/* Location pill */}
                  <div className="mt-2 flex items-center gap-1 text-xs font-medium text-[#A8C8DC]">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {city?.name ? `${city.name}` : ""}
                      {item.customLocation ? (city?.name ? ` · ${item.customLocation}` : item.customLocation) : ""}
                      {!city?.name && !item.customLocation && "待定地点"}
                    </span>
                  </div>

                  {/* Route Steps breadcrumb preview */}
                  {isRoute && item.routeSteps && item.routeSteps.length > 0 && (
                    <div className="mt-2 rounded-[8px] bg-[#FAFBF7] p-2 text-[11px] text-[#5A6670]/70 border border-[#D8DDD8]/40">
                      <div className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
                        {item.routeSteps.slice(0, 3).map((step, idx) => (
                          <span key={step.id} className="flex items-center gap-1">
                            {idx > 0 && <span className="text-[#A8C8DC]">➔</span>}
                            <span className="truncate max-w-[80px] font-medium text-[#5A6670]">
                              {step.location || step.title}
                            </span>
                          </span>
                        ))}
                        {item.routeSteps.length > 3 && (
                          <span className="text-[#A8C8DC] text-[10px]">+{item.routeSteps.length - 3}站</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Content snippet */}
                  {item.content && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#5A6670]/65">
                      {item.content}
                    </p>
                  )}

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-[4px] bg-[#FAFBF7] px-1.5 py-0.5 text-[10px] text-[#5A6670]/60 border border-[#D8DDD8]/50"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Card Footer (Xiaohongshu style interaction) */}
                  <div className="mt-auto flex items-center justify-between border-t border-[#D8DDD8]/40 pt-3">
                    <span className="text-[11px] text-[#5A6670]/40">
                      {item.date || "心动已存"}
                    </span>

                    <div className="flex items-center gap-3">
                      {/* Heart Like button */}
                      <button
                        type="button"
                        onClick={(e) => toggleLike(item.id, e)}
                        className={`flex items-center gap-1 text-xs font-semibold transition active:scale-125 ${
                          item.liked ? "text-[#E8B8C2]" : "text-[#5A6670]/40 hover:text-[#E8B8C2]"
                        }`}
                        title="标记心动"
                      >
                        <Heart className={`h-4 w-4 ${item.liked ? "fill-[#E8B8C2]" : ""}`} />
                        <span>{item.likeCount ?? 0}</span>
                      </button>

                      {/* Admin quick actions */}
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
                共 {filteredItems.length} 条灵感 · 第 {safeCurrentPage} / {totalPages} 页
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
                    if (isMobile && totalPages > 5) {
                      if (pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - safeCurrentPage) > 1) {
                        if (pageNum === 2 || pageNum === totalPages - 1) {
                          return <span key={pageNum} className="text-[#5A6670]/40 text-xs px-0.5">…</span>;
                        }
                        return null;
                      }
                    }
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
            <Heart className="h-8 w-8" />
          </span>
          <h3 className="mt-4 text-base sm:text-lg font-semibold text-[#5A6670]">暂无符合条件的种草灵感</h3>
          <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-[#5A6670]/60">
            {searchQuery || selectedCategory !== "all" || selectedCityFilter !== "all"
              ? "试着切换筛选分类或清空搜索关键词吧。"
              : "还没有记录想去的地方？点击右上角“记录种草”或“规划路线”，把未来想一起去的地方存下来吧！"}
          </p>
          {isAdmin && (
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => openCreateForm("spot")}
                className="flex items-center gap-1.5 rounded-full bg-[#E8B8C2] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-[#D6A6B0]"
              >
                <Plus className="h-4 w-4" />
                新增第一个种草
              </button>
            </div>
          )}
        </div>
      )}

      {/* Xiaohongshu Note Detail Modal (沉浸式笔记详情弹窗) */}
      <AnimatePresence>
        {activeRecord && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative flex flex-col md:flex-row h-[90vh] max-h-[780px] w-full max-w-5xl overflow-hidden rounded-[20px] bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setActiveRecord(null)}
                className="absolute right-3.5 top-3.5 z-30 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-[#5A6670] shadow-md backdrop-blur transition hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Left/Top: Gallery Carousel (Warm framed photo with ambient backdrop, no dark black bars) */}
              <div className="relative flex flex-col justify-between bg-gradient-to-b from-[#F9F5F6] via-[#F4ECEE] to-[#F1E8EC] md:w-3/5 shrink-0 overflow-hidden">
                {activeRecord.images && activeRecord.images.length > 0 && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                    <LocalPrivacyImg
                      src={activeRecord.images[detailPhotoIndex] || activeRecord.images[0]}
                      alt=""
                      className="h-full w-full object-cover blur-2xl scale-125 opacity-25"
                    />
                    <div className="absolute inset-0 bg-[#FAFBF7]/40 backdrop-blur-xs" />
                  </div>
                )}

                <div className="relative z-10 flex-1 flex items-center justify-center p-3 sm:p-5">
                  {activeRecord.images && activeRecord.images.length > 0 ? (
                    <div className="relative max-h-full max-w-full rounded-[14px] border-[3px] border-white/95 bg-white p-1.5 shadow-[0_10px_28px_rgba(90,102,112,0.16)] flex items-center justify-center">
                      <LocalPrivacyImg
                        src={activeRecord.images[detailPhotoIndex] || activeRecord.images[0]}
                        alt={activeRecord.title}
                        className="max-h-[210px] md:max-h-[500px] w-auto max-w-full rounded-[10px] object-contain select-none"
                      />
                      {/* Enlarge Lightbox Trigger */}
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(detailPhotoIndex)}
                        className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white shadow-md backdrop-blur-md transition hover:bg-black/75 hover:scale-105 active:scale-95"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        高清全屏
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-64 md:h-full w-full flex-col items-center justify-center text-center text-[#5A6670]/50">
                      <Camera className="h-12 w-12 text-[#E8B8C2]" />
                      <p className="mt-2 text-sm text-[#5A6670]/80">暂无实景照片</p>
                      <p className="mt-1 text-xs text-[#5A6670]/40">编辑本条记录即可上传本地或云端照片</p>
                    </div>
                  )}

                  {/* Carousel Prev / Next */}
                  {activeRecord.images && activeRecord.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setDetailPhotoIndex((prev) =>
                            prev > 0 ? prev - 1 : activeRecord.images.length - 1,
                          )
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-md transition hover:bg-black/70 hover:scale-105 active:scale-95"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDetailPhotoIndex((prev) =>
                            prev < activeRecord.images.length - 1 ? prev + 1 : 0,
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-md transition hover:bg-black/70 hover:scale-105 active:scale-95"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Bottom thumbnail selector if multiple photos */}
                {activeRecord.images && activeRecord.images.length > 1 && (
                  <div className="relative z-10 no-scrollbar flex items-center justify-center gap-2 overflow-x-auto border-t border-[#D8DDD8]/60 bg-white/80 p-2 backdrop-blur-md">
                    {activeRecord.images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDetailPhotoIndex(idx)}
                        className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-[8px] border-2 transition ${
                          detailPhotoIndex === idx ? "border-[#E8B8C2] scale-105 shadow-sm" : "border-white/80 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <LocalPrivacyImg src={img} alt="thumbnail" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right/Bottom: Note Content & Route Roadmap */}
              <div className="flex flex-1 flex-col overflow-y-auto p-5 sm:p-7">
                {/* Status & Category */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#FAFBF7] px-2.5 py-1 text-xs font-semibold text-[#5A6670] border border-[#D8DDD8]/80">
                    {CATEGORIES.find((c) => c.id === activeRecord.category)?.label || "种草灵感"}
                  </span>

                  {/* Status switcher */}
                  <div className="flex items-center gap-1 rounded-full bg-[#FAFBF7] p-1 border border-[#D8DDD8]/80 text-xs">
                    {(["wish", "planned", "visited"] as FavoriteStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => changeStatus(activeRecord.id, st)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                          activeRecord.status === st
                            ? `${STATUS_CONFIG[st].bg} ${STATUS_CONFIG[st].text} shadow-sm`
                            : "text-[#5A6670]/50 hover:text-[#5A6670]"
                        }`}
                      >
                        {STATUS_CONFIG[st].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <h2 className="mt-3 text-xl sm:text-2xl font-bold leading-snug text-[#5A6670]">
                  {activeRecord.title}
                </h2>

                {/* Location Capsule */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-full bg-[#D6E8F0]/40 px-3 py-1 text-xs font-medium text-[#4A7490]">
                    <MapPin className="h-3.5 w-3.5 text-[#A8C8DC]" />
                    <span>
                      {cities.find((c) => c.id === activeRecord.cityId)?.name || ""}
                      {activeRecord.customLocation
                        ? (activeRecord.cityId ? ` · ${activeRecord.customLocation}` : activeRecord.customLocation)
                        : ""}
                      {!activeRecord.cityId && !activeRecord.customLocation && "未指定具体位置"}
                    </span>
                  </div>

                  {/* Link to Map if cityId is available */}
                  {activeRecord.cityId && (
                    <Link
                      href={`/province/${cities.find((c) => c.id === activeRecord.cityId)?.provinceId || ""}?city=${activeRecord.cityId}`}
                      className="flex items-center gap-1 text-xs font-semibold text-[#A8C8DC] hover:text-[#5A8CA8] underline underline-offset-4"
                    >
                      在地图中查看该城市 ➔
                    </Link>
                  )}
                </div>

                {/* Quick specs pills (budget, duration, season) */}
                {(activeRecord.routeDuration || activeRecord.budget || activeRecord.bestSeason) && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#5A6670]/70">
                    {activeRecord.routeDuration && (
                      <span className="flex items-center gap-1 rounded-md bg-[#FAFBF7] px-2 py-1 border border-[#D8DDD8]/60">
                        <Clock className="h-3 w-3 text-[#A8C8DC]" />
                        {activeRecord.routeDuration}
                      </span>
                    )}
                    {activeRecord.budget && (
                      <span className="flex items-center gap-1 rounded-md bg-[#FAFBF7] px-2 py-1 border border-[#D8DDD8]/60">
                        <span className="text-[#F2A97F] font-bold">¥</span>
                        {activeRecord.budget}
                      </span>
                    )}
                    {activeRecord.bestSeason && (
                      <span className="flex items-center gap-1 rounded-md bg-[#FAFBF7] px-2 py-1 border border-[#D8DDD8]/60">
                        <Calendar className="h-3 w-3 text-[#9BBDA8]" />
                        {activeRecord.bestSeason}
                      </span>
                    )}
                  </div>
                )}

                {/* Route Roadmap Timeline (专为路线展示) */}
                {activeRecord.category === "route" && activeRecord.routeSteps && activeRecord.routeSteps.length > 0 && (
                  <div className="mt-5 rounded-[14px] border border-[#A8C8DC]/40 bg-[#D6E8F0]/15 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <RouteIcon className="h-4 w-4 text-[#A8C8DC]" />
                      <h4 className="text-sm font-semibold text-[#5A6670]">旅行路线行程规划</h4>
                    </div>

                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#A8C8DC]/40">
                      {activeRecord.routeSteps.map((step, idx) => (
                        <div key={step.id} className="relative">
                          <span className="absolute -left-6 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-[#A8C8DC] text-[10px] font-bold text-white shadow-sm">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-xs sm:text-sm font-semibold text-[#5A6670]">
                              {step.title}
                              {step.location && (
                                <span className="ml-1.5 font-normal text-[#A8C8DC]">
                                  @{step.location}
                                </span>
                              )}
                            </p>
                            {step.description && (
                              <p className="mt-1 text-xs leading-relaxed text-[#5A6670]/70">
                                {step.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detailed Note Text */}
                {activeRecord.content && (
                  <div className="mt-4 flex-1">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#5A6670]/50">
                      种草笔记与游玩攻略
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-[#5A6670] whitespace-pre-wrap">
                      {activeRecord.content}
                    </p>
                  </div>
                )}

                {/* Tags */}
                {activeRecord.tags && activeRecord.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {activeRecord.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#FAFBF7] px-2.5 py-1 text-xs text-[#5A6670]/70 border border-[#D8DDD8]/70"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* External link */}
                {activeRecord.externalLink && (
                  <div className="mt-4">
                    <a
                      href={activeRecord.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#E8B8C2]/60 bg-[#F5DCE0]/30 px-3.5 py-1.5 text-xs font-medium text-[#D98A98] hover:bg-[#F5DCE0]/60 transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      查看小红书/外部灵感链接
                    </a>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="mt-6 flex items-center justify-between border-t border-[#D8DDD8]/50 pt-4">
                  <button
                    type="button"
                    onClick={(e) => toggleLike(activeRecord.id, e)}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-sm font-semibold transition active:scale-95 ${
                      activeRecord.liked
                        ? "border-[#E8B8C2] bg-[#F5DCE0]/50 text-[#E8B8C2]"
                        : "border-[#D8DDD8] bg-white text-[#5A6670]/70 hover:border-[#E8B8C2]"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${activeRecord.liked ? "fill-[#E8B8C2]" : ""}`} />
                    <span>{activeRecord.liked ? "已心动" : "标记心动"} ({activeRecord.likeCount ?? 0})</span>
                  </button>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          const target = activeRecord;
                          setActiveRecord(null);
                          openEditForm(target, e);
                        }}
                        className="flex items-center gap-1 rounded-full border border-[#D8DDD8] px-3.5 py-1.5 text-xs font-semibold text-[#5A6670] transition hover:bg-[#FAFBF7]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={(e) => removeItem(activeRecord.id, e)}
                        className="flex items-center gap-1 rounded-full border border-[#F5DCE0] px-3.5 py-1.5 text-xs font-semibold text-[#E8B8C2] transition hover:bg-[#F5DCE0]/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox for full screen high-def viewing */}
      {lightboxIndex !== null && activeRecord?.images && (
        <Lightbox
          photos={activeRecord.images.map((src) => ({ src, alt: activeRecord.title }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Create / Edit Modal (种草与路线发布编辑器) */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[20px] bg-white p-5 sm:p-7 shadow-2xl"
            >
              <div className="mb-5 flex items-center justify-between border-b border-[#D8DDD8]/50 pb-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#5A6670]">
                    {editingId ? "编辑收藏与路线" : "新增地点种草 / 路线"}
                  </h3>
                  <p className="mt-0.5 text-xs text-[#5A6670]/60">
                    支持多张本地照片、丰富游玩文案、多站点行程路线规划
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full text-[#5A6670]/50 hover:bg-[#FAFBF7] hover:text-[#5A6670]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Category Segmented Control */}
              <div className="mb-5 flex items-center gap-1 sm:gap-1.5 rounded-[12px] bg-[#FAFBF7] p-1 sm:p-1.5 border border-[#D8DDD8]/70 overflow-x-auto scrollbar-none">
                {(["spot", "route", "food", "stay", "guide"] as const).map((catKey) => {
                  const cat = CATEGORIES.find((c) => c.id === catKey);
                  const Icon = cat?.icon || Sparkles;
                  const isSel = formCategory === catKey;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setFormCategory(catKey)}
                      className={`flex flex-1 min-w-[76px] sm:min-w-0 shrink-0 items-center justify-center gap-1 py-2 px-2 text-xs font-semibold whitespace-nowrap rounded-[8px] transition ${
                        isSel
                          ? "bg-[#E8B8C2] text-white shadow-sm"
                          : "text-[#5A6670]/70 hover:bg-white hover:text-[#5A6670]"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="whitespace-nowrap shrink-0">{cat?.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#5A6670]">
                    标题 / 笔记主题 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={formCategory === "route" ? "例如：青海湖+茶卡盐湖3天2晚大环线" : "例如：兰州正宁路夜市爆吃攻略"}
                    className="w-full rounded-[10px] border border-[#D8DDD8] bg-[#FAFBF7] px-4 py-2.5 text-sm text-[#5A6670] outline-none transition focus:border-[#E8B8C2] focus:bg-white"
                  />
                </div>

                {/* Location: City & Custom Spot */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#5A6670]">关联城市</label>
                    <CitySearchSelect
                      value={formCityId}
                      onChange={setFormCityId}
                      placeholder="搜索并选择城市..."
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#5A6670]">具体打卡地点 / 景点名</label>
                    <input
                      type="text"
                      value={formCustomLocation}
                      onChange={(e) => setFormCustomLocation(e.target.value)}
                      placeholder="例如：甘加秘境、莫高窟、鸣沙山..."
                      className="w-full rounded-[10px] border border-[#D8DDD8] bg-[#FAFBF7] px-4 py-2 text-sm text-[#5A6670] outline-none transition focus:border-[#E8B8C2] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Images Upload Section */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-bold text-[#5A6670]">
                      实景图片 / 灵感图集 ({formImages.length}/9)
                    </label>
                    <span className="text-[11px] text-[#5A6670]/50">支持本地多图上传，无需配置OSS即可正常展示</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {formImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="group relative aspect-[4/3] overflow-hidden rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7]"
                      >
                        <LocalPrivacyImg src={img} alt="upload" className="h-full w-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute left-1 top-1 rounded bg-[#E8B8C2] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                            封面
                          </span>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => setCoverImage(idx)}
                              className="rounded bg-white/80 p-1 text-[10px] font-semibold text-[#5A6670] hover:bg-white"
                              title="设为封面"
                            >
                              设封面
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFormImage(idx)}
                            className="rounded bg-red-500/80 p-1 text-[10px] font-semibold text-white hover:bg-red-500"
                            title="删除"
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
                        className="flex aspect-[4/3] flex-col items-center justify-center rounded-[8px] border-2 border-dashed border-[#D8DDD8] bg-[#FAFBF7] text-[#5A6670]/50 transition hover:border-[#E8B8C2] hover:text-[#E8B8C2]"
                      >
                        <ImagePlus className="h-5 w-5" />
                        <span className="mt-1 text-[11px] font-medium">
                          {isUploading ? "压缩中..." : "上传照片"}
                        </span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.heic,.heif,.HEIC,.HEIF"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>

                {/* Route Planner Specific Fields (旅行路线规划专属) */}
                {formCategory === "route" && (
                  <div className="rounded-[14px] border border-[#A8C8DC]/60 bg-[#D6E8F0]/15 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <RouteIcon className="h-4 w-4 text-[#A8C8DC]" />
                        <h4 className="text-xs sm:text-sm font-bold text-[#5A6670]">旅行路线行程规划站点</h4>
                      </div>
                      <button
                        type="button"
                        onClick={addRouteStep}
                        className="flex items-center gap-1 rounded-full bg-[#A8C8DC] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#8AB6CE]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        增加途经站点
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {formRouteSteps.map((step, idx) => (
                        <div
                          key={step.id}
                          className="flex items-start gap-2 rounded-[8px] border border-[#D8DDD8]/70 bg-white p-2.5 shadow-sm"
                        >
                          <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#A8C8DC] text-[10px] font-bold text-white">
                            {idx + 1}
                          </span>
                          <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={step.title}
                              onChange={(e) => updateRouteStep(idx, { title: e.target.value })}
                              placeholder={`例如：第 ${idx + 1} 站 / 鸣沙山`}
                              className="rounded-[6px] border border-[#D8DDD8] px-2.5 py-1 text-xs outline-none focus:border-[#A8C8DC]"
                            />
                            <input
                              type="text"
                              value={step.location || ""}
                              onChange={(e) => updateRouteStep(idx, { location: e.target.value })}
                              placeholder="地点名称（如：敦煌莫高窟）"
                              className="rounded-[6px] border border-[#D8DDD8] px-2.5 py-1 text-xs outline-none focus:border-[#A8C8DC]"
                            />
                            <div className="sm:col-span-2">
                              <input
                                type="text"
                                value={step.description || ""}
                                onChange={(e) => updateRouteStep(idx, { description: e.target.value })}
                                placeholder="游玩亮点、拍照机位或美食建议..."
                                className="w-full rounded-[6px] border border-[#D8DDD8] px-2.5 py-1 text-xs outline-none focus:border-[#A8C8DC]"
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => moveRouteStep(idx, "up")}
                              disabled={idx === 0}
                              className="text-[10px] text-[#5A6670]/40 hover:text-[#5A6670] disabled:opacity-20"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => moveRouteStep(idx, "down")}
                              disabled={idx === formRouteSteps.length - 1}
                              className="text-[10px] text-[#5A6670]/40 hover:text-[#5A6670] disabled:opacity-20"
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRouteStep(idx)}
                              className="text-[#E8B8C2] hover:text-red-500"
                              title="删除此站"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {formRouteSteps.length === 0 && (
                        <p className="text-center text-xs text-[#5A6670]/40 py-3">
                          点击上方按钮，添加路线中的第一站、第二站行程吧
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Duration, Budget, Season, Status (全部使用下拉框选择 + 自定义切换) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* 预计耗时 下拉框 */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-bold text-[#5A6670]">预计耗时</label>
                      <button
                        type="button"
                        onClick={() => setCustomDurationMode((prev) => !prev)}
                        className="text-[10px] text-[#A8C8DC] hover:underline"
                      >
                        {customDurationMode ? "预设" : "自定义"}
                      </button>
                    </div>
                    {customDurationMode ? (
                      <input
                        type="text"
                        value={formRouteDuration}
                        onChange={(e) => setFormRouteDuration(e.target.value)}
                        placeholder="如：3天2晚"
                        className="w-full rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] px-2.5 py-1.5 text-xs outline-none focus:border-[#E8B8C2]"
                      />
                    ) : (
                      <div className="relative">
                        <select
                          value={formRouteDuration}
                          onChange={(e) => {
                            if (e.target.value === "__custom__") {
                              setCustomDurationMode(true);
                            } else {
                              setFormRouteDuration(e.target.value);
                            }
                          }}
                          className="w-full appearance-none rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] pl-2.5 pr-6 py-2 text-xs text-[#5A6670] outline-none transition focus:border-[#E8B8C2] focus:bg-white cursor-pointer"
                        >
                          <option value="">未指定</option>
                          {DURATION_PRESETS.map((dur) => (
                            <option key={dur} value={dur}>{dur}</option>
                          ))}
                          {formRouteDuration && !DURATION_PRESETS.includes(formRouteDuration) && (
                            <option value={formRouteDuration}>{formRouteDuration} (自定义)</option>
                          )}
                          <option value="__custom__">✏️ 自定义输入...</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5A6670]/50" />
                      </div>
                    )}
                  </div>

                  {/* 预算预估 下拉框 */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-bold text-[#5A6670]">预算预估</label>
                      <button
                        type="button"
                        onClick={() => setCustomBudgetMode((prev) => !prev)}
                        className="text-[10px] text-[#A8C8DC] hover:underline"
                      >
                        {customBudgetMode ? "预设" : "自定义"}
                      </button>
                    </div>
                    {customBudgetMode ? (
                      <input
                        type="text"
                        value={formBudget}
                        onChange={(e) => setFormBudget(e.target.value)}
                        placeholder="如：人均¥1500"
                        className="w-full rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] px-2.5 py-1.5 text-xs outline-none focus:border-[#E8B8C2]"
                      />
                    ) : (
                      <div className="relative">
                        <select
                          value={formBudget}
                          onChange={(e) => {
                            if (e.target.value === "__custom__") {
                              setCustomBudgetMode(true);
                            } else {
                              setFormBudget(e.target.value);
                            }
                          }}
                          className="w-full appearance-none rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] pl-2.5 pr-6 py-2 text-xs text-[#5A6670] outline-none transition focus:border-[#E8B8C2] focus:bg-white cursor-pointer"
                        >
                          <option value="">未设定</option>
                          {BUDGET_PRESETS.map((bud) => (
                            <option key={bud} value={bud}>{bud}</option>
                          ))}
                          {formBudget && !BUDGET_PRESETS.includes(formBudget) && (
                            <option value={formBudget}>{formBudget} (自定义)</option>
                          )}
                          <option value="__custom__">✏️ 自定义输入...</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5A6670]/50" />
                      </div>
                    )}
                  </div>

                  {/* 推荐出行季节 下拉框 */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-bold text-[#5A6670]">推荐出行季节</label>
                      <button
                        type="button"
                        onClick={() => setCustomSeasonMode((prev) => !prev)}
                        className="text-[10px] text-[#A8C8DC] hover:underline"
                      >
                        {customSeasonMode ? "预设" : "自定义"}
                      </button>
                    </div>
                    {customSeasonMode ? (
                      <input
                        type="text"
                        value={formBestSeason}
                        onChange={(e) => setFormBestSeason(e.target.value)}
                        placeholder="如：秋季10月"
                        className="w-full rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] px-2.5 py-1.5 text-xs outline-none focus:border-[#E8B8C2]"
                      />
                    ) : (
                      <div className="relative">
                        <select
                          value={formBestSeason}
                          onChange={(e) => {
                            if (e.target.value === "__custom__") {
                              setCustomSeasonMode(true);
                            } else {
                              setFormBestSeason(e.target.value);
                            }
                          }}
                          className="w-full appearance-none rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] pl-2.5 pr-6 py-2 text-xs text-[#5A6670] outline-none transition focus:border-[#E8B8C2] focus:bg-white cursor-pointer"
                        >
                          <option value="">四季皆宜</option>
                          {SEASON_PRESETS.map((sea) => (
                            <option key={sea} value={sea}>{sea}</option>
                          ))}
                          {formBestSeason && !SEASON_PRESETS.includes(formBestSeason) && (
                            <option value={formBestSeason}>{formBestSeason} (自定义)</option>
                          )}
                          <option value="__custom__">✏️ 自定义输入...</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5A6670]/50" />
                      </div>
                    )}
                  </div>

                  {/* 心愿状态 下拉框 */}
                  <div>
                    <div className="mb-1">
                      <label className="text-xs font-bold text-[#5A6670]">心愿状态</label>
                    </div>
                    <div className="relative">
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as FavoriteStatus)}
                        className="w-full appearance-none rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] pl-2.5 pr-6 py-2 text-xs text-[#5A6670] outline-none transition focus:border-[#E8B8C2] focus:bg-white cursor-pointer"
                      >
                        <option value="wish">🌱 心愿种草</option>
                        <option value="planned">✈️ 已入计划</option>
                        <option value="visited">🎉 已经去过</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5A6670]/50" />
                    </div>
                  </div>
                </div>

                {/* Detailed Note Content */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#5A6670]">
                    种草理由 / 详细攻略心得
                  </label>
                  <textarea
                    rows={4}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="写下心动的原因、小红书上的必打卡机位、避坑指南、美食推荐等..."
                    className="w-full rounded-[10px] border border-[#D8DDD8] bg-[#FAFBF7] p-3 text-xs sm:text-sm leading-relaxed text-[#5A6670] outline-none transition focus:border-[#E8B8C2] focus:bg-white"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#5A6670]">特色标签</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {PRESET_TAGS.map((tag) => {
                      const isSelected = formTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => togglePresetTag(tag)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                            isSelected
                              ? "bg-[#E8B8C2] text-white shadow-xs"
                              : "bg-[#FAFBF7] text-[#5A6670]/60 border border-[#D8DDD8]/60 hover:border-[#E8B8C2]"
                          }`}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomTag();
                        }
                      }}
                      placeholder="输入自定义标签后按回车..."
                      className="flex-1 rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] px-3 py-1.5 text-xs text-[#5A6670] outline-none focus:border-[#E8B8C2]"
                    />
                    <button
                      type="button"
                      onClick={addCustomTag}
                      className="rounded-[8px] border border-[#D8DDD8] px-3 py-1.5 text-xs font-semibold text-[#5A6670] hover:bg-[#FAFBF7]"
                    >
                      添加标签
                    </button>
                  </div>
                </div>

                {/* External link */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                    外部灵感链接 (可选)
                  </label>
                  <input
                    type="url"
                    value={formExternalLink}
                    onChange={(e) => setFormExternalLink(e.target.value)}
                    placeholder="例如：小红书笔记链接、携程、大众点评页面等"
                    className="w-full rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] px-3 py-1.5 text-xs outline-none focus:border-[#E8B8C2]"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#D8DDD8]/50 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-[8px] px-4 py-2 text-xs sm:text-sm font-semibold text-[#5A6670]/60 transition hover:bg-[#FAFBF7]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveForm}
                  className="rounded-[8px] bg-[#E8B8C2] px-6 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-[#D6A6B0] active:scale-95"
                >
                  {editingId ? "保存修改" : "确认发布种草"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MemoryPageShell>
  );
}
