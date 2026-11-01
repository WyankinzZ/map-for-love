"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Archive,
  Heart,
  Sparkles,
  Lock,
  Unlock,
  Mail,
  Camera,
  Music,
  MapPin,
  Calendar,
  Gift,
  Plus,
  X,
  ImagePlus,
  Pencil,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Dices,
  MessageSquare,
  Maximize2,
  Tag,
  Quote,
  Eye,
  Clock,
  Sparkle,
  KeyRound,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cities } from "@/data/cities";
import { MemoryPageShell } from "@/components/MemoryNav";
import { useAdminMode } from "@/hooks/useAdminMode";
import { CitySearchSelect } from "@/components/shared/CitySearchSelect";
import { Lightbox } from "@/components/shared/Lightbox";
import { LocalPrivacyImg } from "@/components/LocalPrivacyImage";
import { readCompressedImageDataUrl, readFileAsDataUrl } from "@/utils/imageUtils";
import { readJson, writeJson } from "@/lib/client/storage";
import { scrollToPageTop } from "@/lib/client/scroll";
import { DateDropdownSelect } from "@/components/shared/DateDropdownSelect";

export type CapsuleTheme = "letter" | "polaroid" | "keepsake" | "secret" | "music" | "milestone";

export interface TimeCapsuleRecord {
  id: string;
  title: string;
  date?: string;          // 记录日期 (YYYY.MM.DD)
  note: string;           // 正文回忆 / 信件内容
  cityId?: string;        // 关联城市 (可选)
  customLocation?: string;// 自定义地点 (可选)

  // 📸 图片画廊
  images: string[];
  coverImage?: string;

  // 🏷️ 宝盒主题
  theme: CapsuleTheme;

  // 🔒 浪漫时光封存
  isSealed: boolean;
  unlockDate?: string;    // 约定开启日期 (YYYY.MM.DD)
  sealDate?: string;      // 封存日期
  unlockHint?: string;    // 封存信封留言 (如: "约定结婚那天才能拆开")
  isOpenedEarly?: boolean;// 是否已提前解封

  // 🌟 心情与天气
  mood?: string;          // e.g. "🥰 怦然心动"
  weather?: string;       // e.g. "☀️ 阳光正好"
  tags: string[];         // 回忆标签

  // 🎵 专属BGM (可选歌曲名与歌手)
  songTitle?: string;
  songArtist?: string;

  // ❤️ 珍藏与喜欢
  liked?: boolean;
  likeCount?: number;
}

const STORAGE_KEY = "mapofus:capsules";

export const CAPSULE_THEMES = [
  { id: "all", label: "全部宝盒", icon: Archive, color: "#E8B8C2" },
  { id: "letter", label: "未来信笺", icon: Mail, color: "#E8B8C2" },
  { id: "polaroid", label: "拍立得瞬间", icon: Camera, color: "#A8C8DC" },
  { id: "keepsake", label: "珍藏信物", icon: Gift, color: "#F2A97F" },
  { id: "secret", label: "私密悄悄话", icon: MessageSquare, color: "#9BBDA8" },
  { id: "music", label: "回忆旋律", icon: Music, color: "#D4A5C6" },
  { id: "sealed", label: "封存中", icon: Lock, color: "#D98A98" },
] as const;

export const MOOD_PRESETS = [
  "🥰 怦然心动",
  "✨ 闪闪发光",
  "🥺 幸福感动",
  "🌸 温柔甜蜜",
  "🌙 深夜思念",
  "✈️ 奔向彼此",
  "🥳 欢庆时刻",
  "☕ 平淡相守",
];

export const WEATHER_PRESETS = [
  "☀️ 阳光正好",
  "⛅ 浪漫多云",
  "🌧️ 细雨蒙蒙",
  "❄️ 初雪纷飞",
  "🌙 月色温柔",
  "🌈 雨后彩虹",
  "🍃 微风拂面",
];

export const PRESET_TAGS = [
  "第一次",
  "写给未来",
  "双向奔赴",
  "私密誓言",
  "旅行记忆",
  "纪念信物",
  "甜甜日常",
  "不可忘却",
];

// Helper: Calculate days between two date strings (YYYY.MM.DD)
function calculateDaysDiff(targetDateStr: string, fromDate = new Date()): number {
  if (!targetDateStr) return 0;
  const parts = targetDateStr.split(/[./-]/).map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return 0;
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const diffTime = target.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Helper: Days preserved since creation
function calculateDaysPreserved(dateStr?: string): number {
  if (!dateStr) return 1;
  const diff = calculateDaysDiff(dateStr);
  return Math.max(1, -diff + 1);
}

// Normalizer for backward compatibility
function normalizeCapsule(raw: any): TimeCapsuleRecord {
  return {
    id: raw.id || `capsule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: raw.title || "未命名回忆",
    date: raw.date || new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "."),
    note: raw.note || raw.content || "",
    cityId: raw.cityId,
    customLocation: raw.customLocation || "",
    images: Array.isArray(raw.images) ? raw.images : (raw.image ? [raw.image] : []),
    coverImage: raw.coverImage || raw.images?.[0] || "",
    theme: raw.theme || "polaroid",
    isSealed: Boolean(raw.isSealed),
    unlockDate: raw.unlockDate || "",
    sealDate: raw.sealDate || raw.date || "",
    unlockHint: raw.unlockHint || "",
    isOpenedEarly: Boolean(raw.isOpenedEarly),
    mood: raw.mood || "🥰 怦然心动",
    weather: raw.weather || "☀️ 阳光正好",
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    songTitle: raw.songTitle || "",
    songArtist: raw.songArtist || "",
    liked: Boolean(raw.liked),
    likeCount: typeof raw.likeCount === "number" ? raw.likeCount : 1,
  };
}

export default function TimeCapsulePage() {
  const isAdmin = useAdminMode();
  const [items, setItems] = useState<TimeCapsuleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Detail Modal
  const [activeCapsule, setActiveCapsule] = useState<TimeCapsuleRecord | null>(null);
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Random Blind Box Modal
  const [blindBoxModalOpen, setBlindBoxModalOpen] = useState(false);
  const [blindBoxCapsule, setBlindBoxCapsule] = useState<TimeCapsuleRecord | null>(null);
  const [isOpeningBlindBox, setIsOpeningBlindBox] = useState(false);

  // Create / Edit Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formCityId, setFormCityId] = useState("");
  const [formCustomLocation, setFormCustomLocation] = useState("");
  const [formTheme, setFormTheme] = useState<CapsuleTheme>("polaroid");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formMood, setFormMood] = useState("🥰 怦然心动");
  const [formWeather, setFormWeather] = useState("☀️ 阳光正好");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [formSongTitle, setFormSongTitle] = useState("");
  const [formSongArtist, setFormSongArtist] = useState("");
  
  // Sealing Form State
  const [formIsSealed, setFormIsSealed] = useState(false);
  const [formUnlockDate, setFormUnlockDate] = useState("");
  const [formUnlockHint, setFormUnlockHint] = useState("");

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
    let localData: TimeCapsuleRecord[] = [];
    if (typeof window !== "undefined") {
      try {
        const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
        if (Array.isArray(raw)) {
          localData = raw.map(normalizeCapsule);
          setItems(localData);
        }
      } catch (err) {
        console.error("Failed to parse local capsules", err);
      }
    }

    readJson<any[]>("capsules", localData)
      .then((remoteData) => {
        if (Array.isArray(remoteData) && remoteData.length > 0) {
          const normalized = remoteData.map(normalizeCapsule);
          setItems(normalized);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          }
        }
      })
      .catch((err) => console.warn("Remote capsules sync note:", err))
      .finally(() => setIsLoading(false));
  }, []);

  // Persist items
  const persistItems = useCallback((next: TimeCapsuleRecord[]) => {
    setItems(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    writeJson("capsules", next).catch((err) => {
      console.warn("Server persist failed, local data is safe:", err);
    });
  }, []);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory === "sealed") {
        if (!item.isSealed) return false;
      } else if (selectedCategory !== "all" && item.theme !== selectedCategory) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const city = cities.find((c) => c.id === item.cityId);
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchNote = item.note.toLowerCase().includes(q);
        const matchCity = city?.name.toLowerCase().includes(q);
        const matchLoc = item.customLocation?.toLowerCase().includes(q);
        const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
        const matchSong = item.songTitle?.toLowerCase().includes(q) || item.songArtist?.toLowerCase().includes(q);
        const matchHint = item.unlockHint?.toLowerCase().includes(q);
        if (!matchTitle && !matchNote && !matchCity && !matchLoc && !matchTags && !matchSong && !matchHint) {
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
    if (activeCapsule && activeCapsule.id === id) {
      setActiveCapsule((prev) =>
        prev ? { ...prev, liked: !prev.liked, likeCount: (prev.likeCount ?? 0) + (!prev.liked ? 1 : -1) } : null,
      );
    }
  };

  // Open sealed early (Admin or user action)
  const unlockEarly = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("确定要提前拆开这封封存的时光信笺吗？拆开后回忆将即刻呈现。")) return;
    const next = items.map((item) => {
      if (item.id === id) {
        return { ...item, isOpenedEarly: true };
      }
      return item;
    });
    persistItems(next);
    if (activeCapsule && activeCapsule.id === id) {
      setActiveCapsule((prev) => (prev ? { ...prev, isOpenedEarly: true } : null));
    }
  };

  // Delete
  const removeItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    if (!window.confirm("确定要删除这个时光宝盒吗？记忆将从时光轴中移除。")) return;
    const next = items.filter((item) => item.id !== id);
    persistItems(next);
    if (activeCapsule?.id === id) setActiveCapsule(null);
  };

  // Open Create Form
  const openCreateForm = (themePreset?: CapsuleTheme) => {
    if (!isAdmin) return;
    setEditingId(null);
    setFormTitle("");
    const todayStr = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, ".");
    setFormDate(todayStr);
    setFormNote("");
    setFormCityId("");
    setFormCustomLocation("");
    setFormTheme(themePreset || "polaroid");
    setFormImages([]);
    setFormMood("🥰 怦然心动");
    setFormWeather("☀️ 阳光正好");
    setFormTags([]);
    setCustomTagInput("");
    setFormSongTitle("");
    setFormSongArtist("");
    setFormIsSealed(false);
    // default unlock date 1 year later
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setFormUnlockDate(nextYear.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "."));
    setFormUnlockHint("");
    setIsFormOpen(true);
  };

  // Open Edit Form
  const openEditForm = (item: TimeCapsuleRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormDate(item.date || "");
    setFormNote(item.note);
    setFormCityId(item.cityId || "");
    setFormCustomLocation(item.customLocation || "");
    setFormTheme(item.theme || "polaroid");
    setFormImages(item.images || []);
    setFormMood(item.mood || "🥰 怦然心动");
    setFormWeather(item.weather || "☀️ 阳光正好");
    setFormTags(item.tags || []);
    setCustomTagInput("");
    setFormSongTitle(item.songTitle || "");
    setFormSongArtist(item.songArtist || "");
    setFormIsSealed(Boolean(item.isSealed));
    setFormUnlockDate(item.unlockDate || "");
    setFormUnlockHint(item.unlockHint || "");
    setIsFormOpen(true);
  };

  // Image Upload handler (Compressed locally, 100% offline support with graceful fallback)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);

    try {
      const results: string[] = [];
      for (const file of files) {
        try {
          const url = await readCompressedImageDataUrl(file, {
            maxDimension: 1440,
            quality: 0.82,
          });
          if (url) results.push(url);
        } catch (innerErr) {
          console.warn("Compressed image read failed, falling back to direct read:", innerErr);
          try {
            const raw = await readFileAsDataUrl(file);
            if (raw) results.push(raw);
          } catch {
            // skip completely unreadable file
          }
        }
      }

      if (results.length > 0) {
        setFormImages((prev) => [...prev, ...results].slice(0, 9));
      } else {
        alert("未能读取所选图片，请换一张试试");
      }
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

  // Tag helper
  const togglePresetTag = (tag: string) => {
    setFormTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const addCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    if (!formTags.includes(trimmed)) {
      setFormTags((prev) => [...prev, trimmed]);
    }
    setCustomTagInput("");
  };

  // Save Form
  const handleSaveForm = () => {
    if (!formTitle.trim()) {
      alert("请填写时光宝盒标题");
      return;
    }

    const todayStr = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, ".");

    const newRecord: TimeCapsuleRecord = {
      id: editingId || `capsule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: formTitle.trim(),
      date: formDate.trim() || todayStr,
      note: formNote.trim(),
      cityId: formCityId || undefined,
      customLocation: formCustomLocation.trim(),
      images: formImages,
      coverImage: formImages[0] || "",
      theme: formTheme,
      isSealed: formIsSealed,
      unlockDate: formIsSealed ? formUnlockDate.trim() : undefined,
      sealDate: formIsSealed ? (editingId ? (items.find((i) => i.id === editingId)?.sealDate || todayStr) : todayStr) : undefined,
      unlockHint: formUnlockHint.trim(),
      isOpenedEarly: editingId ? (items.find((i) => i.id === editingId)?.isOpenedEarly ?? false) : false,
      mood: formMood,
      weather: formWeather,
      tags: formTags,
      songTitle: formSongTitle.trim(),
      songArtist: formSongArtist.trim(),
      liked: editingId ? (items.find((i) => i.id === editingId)?.liked ?? false) : false,
      likeCount: editingId ? (items.find((i) => i.id === editingId)?.likeCount ?? 1) : 1,
    };

    const next = editingId
      ? items.map((item) => (item.id === editingId ? newRecord : item))
      : [newRecord, ...items];

    persistItems(next);
    setIsFormOpen(false);
    if (activeCapsule && activeCapsule.id === editingId) {
      setActiveCapsule(newRecord);
    }
  };

  // 🎲 Surprise Blind Box Reveal
  const triggerBlindBox = () => {
    if (items.length === 0) {
      alert("时光宝盒里还没有回忆，先存入一个美好回忆吧！");
      return;
    }
    setIsOpeningBlindBox(true);
    setBlindBoxModalOpen(true);
    const randomIndex = Math.floor(Math.random() * items.length);
    const chosen = items[randomIndex];

    setTimeout(() => {
      setBlindBoxCapsule(chosen);
      setIsOpeningBlindBox(false);
    }, 700);
  };

  // Stats
  const stats = useMemo(() => {
    const total = items.length;
    const sealedCount = items.filter((i) => i.isSealed && !i.isOpenedEarly && calculateDaysDiff(i.unlockDate || "") > 0).length;
    const photoCount = items.reduce((sum, item) => sum + (item.images?.length || 0), 0);
    const oldestDays = items.reduce((max, item) => Math.max(max, calculateDaysPreserved(item.date)), 1);
    return { total, sealedCount, photoCount, oldestDays };
  }, [items]);

  return (
    <MemoryPageShell active="capsule">
      {/* Header section with vintage romantic capsule aesthetic */}
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full bg-[#F5DCE0]/80 text-[#E8B8C2] shadow-sm">
              <Archive className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight text-[#5A6670]">时光宝盒</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm font-medium text-[#5A6670]/60">
            存放写给未来的信笺、私密信物与浪漫拍立得，把不一定属于某座城市的小秘密温柔封存。
          </p>
        </div>

        {/* Action buttons & Blind Box */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Stats pill */}
          <div className="flex items-center gap-2 rounded-full border border-[#D8DDD8]/80 bg-[#FAFBF7]/80 px-3 py-1.5 text-xs font-semibold text-[#5A6670]/70 shadow-sm backdrop-blur">
            <span className="flex items-center gap-1">
              <Archive className="h-3.5 w-3.5 text-[#E8B8C2]" />
              <span>{stats.total} 个宝盒</span>
            </span>
            {stats.sealedCount > 0 && (
              <>
                <span className="text-[#D8DDD8]">|</span>
                <span className="flex items-center gap-1 text-[#D98A98]">
                  <Lock className="h-3 w-3" />
                  <span>{stats.sealedCount} 封存中</span>
                </span>
              </>
            )}
            {stats.photoCount > 0 && (
              <>
                <span className="text-[#D8DDD8] hidden sm:inline">|</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[#A8C8DC]">
                  <Camera className="h-3 w-3" />
                  <span>{stats.photoCount} 张照片</span>
                </span>
              </>
            )}
          </div>

          {/* 🎲 Surprise Blind Box Button */}
          <button
            type="button"
            onClick={triggerBlindBox}
            className="flex items-center gap-1.5 rounded-full border border-[#E8B8C2]/60 bg-gradient-to-r from-white via-[#FDF8F9] to-[#FAFBF7] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-[#E8B8C2] shadow-xs transition hover:scale-105 active:scale-95"
            title="随机开箱一个时光回忆"
          >
            <Dices className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#E8B8C2] animate-bounce" />
            <span>抽取盲盒</span>
          </button>

          {/* Admin Create Button */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => openCreateForm("polaroid")}
              className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-[#E8B8C2] px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_6px_16px_rgba(232,184,194,0.4)] transition hover:bg-[#D6A6B0] active:scale-95"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>放入宝盒</span>
            </button>
          )}
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="mb-5 sm:mb-8 space-y-2.5 sm:space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6670]/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索宝盒标题、回忆悄悄话、标签、歌名..."
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
          {CAPSULE_THEMES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            const count =
              cat.id === "all"
                ? items.length
                : cat.id === "sealed"
                ? items.filter((i) => i.isSealed).length
                : items.filter((i) => i.theme === cat.id).length;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
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

      {/* Grid of Time Capsule Cards */}
      {filteredItems.length > 0 ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-5">
            {paginatedItems.map((item) => {
              const city = cities.find((c) => c.id === item.cityId);
              const daysDiff = calculateDaysDiff(item.unlockDate || "");
              const isLocked = item.isSealed && !item.isOpenedEarly && daysDiff > 0;
              const daysPreserved = calculateDaysPreserved(item.date);
              const cover = item.images && item.images.length > 0 ? item.images[0] : item.coverImage;

              return (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => {
                    setActiveCapsule(item);
                    setDetailPhotoIndex(0);
                  }}
                  className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-[16px] border transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(90,102,112,0.12)] backdrop-blur ${
                    isLocked
                      ? "border-[#E8B8C2]/60 bg-gradient-to-br from-[#FFF9FA] via-[#FAFBF7] to-[#F5EBEF] shadow-sm"
                      : "border-[#D8DDD8]/80 bg-white/85 shadow-sm hover:border-[#E8B8C2]/60"
                  }`}
                >
                  {/* Card Header Stamp / Top Bar */}
                  {isLocked ? (
                    /* 🔒 Sealed Envelope Appearance */
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#F5DCE0]/50 via-[#FAFBF7] to-[#E8B8C2]/20 flex flex-col items-center justify-center p-6 text-center border-b border-[#E8B8C2]/30">
                      {/* Decorative Envelope Pattern */}
                      <div className="absolute inset-0 bg-[radial-gradient(#E8B8C2_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />

                      {/* Wax Seal Badge */}
                      <motion.div
                        whileHover={{ scale: 1.08, rotate: 5 }}
                        className="relative z-10 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-tr from-[#D98A98] to-[#E8B8C2] text-white shadow-[0_8px_20px_rgba(217,138,152,0.4)] border-2 border-white"
                      >
                        <Lock className="h-7 w-7" />
                        <span className="absolute -bottom-1 text-[8px] font-bold tracking-widest uppercase bg-white text-[#D98A98] px-1.5 py-0.2 rounded-full shadow-xs">
                          SEALED
                        </span>
                      </motion.div>

                      <div className="relative z-10 mt-3 space-y-1">
                        <span className="inline-block rounded-full bg-[#E8B8C2]/25 px-2.5 py-0.5 text-[11px] font-bold text-[#D98A98]">
                          ⏳ 还有 {daysDiff} 天开启
                        </span>
                        <p className="text-xs text-[#5A6670]/70 font-medium">
                          约定解封日：{item.unlockDate}
                        </p>
                      </div>

                      {/* Top badge */}
                      <div className="absolute left-2.5 top-2.5">
                        <span className="rounded-full bg-[#E8B8C2]/80 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          💌 封存胶囊
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* 📸 Unlocked Card / Polaroid Preview */
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#F5DCE0]/35 via-[#D6E8F0]/30 to-[#FAFBF7]">
                      {cover ? (
                        <LocalPrivacyImg
                          src={cover}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#FAFBF7]/90 text-[#E8B8C2] shadow-inner">
                            {item.theme === "letter" ? (
                              <Mail className="h-6 w-6" />
                            ) : item.theme === "keepsake" ? (
                              <Gift className="h-6 w-6" />
                            ) : item.theme === "music" ? (
                              <Music className="h-6 w-6" />
                            ) : (
                              <Archive className="h-6 w-6" />
                            )}
                          </span>
                          <p className="mt-2 text-xs font-semibold text-[#5A6670]/70">
                            {item.title}
                          </p>
                          <span className="mt-1 text-[10px] text-[#5A6670]/40">点开查看珍藏信物回忆</span>
                        </div>
                      )}

                      {/* Gradient shadow for text readibility */}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 via-black/15 to-transparent pointer-events-none" />

                      {/* Top-left Badges */}
                      <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                        <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                          {item.theme === "letter"
                            ? "💌 信笺"
                            : item.theme === "keepsake"
                            ? "🎁 信物"
                            : item.theme === "secret"
                            ? "🤫 悄悄话"
                            : item.theme === "music"
                            ? "🎵 旋律"
                            : "📸 拍立得"}
                        </span>
                        {item.isOpenedEarly && (
                          <span className="rounded-full bg-[#E8B8C2]/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                            提前拆封
                          </span>
                        )}
                      </div>

                      {/* Top-right Photo count badge */}
                      {item.images && item.images.length > 1 && (
                        <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                          <Camera className="h-3 w-3" />
                          {item.images.length}
                        </span>
                      )}

                      {/* Bottom overlay for Mood & Weather */}
                      <div className="absolute inset-x-2.5 bottom-2 flex items-center justify-between text-[11px] font-semibold text-white drop-shadow-md">
                        <span>{item.mood || "🥰 怦然心动"}</span>
                        <span>{item.weather || "☀️ 阳光正好"}</span>
                      </div>
                    </div>
                  )}

                  {/* Card Content Body */}
                  <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                    {/* Title */}
                    <h3 className="line-clamp-2 text-sm sm:text-base font-semibold leading-snug text-[#5A6670] group-hover:text-[#E8B8C2] transition-colors">
                      {item.title}
                    </h3>

                    {/* Location & Days Preserved */}
                    <div className="mt-2 flex items-center justify-between text-xs text-[#5A6670]/60">
                      <div className="flex items-center gap-1 text-[#A8C8DC] truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {city?.name ? `${city.name}` : ""}
                          {item.customLocation ? (city?.name ? ` · ${item.customLocation}` : item.customLocation) : ""}
                          {!city?.name && !item.customLocation && "时光秘密基地"}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#E8B8C2] shrink-0 font-medium">
                        沉淀 {daysPreserved} 天
                      </span>
                    </div>

                    {/* Note snippet or Lock hint */}
                    <div className="mt-2">
                      {isLocked ? (
                        <p className="line-clamp-2 text-xs italic text-[#D98A98]/80 bg-[#F5DCE0]/30 p-2 rounded-[8px]">
                          💌 “{item.unlockHint || "封存中，留给未来的我们..."}”
                        </p>
                      ) : (
                        item.note && (
                          <p className="line-clamp-2 text-xs leading-relaxed text-[#5A6670]/70">
                            {item.note}
                          </p>
                        )
                      )}
                    </div>

                    {/* Music BGM snippet if present */}
                    {item.songTitle && !isLocked && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-full bg-[#FAFBF7] px-2.5 py-1 text-[11px] text-[#5A6670]/75 border border-[#D8DDD8]/50">
                        <Music className="h-3 w-3 text-[#D4A5C6] animate-spin" style={{ animationDuration: "6s" }} />
                        <span className="truncate font-medium">{item.songTitle}</span>
                        {item.songArtist && <span className="text-[#5A6670]/40 truncate">· {item.songArtist}</span>}
                      </div>
                    )}

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && !isLocked && (
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

                    {/* Card Footer */}
                    <div className="mt-auto flex items-center justify-between border-t border-[#D8DDD8]/40 pt-3">
                      <span className="text-[11px] text-[#5A6670]/40">
                        {item.date || "时光初见"}
                      </span>

                      <div className="flex items-center gap-2.5">
                        {/* Like button */}
                        <button
                          type="button"
                          onClick={(e) => toggleLike(item.id, e)}
                          className={`flex items-center gap-1 text-xs font-semibold transition active:scale-125 ${
                            item.liked ? "text-[#E8B8C2]" : "text-[#5A6670]/40 hover:text-[#E8B8C2]"
                          }`}
                          title="标记喜欢"
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
                共 {filteredItems.length} 个时光宝盒 · 第 {safeCurrentPage} / {totalPages} 页
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
            <Archive className="h-8 w-8" />
          </span>
          <h3 className="mt-4 text-base sm:text-lg font-semibold text-[#5A6670]">暂无符合条件的时光宝盒</h3>
          <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-[#5A6670]/60">
            {searchQuery || selectedCategory !== "all"
              ? "试着切换分类标签或清空搜索关键词吧。"
              : "把属于你们的私密信物、未来信件与浪漫照片存入时光宝盒，留给岁月慢慢沉淀。"}
          </p>
          {isAdmin && (
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => openCreateForm("polaroid")}
                className="flex items-center gap-1.5 rounded-full bg-[#E8B8C2] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-[#D6A6B0]"
              >
                <Plus className="h-4 w-4" />
                放入第一个宝盒
              </button>
            </div>
          )}
        </div>
      )}

      {/* 💌 Detail Modal (沉浸式时光宝盒详情) */}
      <AnimatePresence>
        {activeCapsule && (
          <div
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-sm"
            onClick={() => setActiveCapsule(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative flex flex-col md:flex-row h-[90vh] max-h-[760px] w-full max-w-4xl overflow-hidden rounded-[20px] bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setActiveCapsule(null)}
                className="absolute right-3.5 top-3.5 z-30 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-[#5A6670] shadow-md backdrop-blur transition hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Modal Left/Top: Gallery or Sealed Envelope */}
              {activeCapsule.isSealed &&
              !activeCapsule.isOpenedEarly &&
              calculateDaysDiff(activeCapsule.unlockDate || "") > 0 ? (
                /* Sealed Envelope Display */
                <div className="relative md:w-1/2 h-64 md:h-full bg-gradient-to-br from-[#F5DCE0] via-[#FAFBF7] to-[#E8B8C2]/40 p-8 flex flex-col items-center justify-center text-center">
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-tr from-[#D98A98] to-[#E8B8C2] text-white shadow-2xl border-4 border-white"
                  >
                    <Lock className="h-10 w-10" />
                  </motion.div>

                  <h3 className="mt-5 text-xl font-bold text-[#5A6670]">
                    这是一封封存的时光信笺
                  </h3>
                  <p className="mt-2 text-xs text-[#5A6670]/70 max-w-xs leading-relaxed">
                    封存于 {activeCapsule.sealDate || activeCapsule.date}，约定在{" "}
                    <span className="font-bold text-[#D98A98]">{activeCapsule.unlockDate}</span> 解锁。
                  </p>

                  <div className="mt-4 rounded-xl bg-white/70 p-3.5 text-xs text-[#5A6670]/80 shadow-xs border border-white/60 max-w-xs">
                    <p className="font-semibold text-[#D98A98]">💌 封存寄语：</p>
                    <p className="mt-1 italic">
                      “{activeCapsule.unlockHint || "愿我们在未来的这一天，依旧深爱彼此。"}”
                    </p>
                  </div>

                  <div className="mt-6 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => unlockEarly(activeCapsule.id, e)}
                      className="flex items-center gap-1.5 rounded-full border border-[#E8B8C2] bg-white/90 px-4 py-2 text-xs font-semibold text-[#E8B8C2] shadow-xs transition hover:bg-[#E8B8C2] hover:text-white"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>心急想看？提前拆开信封</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Unlocked Gallery View (Warm framed photo with ambient backdrop, no dark black bars) */
                <div className="relative md:w-1/2 h-64 md:h-full bg-gradient-to-b from-[#F9F5F6] via-[#F4ECEE] to-[#F1E8EC] flex flex-col overflow-hidden">
                  {activeCapsule.images && activeCapsule.images.length > 0 ? (
                    <>
                      {/* Ambient blurred backdrop of the current photo */}
                      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                        <LocalPrivacyImg
                          src={activeCapsule.images[detailPhotoIndex] || activeCapsule.images[0]}
                          alt=""
                          className="h-full w-full object-cover blur-2xl scale-125 opacity-25"
                        />
                        <div className="absolute inset-0 bg-[#FAFBF7]/40 backdrop-blur-xs" />
                      </div>

                      {/* Centered Framed Photo */}
                      <div className="relative z-10 flex-1 w-full p-3 sm:p-5 flex items-center justify-center overflow-hidden">
                        <div className="relative max-h-full max-w-full rounded-[14px] border-[3px] border-white/95 bg-white p-1.5 shadow-[0_10px_28px_rgba(90,102,112,0.16)] flex items-center justify-center transition-transform duration-300">
                          <LocalPrivacyImg
                            src={activeCapsule.images[detailPhotoIndex] || activeCapsule.images[0]}
                            alt={activeCapsule.title}
                            className="max-h-[195px] md:max-h-[440px] w-auto max-w-full rounded-[10px] object-contain select-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setLightboxIndex(detailPhotoIndex);
                              setLightboxOpen(true);
                            }}
                            className="absolute right-3 bottom-3 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-md transition hover:bg-black/70 hover:scale-105 active:scale-95"
                            title="查看高清大图"
                          >
                            <Maximize2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Refined Thumbnail Bar */}
                      {activeCapsule.images.length > 1 && (
                        <div className="relative z-10 no-scrollbar flex gap-2 overflow-x-auto border-t border-[#D8DDD8]/60 bg-white/80 p-2 backdrop-blur-md">
                          {activeCapsule.images.map((img, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setDetailPhotoIndex(idx)}
                              className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-[8px] border-2 transition ${
                                detailPhotoIndex === idx
                                  ? "border-[#E8B8C2] scale-105 shadow-sm"
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
                      <Archive className="h-12 w-12 text-[#E8B8C2]/60" />
                      <p className="mt-2 text-sm font-medium">纯文字或信物回忆</p>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Right/Bottom: Full Details & Story */}
              <div className="flex flex-1 flex-col overflow-y-auto p-5 sm:p-7 md:w-1/2">
                {/* Meta Top: Category, Date, Location */}
                <div className="flex items-center justify-between border-b border-[#D8DDD8]/40 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#F5DCE0]/80 px-2.5 py-0.5 text-xs font-semibold text-[#E8B8C2]">
                      {activeCapsule.theme === "letter"
                        ? "💌 未来信笺"
                        : activeCapsule.theme === "keepsake"
                        ? "🎁 珍藏信物"
                        : activeCapsule.theme === "secret"
                        ? "🤫 私密悄悄话"
                        : activeCapsule.theme === "music"
                        ? "🎵 回忆旋律"
                        : "📸 拍立得瞬间"}
                    </span>
                    <span className="text-xs text-[#5A6670]/50">
                      {activeCapsule.date}
                    </span>
                  </div>

                  <span className="text-xs font-medium text-[#E8B8C2]">
                    ✨ 时光沉淀第 {calculateDaysPreserved(activeCapsule.date)} 天
                  </span>
                </div>

                {/* Title */}
                <h2 className="mt-4 text-xl sm:text-2xl font-bold leading-snug text-[#5A6670]">
                  {activeCapsule.title}
                </h2>

                {/* Location */}
                {(activeCapsule.cityId || activeCapsule.customLocation) && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#A8C8DC]">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {cities.find((c) => c.id === activeCapsule.cityId)?.name || ""}
                      {activeCapsule.customLocation
                        ? (activeCapsule.cityId ? ` · ${activeCapsule.customLocation}` : activeCapsule.customLocation)
                        : ""}
                    </span>
                  </div>
                )}

                {/* Mood & Weather Stamps */}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {activeCapsule.mood && (
                    <span className="rounded-full bg-[#FAFBF7] px-2.5 py-1 text-[#5A6670]/80 border border-[#D8DDD8]/70">
                      心情：{activeCapsule.mood}
                    </span>
                  )}
                  {activeCapsule.weather && (
                    <span className="rounded-full bg-[#FAFBF7] px-2.5 py-1 text-[#5A6670]/80 border border-[#D8DDD8]/70">
                      天气：{activeCapsule.weather}
                    </span>
                  )}
                </div>

                {/* Song player preview */}
                {activeCapsule.songTitle && (
                  <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#F5DCE0]/40 to-[#FAFBF7] p-3 border border-[#E8B8C2]/40">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#E8B8C2] text-white">
                      <Music className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#5A6670]">{activeCapsule.songTitle}</p>
                      {activeCapsule.songArtist && (
                        <p className="text-[10px] text-[#5A6670]/50">{activeCapsule.songArtist}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Note Content */}
                <div className="mt-5 flex-1">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#5A6670]/85 bg-[#FAFBF7]/60 p-4 rounded-xl border border-[#D8DDD8]/40">
                    {activeCapsule.note || "（这段时光，静待你来写下第一段文字...）"}
                  </p>
                </div>

                {/* Tags */}
                {activeCapsule.tags && activeCapsule.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {activeCapsule.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#FAFBF7] px-2.5 py-0.5 text-xs text-[#5A6670]/60 border border-[#D8DDD8]/60"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Bottom Actions */}
                <div className="mt-6 flex items-center justify-between border-t border-[#D8DDD8]/40 pt-4">
                  <button
                    type="button"
                    onClick={() => toggleLike(activeCapsule.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      activeCapsule.liked
                        ? "border-[#E8B8C2] bg-[#F5DCE0]/40 text-[#E8B8C2]"
                        : "border-[#D8DDD8] bg-white text-[#5A6670]/70 hover:border-[#E8B8C2]"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${activeCapsule.liked ? "fill-[#E8B8C2]" : ""}`} />
                    <span>{activeCapsule.liked ? "已珍藏" : "珍藏此信"}</span>
                    <span>({activeCapsule.likeCount ?? 0})</span>
                  </button>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          const target = activeCapsule;
                          setActiveCapsule(null);
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
                          const id = activeCapsule.id;
                          setActiveCapsule(null);
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

      {/* 🎲 Surprise Blind Box Opening Modal */}
      <AnimatePresence>
        {blindBoxModalOpen && (
          <div
            className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            onClick={() => setBlindBoxModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, rotate: -3 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative w-full max-w-md overflow-hidden rounded-[24px] bg-white p-6 text-center shadow-2xl border-4 border-[#FAFBF7]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setBlindBoxModalOpen(false)}
                className="absolute right-3.5 top-3.5 grid h-7 w-7 place-items-center rounded-full bg-black/10 text-[#5A6670] hover:bg-black/20"
              >
                <X className="h-4 w-4" />
              </button>

              {isOpeningBlindBox ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-4">
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.15, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-tr from-[#E8B8C2] to-[#F5DCE0] text-white shadow-xl"
                  >
                    <Archive className="h-10 w-10 animate-pulse" />
                  </motion.div>
                  <p className="text-sm font-bold text-[#5A6670] animate-bounce">
                    正在打开时光盲盒，回忆翻涌中...
                  </p>
                </div>
              ) : blindBoxCapsule ? (
                <div className="py-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F5DCE0] px-3 py-1 text-xs font-bold text-[#E8B8C2]">
                    <Sparkles className="h-3.5 w-3.5" />
                    今日翻开的时空信件
                  </span>

                  <h3 className="mt-4 text-xl font-bold text-[#5A6670]">
                    {blindBoxCapsule.title}
                  </h3>

                  <p className="mt-1 text-xs text-[#5A6670]/50">
                    记录于 {blindBoxCapsule.date} · 沉淀 {calculateDaysPreserved(blindBoxCapsule.date)} 天
                  </p>

                  {/* Cover or photo */}
                  <div className="mt-4 overflow-hidden rounded-xl bg-gray-100 aspect-video relative">
                    {blindBoxCapsule.images && blindBoxCapsule.images.length > 0 ? (
                      <LocalPrivacyImg
                        src={blindBoxCapsule.images[0]}
                        alt={blindBoxCapsule.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center p-4 bg-gradient-to-br from-[#F5DCE0]/40 to-[#FAFBF7]">
                        <Quote className="h-8 w-8 text-[#E8B8C2]/60" />
                        <p className="mt-2 text-xs font-medium text-[#5A6670]/70 line-clamp-2 px-4">
                          “{blindBoxCapsule.note || "一段美好的回忆正在封存..."}”
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="mt-4 text-xs leading-relaxed text-[#5A6670]/80 line-clamp-3 bg-[#FAFBF7] p-3 rounded-lg border border-[#D8DDD8]/50">
                    {blindBoxCapsule.note || "（点击下方按钮查看回忆详情）"}
                  </p>

                  <div className="mt-5 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setBlindBoxModalOpen(false);
                        setActiveCapsule(blindBoxCapsule);
                      }}
                      className="flex items-center gap-1.5 rounded-full bg-[#E8B8C2] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#D6A6B0]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>查看完整回忆</span>
                    </button>
                    <button
                      type="button"
                      onClick={triggerBlindBox}
                      className="flex items-center gap-1.5 rounded-full border border-[#D8DDD8] bg-white px-4 py-2 text-xs font-semibold text-[#5A6670] hover:border-[#E8B8C2]"
                    >
                      <Dices className="h-3.5 w-3.5 text-[#E8B8C2]" />
                      <span>再抽一个</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 📝 Create / Edit Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative flex flex-col w-full max-w-2xl max-h-[92dvh] sm:max-h-[88vh] rounded-[20px] bg-white shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="shrink-0 flex items-center justify-between border-b border-[#D8DDD8]/60 px-4 sm:px-6 py-3.5 bg-white">
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-[#E8B8C2]" />
                  <h2 className="text-base sm:text-lg font-bold text-[#5A6670]">
                    {editingId ? "编辑时光宝盒" : "放入新宝盒 / 投递时光回忆"}
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
              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 overscroll-contain">
                {/* Theme Selector */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#5A6670]">
                    宝盒主题类型
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {[
                      { id: "polaroid", label: "📸 拍立得", desc: "照片与瞬间" },
                      { id: "letter", label: "💌 未来信笺", desc: "写给未来的信" },
                      { id: "keepsake", label: "🎁 珍藏信物", desc: "票根/纪念物" },
                      { id: "secret", label: "🤫 悄悄话", desc: "专属小秘密" },
                      { id: "music", label: "🎵 回忆旋律", desc: "专属BGM" },
                    ].map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => setFormTheme(th.id as CapsuleTheme)}
                        className={`flex flex-col items-center justify-center rounded-[12px] p-2 text-center transition border ${
                          formTheme === th.id
                            ? "border-[#E8B8C2] bg-[#F5DCE0]/30 text-[#E8B8C2] shadow-xs"
                            : "border-[#D8DDD8]/70 bg-[#FAFBF7]/60 text-[#5A6670]/70 hover:border-[#E8B8C2]/50"
                        }`}
                      >
                        <span className="text-xs font-bold">{th.label}</span>
                        <span className="text-[10px] text-[#5A6670]/40 mt-0.5">{th.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                    标题 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="如：第一次看海捡的贝壳 / 给2027年我们的悄悄话..."
                    className="w-full rounded-[10px] border border-[#D8DDD8] px-3.5 py-2 text-xs sm:text-sm text-[#5A6670] outline-none transition focus:border-[#E8B8C2]"
                  />
                </div>

                {/* Date and Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#5A6670]">
                      记录日期 (年月日下拉选择)
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
                          label: "昨天",
                          getDate: () => {
                            const d = new Date();
                            d.setDate(d.getDate() - 1);
                            return d
                              .toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
                              .replace(/\//g, ".");
                          },
                        },
                      ]}
                      accent="pink"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#5A6670]">
                      关联城市 (可选)
                    </label>
                    <div className="pt-0.5">
                      <CitySearchSelect
                        value={formCityId}
                        onChange={(id) => setFormCityId(id)}
                        accent="pink"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                    自定义地点 / 场景 (可选)
                  </label>
                  <input
                    type="text"
                    value={formCustomLocation}
                    onChange={(e) => setFormCustomLocation(e.target.value)}
                    placeholder="如：街角那家猫咖、海边帐篷营地、书房桌角"
                    className="w-full rounded-[10px] border border-[#D8DDD8] px-3.5 py-2 text-xs text-[#5A6670] outline-none transition focus:border-[#E8B8C2]"
                  />
                </div>

                {/* Image Upload Gallery */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-bold text-[#5A6670]">
                      上传照片 / 信物拍立得 ({formImages.length}/9)
                    </label>
                    <span className="text-[10px] text-[#5A6670]/50">
                      支持离线高压缩，首张默认作为封面
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
                              title="设为封面"
                            >
                              设封面
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFormImage(idx)}
                            className="rounded bg-red-500/80 p-1 text-white hover:bg-red-500"
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
                        className="flex aspect-square flex-col items-center justify-center rounded-[10px] border border-dashed border-[#D8DDD8] bg-[#FAFBF7]/80 text-[#5A6670]/50 transition hover:border-[#E8B8C2] hover:text-[#E8B8C2]"
                      >
                        <ImagePlus className="h-5 w-5" />
                        <span className="mt-1 text-[10px] font-medium">
                          {isUploading ? "压缩中..." : "添加图片"}
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

                {/* Note / Content */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                    回忆正文 / 给未来的私密悄悄话
                  </label>
                  <textarea
                    rows={4}
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="写下关于这件信物的故事，或者写给未来某天打开这个盒子的我们..."
                    className="w-full rounded-[10px] border border-[#D8DDD8] p-3 text-xs sm:text-sm text-[#5A6670] outline-none transition focus:border-[#E8B8C2]"
                  />
                </div>

                {/* Mood and Weather Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                      心情印记
                    </label>
                    <select
                      value={formMood}
                      onChange={(e) => setFormMood(e.target.value)}
                      className="w-full rounded-[10px] border border-[#D8DDD8] px-3 py-2 text-xs text-[#5A6670] outline-none bg-white transition focus:border-[#E8B8C2]"
                    >
                      {MOOD_PRESETS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6670]">
                      天气盖章
                    </label>
                    <select
                      value={formWeather}
                      onChange={(e) => setFormWeather(e.target.value)}
                      className="w-full rounded-[10px] border border-[#D8DDD8] px-3 py-2 text-xs text-[#5A6670] outline-none bg-white transition focus:border-[#E8B8C2]"
                    >
                      {WEATHER_PRESETS.map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Song Info (Optional BGM) */}
                <div className="rounded-[12px] bg-[#FAFBF7] p-3 border border-[#D8DDD8]/60 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#5A6670]">
                    <Music className="h-3.5 w-3.5 text-[#D4A5C6]" />
                    <span>回忆专属旋律 (可选)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={formSongTitle}
                      onChange={(e) => setFormSongTitle(e.target.value)}
                      placeholder="歌曲名称 (如: 简单爱 / 晴天)"
                      className="rounded-[8px] border border-[#D8DDD8] bg-white px-3 py-1.5 text-xs text-[#5A6670] outline-none focus:border-[#E8B8C2]"
                    />
                    <input
                      type="text"
                      value={formSongArtist}
                      onChange={(e) => setFormSongArtist(e.target.value)}
                      placeholder="歌手 (如: 周杰伦)"
                      className="rounded-[8px] border border-[#D8DDD8] bg-white px-3 py-1.5 text-xs text-[#5A6670] outline-none focus:border-[#E8B8C2]"
                    />
                  </div>
                </div>

                {/* 🔒 Sealing to Future Toggle */}
                <div className="rounded-[14px] border border-[#E8B8C2]/40 bg-gradient-to-br from-[#FFF9FA] via-[#FAFBF7] to-[#F5DCE0]/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-[#D98A98]" />
                      <div>
                        <span className="text-xs font-bold text-[#5A6670]">封存至未来开启 (时光胶囊机制)</span>
                        <p className="text-[10px] text-[#5A6670]/50">
                          设定解封日期，未到期前将以浪漫火漆信封效果封存展示
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsSealed}
                        onChange={(e) => setFormIsSealed(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E8B8C2]" />
                    </label>
                  </div>

                  {formIsSealed && (
                    <div className="space-y-2.5 pt-2 border-t border-[#E8B8C2]/30">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-[#D98A98]">
                          约定开启日期 (年月日下拉选择)
                        </label>
                        <DateDropdownSelect
                          value={formUnlockDate}
                          onChange={(val) => setFormUnlockDate(val)}
                          presets={[
                            {
                              label: "+100天",
                              getDate: () => {
                                const d = new Date();
                                d.setDate(d.getDate() + 100);
                                return d
                                  .toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
                                  .replace(/\//g, ".");
                              },
                            },
                            {
                              label: "+1年",
                              getDate: () => {
                                const d = new Date();
                                d.setFullYear(d.getFullYear() + 1);
                                return d
                                  .toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
                                  .replace(/\//g, ".");
                              },
                            },
                            {
                              label: "下个520",
                              getDate: () => {
                                const now = new Date();
                                const y =
                                  now.getMonth() > 4 || (now.getMonth() === 4 && now.getDate() >= 20)
                                    ? now.getFullYear() + 1
                                    : now.getFullYear();
                                return `${y}.05.20`;
                              },
                            },
                          ]}
                          accent="pink"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#D98A98]">
                          封存提示寄语 (写在信封封面的话)
                        </label>
                        <input
                          type="text"
                          value={formUnlockHint}
                          onChange={(e) => setFormUnlockHint(e.target.value)}
                          placeholder="如：吵架的时候才能打开 / 结婚那天才许拆看 / 留给1000天后的我们"
                          className="w-full rounded-[8px] border border-[#E8B8C2]/60 bg-white px-3 py-1.5 text-xs text-[#5A6670] outline-none focus:border-[#E8B8C2]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#5A6670]">
                    回忆标签
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {PRESET_TAGS.map((tag) => {
                      const active = formTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => togglePresetTag(tag)}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                            active
                              ? "bg-[#E8B8C2] text-white"
                              : "border border-[#D8DDD8] bg-white text-[#5A6670]/70 hover:border-[#E8B8C2]"
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
                      placeholder="自定义标签，回车添加..."
                      className="flex-1 rounded-[8px] border border-[#D8DDD8] px-3 py-1.5 text-xs text-[#5A6670] outline-none focus:border-[#E8B8C2]"
                    />
                    <button
                      type="button"
                      onClick={addCustomTag}
                      className="rounded-[8px] border border-[#D8DDD8] bg-white px-3 py-1.5 text-xs font-semibold text-[#5A6670] hover:border-[#E8B8C2]"
                    >
                      添加
                    </button>
                  </div>
                </div>
              </div>

              {/* Form Footer */}
              <div className="shrink-0 flex items-center justify-end gap-3 border-t border-[#D8DDD8]/60 px-4 sm:px-6 py-3 bg-[#FAFBF7]">
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
                  className="rounded-full bg-[#E8B8C2] px-5 sm:px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#D6A6B0] active:scale-95"
                >
                  {editingId ? "保存修改" : "确认放入时光宝盒"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox for large photos */}
      {lightboxOpen && activeCapsule?.images && activeCapsule.images.length > 0 && (
        <Lightbox
          photos={activeCapsule.images.map((src) => ({ src, alt: activeCapsule.title }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </MemoryPageShell>
  );
}
