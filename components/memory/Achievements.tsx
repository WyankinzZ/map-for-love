"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  BookOpen,
  Camera,
  Compass,
  Crown,
  Heart,
  Lock,
  MapPin,
  Plane,
  RotateCcw,
  Sparkles,
  Sun,
  Ticket,
  Trophy,
  X,
  Gift,
  Bookmark,
  Send,
  HeartHandshake,
  Clock,
  Flame,
  Milestone,
  Luggage,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cities } from "@/data/cities";
import { provinces } from "@/data/provinces";
import {
  recentTimelineMemories,
  sortMemoriesByTime,
  type Memory,
} from "@/data/memories";
import {
  memoryStoreUpdatedEvent,
  type LocalMemoryStore,
  getLitCityIds,
  getLitProvinceIds,
} from "@/data/progress";
import { fetchMemoriesDeduplicated } from "@/components/province/Shared";
import { MemoryPageShell } from "@/components/MemoryNav";
import { readWishlist, WISHLIST_UPDATED_EVENT } from "./wishlistStore";
import { scrollToPageTop } from "@/lib/client/scroll";

// Earth radius in km for Haversine distance
function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export type AchievementCategory = "all" | "journey" | "romance" | "memory" | "ritual";

export interface Achievement {
  id: string;
  icon: typeof Trophy;
  title: string;
  subtitle: string;
  description: string;
  category: "journey" | "romance" | "memory" | "ritual";
  isUnlocked: boolean;
  progressText: string;
  progressPercent: number;
  unlockedDate?: string;
}

export default function AchievementsPage() {
  const [localMemories, setLocalMemories] = useState<LocalMemoryStore>({});
  const [wishlistCount, setWishlistCount] = useState(0);
  const [fulfilledWishCount, setFulfilledWishCount] = useState(0);
  const [capsulesCount, setCapsulesCount] = useState(0);
  const [tripsCount, setTripsCount] = useState(0);
  const [anniversariesCount, setAnniversariesCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory>("all");
  const [selectedBadge, setSelectedBadge] = useState<Achievement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load memories & all modules state
  useEffect(() => {
    let cancelled = false;
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent<LocalMemoryStore>).detail;
      if (detail) setLocalMemories(detail);
    };

    async function load() {
      const data = await fetchMemoriesDeduplicated().catch(() => ({}));
      if (!cancelled) setLocalMemories(data);
    }

    const refreshExtraModules = () => {
      if (typeof window === "undefined") return;
      // Wishlist
      const wishes = readWishlist();
      setWishlistCount(wishes.length);
      setFulfilledWishCount(wishes.filter((w) => w.isFulfilled).length);

      // Capsules
      try {
        const rawCapsules = window.localStorage.getItem("mapofus:capsules");
        if (rawCapsules) {
          const list = JSON.parse(rawCapsules);
          setCapsulesCount(Array.isArray(list) ? list.length : 0);
        }
      } catch {}

      // Trips
      try {
        const rawTrips = window.localStorage.getItem("mapofus:trips");
        if (rawTrips) {
          const list = JSON.parse(rawTrips);
          setTripsCount(Array.isArray(list) ? list.length : 0);
        }
      } catch {}

      // Anniversaries
      try {
        const rawAnni = window.localStorage.getItem("mapofus:anniversaries");
        if (rawAnni) {
          const list = JSON.parse(rawAnni);
          setAnniversariesCount(Array.isArray(list) ? list.length : 0);
        }
      } catch {}

      // Favorites
      try {
        const rawFavs = window.localStorage.getItem("mapofus:favorites");
        if (rawFavs) {
          const list = JSON.parse(rawFavs);
          setFavoritesCount(Array.isArray(list) ? list.length : 0);
        }
      } catch {}
    };

    window.addEventListener(memoryStoreUpdatedEvent, handleUpdate);
    window.addEventListener(WISHLIST_UPDATED_EVENT, refreshExtraModules);
    window.addEventListener("storage", refreshExtraModules);
    load();
    refreshExtraModules();

    return () => {
      cancelled = true;
      window.removeEventListener(memoryStoreUpdatedEvent, handleUpdate);
      window.removeEventListener(WISHLIST_UPDATED_EVENT, refreshExtraModules);
      window.removeEventListener("storage", refreshExtraModules);
    };
  }, []);

  // Compute all metrics
  const metrics = useMemo(() => {
    const localItems = Object.values(localMemories).flat();
    const byId = new Map<string, Memory>();
    [...recentTimelineMemories, ...localItems].forEach((m) => {
      if (!m.draft) byId.set(m.id, m);
    });

    const allMemories = sortMemoriesByTime([...byId.values()]);
    const litCityIds = getLitCityIds(localMemories);
    const litProvinceIds = getLitProvinceIds(litCityIds);

    // Visited cities data with coordinates
    const visitedCities = cities.filter((c) => litCityIds.has(c.id));

    // Calculate maximum distance between any two visited cities
    let maxDistance = 0;
    for (let i = 0; i < visitedCities.length; i++) {
      for (let j = i + 1; j < visitedCities.length; j++) {
        const d = calculateDistanceKm(
          visitedCities[i].lat,
          visitedCities[i].lng,
          visitedCities[j].lat,
          visitedCities[j].lng
        );
        if (d > maxDistance) maxDistance = d;
      }
    }

    // Four seasons check
    const seasons = new Set<string>();
    allMemories.forEach((m) => {
      const match = /\.(\d{2})\./.exec(m.date);
      if (match) {
        const month = parseInt(match[1], 10);
        if (month >= 3 && month <= 5) seasons.add("spring");
        else if (month >= 6 && month <= 8) seasons.add("summer");
        else if (month >= 9 && month <= 11) seasons.add("autumn");
        else seasons.add("winter");
      }
    });

    // Total words in all memory notes
    const totalWords = allMemories.reduce((acc, m) => acc + (m.text?.length || 0), 0);

    // Count photos
    const totalPhotos = allMemories.reduce(
      (acc, m) => acc + (m.photos?.length || 1),
      0
    );

    // Sweet / romantic moods count
    const romanticMoods = allMemories.filter(
      (m) => m.mood === "happy" || m.mood === "romantic" || m.mood === "sweet"
    ).length;

    // Time span in days
    let daySpan = 0;
    if (allMemories.length >= 2) {
      const dates = allMemories
        .map((m) => new Date(m.date.replace(/\./g, "-")).getTime())
        .filter((t) => !isNaN(t));
      if (dates.length >= 2) {
        const minT = Math.min(...dates);
        const maxT = Math.max(...dates);
        daySpan = Math.round((maxT - minT) / (1000 * 60 * 60 * 24));
      }
    }

    return {
      totalMemories: allMemories.length,
      cityCount: litCityIds.size,
      provinceCount: litProvinceIds.size,
      maxDistance,
      seasonsCount: seasons.size,
      totalWords,
      totalPhotos,
      romanticMoods,
      daySpan,
      firstMemoryDate: allMemories[allMemories.length - 1]?.date,
      latestMemoryDate: allMemories[0]?.date,
    };
  }, [localMemories]);

  // Construct 28 Creative Romantic Badges
  const badges = useMemo<Achievement[]>(() => {
    return [
      // ==================== 🌍 旅途足迹 (8) ====================
      {
        id: "first_city",
        icon: Sparkles,
        title: "初见微芒",
        subtitle: "记录第 1 座城市回忆",
        description: "在地图上写下我们的第一个足迹，那是所有浪漫故事的温暖起点。",
        category: "journey",
        isUnlocked: metrics.cityCount >= 1,
        progressText: `${Math.min(metrics.cityCount, 1)} / 1 座城市`,
        progressPercent: metrics.cityCount >= 1 ? 100 : 0,
        unlockedDate: metrics.firstMemoryDate,
      },
      {
        id: "three_cities",
        icon: MapPin,
        title: "足迹成双",
        subtitle: "走过至少 3 座不同的城市",
        description: "从一座城到另一座城，只要身边是你，哪里都是充满爱意的避风港。",
        category: "journey",
        isUnlocked: metrics.cityCount >= 3,
        progressText: `${Math.min(metrics.cityCount, 3)} / 3 座城市`,
        progressPercent: Math.min(Math.round((metrics.cityCount / 3) * 100), 100),
      },
      {
        id: "seven_cities",
        icon: Milestone,
        title: "七星伴月",
        subtitle: "携手走过 7 座美丽城市",
        description: "像天上的北斗七星连成轨迹，每座城市都闪耀着属于我们的独特光芒。",
        category: "journey",
        isUnlocked: metrics.cityCount >= 7,
        progressText: `${Math.min(metrics.cityCount, 7)} / 7 座城市`,
        progressPercent: Math.min(Math.round((metrics.cityCount / 7) * 100), 100),
      },
      {
        id: "ten_cities",
        icon: Crown,
        title: "十城山海",
        subtitle: "点亮 10 座城市足迹",
        description: "十城山海，十处人间风月。无论走到哪里，最美的风景始终是你身旁的笑颜。",
        category: "journey",
        isUnlocked: metrics.cityCount >= 10,
        progressText: `${Math.min(metrics.cityCount, 10)} / 10 座城市`,
        progressPercent: Math.min(Math.round((metrics.cityCount / 10) * 100), 100),
      },
      {
        id: "across_distance",
        icon: Plane,
        title: "跨越山海",
        subtitle: "足迹直线距离超过 1000 公里",
        description: "山海不可平，但爱意能跨越千里。两个城市的距离，见证了我们最坚定的奔赴。",
        category: "journey",
        isUnlocked: metrics.maxDistance >= 1000,
        progressText: `${metrics.maxDistance} / 1000 公里`,
        progressPercent: Math.min(Math.round((metrics.maxDistance / 1000) * 100), 100),
      },
      {
        id: "across_long_distance",
        icon: Compass,
        title: "天涯咫尺",
        subtitle: "足迹直线距离超过 2500 公里",
        description: "从南到北，从东到西，跨越两千五百公里的山河日月，心与心的距离从不曾远离。",
        category: "journey",
        isUnlocked: metrics.maxDistance >= 2500,
        progressText: `${metrics.maxDistance} / 2500 公里`,
        progressPercent: Math.min(Math.round((metrics.maxDistance / 2500) * 100), 100),
      },
      {
        id: "five_provinces",
        icon: Crown,
        title: "走遍九州",
        subtitle: "点亮超过 5 个省份",
        description: "在祖国的大好河山里，一省一地地盖上独属于我们的爱情图章。",
        category: "journey",
        isUnlocked: metrics.provinceCount >= 5,
        progressText: `${Math.min(metrics.provinceCount, 5)} / 5 个省份`,
        progressPercent: Math.min(Math.round((metrics.provinceCount / 5) * 100), 100),
      },
      {
        id: "ten_provinces",
        icon: Award,
        title: "锦绣山河",
        subtitle: "点亮超过 10 个省份",
        description: "十省版图，万千气象。你们的爱在辽阔的大地上生根发芽，繁花似锦。",
        category: "journey",
        isUnlocked: metrics.provinceCount >= 10,
        progressText: `${Math.min(metrics.provinceCount, 10)} / 10 个省份`,
        progressPercent: Math.min(Math.round((metrics.provinceCount / 10) * 100), 100),
      },

      // ==================== 💖 浪漫时光 (7) ====================
      {
        id: "four_seasons",
        icon: Sun,
        title: "四季有你",
        subtitle: "春、夏、秋、冬皆有旅行打卡",
        description: "春天看花，夏天吹风，秋天赏月，冬天看雪。四季流转，爱如初见。",
        category: "romance",
        isUnlocked: metrics.seasonsCount >= 4,
        progressText: `${metrics.seasonsCount} / 4 个季节`,
        progressPercent: Math.min(Math.round((metrics.seasonsCount / 4) * 100), 100),
      },
      {
        id: "romantic_mood",
        icon: Heart,
        title: "心动常在",
        subtitle: "记录过 3 次开心、甜蜜或浪漫心情",
        description: "生活中每一次怦然心动，都在相册里留下了嘴角上扬的弧度。",
        category: "romance",
        isUnlocked: metrics.romanticMoods >= 3,
        progressText: `${Math.min(metrics.romanticMoods, 3)} / 3 次`,
        progressPercent: Math.min(Math.round((metrics.romanticMoods / 3) * 100), 100),
      },
      {
        id: "sweet_mood_master",
        icon: Flame,
        title: "糖分超标",
        subtitle: "累计记录 10 次浪漫甜蜜心情",
        description: "两颗心在一起的日子，连空气里都弥漫着草莓味棉花糖的香甜气息。",
        category: "romance",
        isUnlocked: metrics.romanticMoods >= 10,
        progressText: `${Math.min(metrics.romanticMoods, 10)} / 10 次`,
        progressPercent: Math.min(Math.round((metrics.romanticMoods / 10) * 100), 100),
      },
      {
        id: "love_words",
        icon: BookOpen,
        title: "蜜语千行",
        subtitle: "累计回忆文字字数超过 520 字",
        description: "一字一句都是写给岁月的情书。把琐碎的对白拼成 520 个温柔的注脚。",
        category: "romance",
        isUnlocked: metrics.totalWords >= 520,
        progressText: `${metrics.totalWords} / 520 字`,
        progressPercent: Math.min(Math.round((metrics.totalWords / 520) * 100), 100),
      },
      {
        id: "love_words_1314",
        icon: HeartHandshake,
        title: "万语千言",
        subtitle: "累计回忆文字字数超过 1314 字",
        description: "一生一世的浪漫，都落在日常字里行间最真挚的温度里。",
        category: "romance",
        isUnlocked: metrics.totalWords >= 1314,
        progressText: `${metrics.totalWords} / 1314 字`,
        progressPercent: Math.min(Math.round((metrics.totalWords / 1314) * 100), 100),
      },
      {
        id: "days_100",
        icon: Clock,
        title: "百日筑梦",
        subtitle: "回忆相伴跨度超过 100 天",
        description: "一百个日夜的相知相伴，点滴日常汇聚成两颗心最稳稳的依靠。",
        category: "romance",
        isUnlocked: metrics.daySpan >= 100,
        progressText: `${metrics.daySpan} / 100 天`,
        progressPercent: Math.min(Math.round((metrics.daySpan / 100) * 100), 100),
      },
      {
        id: "days_365",
        icon: Trophy,
        title: "执子之手",
        subtitle: "回忆时间跨度超过 365 天",
        description: "走过整整一年的春华秋实，岁岁常欢愉，年年皆有你。",
        category: "romance",
        isUnlocked: metrics.daySpan >= 365,
        progressText: `${metrics.daySpan} / 365 天`,
        progressPercent: Math.min(Math.round((metrics.daySpan / 365) * 100), 100),
      },

      // ==================== 📷 光影定格 (7) ====================
      {
        id: "photo_master_10",
        icon: Camera,
        title: "定格永恒",
        subtitle: "累计珍藏超过 10 张美好照片",
        description: "按下快门的瞬间，光影定格了青春，也定格了你在我眼底的倒影。",
        category: "memory",
        isUnlocked: metrics.totalPhotos >= 10,
        progressText: `${Math.min(metrics.totalPhotos, 10)} / 10 张`,
        progressPercent: Math.min(Math.round((metrics.totalPhotos / 10) * 100), 100),
      },
      {
        id: "photo_master_30",
        icon: Camera,
        title: "专属摄影师",
        subtitle: "累计珍藏超过 30 张旅途大片",
        description: "镜头对准你的时候，整个世界都成了最好看的虚化背景。",
        category: "memory",
        isUnlocked: metrics.totalPhotos >= 30,
        progressText: `${Math.min(metrics.totalPhotos, 30)} / 30 张`,
        progressPercent: Math.min(Math.round((metrics.totalPhotos / 30) * 100), 100),
      },
      {
        id: "photo_master_50",
        icon: Camera,
        title: "光影长卷",
        subtitle: "珍藏超过 50 张回忆光影",
        description: "一张张相片串联成了时间的河流，在每一道波光里都能看见幸福的样子。",
        category: "memory",
        isUnlocked: metrics.totalPhotos >= 50,
        progressText: `${Math.min(metrics.totalPhotos, 50)} / 50 张`,
        progressPercent: Math.min(Math.round((metrics.totalPhotos / 50) * 100), 100),
      },
      {
        id: "tickets_collector",
        icon: Ticket,
        title: "胶片放映师",
        subtitle: "收集珍藏超过 5 篇回忆故事",
        description: "把我们走过的每一站做成电影票根，放映属于两个人的独家浪漫大片。",
        category: "memory",
        isUnlocked: metrics.totalMemories >= 5,
        progressText: `${Math.min(metrics.totalMemories, 5)} / 5 篇`,
        progressPercent: Math.min(Math.round((metrics.totalMemories / 5) * 100), 100),
      },
      {
        id: "timeline_master_15",
        icon: Ticket,
        title: "时光放映室",
        subtitle: "累计记录超过 15 篇珍贵回忆条目",
        description: "厚厚的回忆录里，写满了每一次欢聚、每一次出游与每一次相视而笑。",
        category: "memory",
        isUnlocked: metrics.totalMemories >= 15,
        progressText: `${Math.min(metrics.totalMemories, 15)} / 15 篇`,
        progressPercent: Math.min(Math.round((metrics.totalMemories / 15) * 100), 100),
      },
      {
        id: "favorites_master",
        icon: Bookmark,
        title: "灵感收藏家",
        subtitle: "地点收藏馆中收录至少 3 篇心动攻略",
        description: "像翻阅小红书一样，把所有心动的旅行路线与打卡小店全部妥善珍藏。",
        category: "memory",
        isUnlocked: favoritesCount >= 3,
        progressText: `${Math.min(favoritesCount, 3)} / 3 篇`,
        progressPercent: Math.min(Math.round((favoritesCount / 3) * 100), 100),
      },
      {
        id: "favorites_master_6",
        icon: Bookmark,
        title: "攻略百宝箱",
        subtitle: "地点收藏馆中收录至少 6 篇灵感笔记",
        description: "每一次种草都是一次未完待续的探险，两个人专属的旅游宝典越来越丰满。",
        category: "memory",
        isUnlocked: favoritesCount >= 6,
        progressText: `${Math.min(favoritesCount, 6)} / 6 篇`,
        progressPercent: Math.min(Math.round((favoritesCount / 6) * 100), 100),
      },

      // ==================== 💌 生活仪式 (6) ====================
      {
        id: "wish_start",
        icon: Compass,
        title: "心愿启航",
        subtitle: "在心愿清单中写下第 1 个想去的地方",
        description: "对未来的每一次憧憬，都是我们手牵手奔赴下一次旅程的坚定约定。",
        category: "ritual",
        isUnlocked: wishlistCount >= 1,
        progressText: `${Math.min(wishlistCount, 1)} / 1 个心愿`,
        progressPercent: wishlistCount >= 1 ? 100 : 0,
      },
      {
        id: "wish_fulfilled",
        icon: Award,
        title: "愿望成真",
        subtitle: "成功点亮至少 1 个心愿清单城市",
        description: "我们终于来到了曾经憧憬的地方，梦想照进现实的样子真好看。",
        category: "ritual",
        isUnlocked: fulfilledWishCount >= 1,
        progressText: `${Math.min(fulfilledWishCount, 1)} / 1 个达成`,
        progressPercent: fulfilledWishCount >= 1 ? 100 : 0,
      },
      {
        id: "wish_fulfilled_3",
        icon: Sparkles,
        title: "愿望收集家",
        subtitle: "成功圆梦达成 3 个旅行心愿",
        description: "一个又一个许下的愿望接连成真，我们正在把憧憬一步步变成脚下的路。",
        category: "ritual",
        isUnlocked: fulfilledWishCount >= 3,
        progressText: `${Math.min(fulfilledWishCount, 3)} / 3 个达成`,
        progressPercent: Math.min(Math.round((fulfilledWishCount / 3) * 100), 100),
      },
      {
        id: "capsule_keeper",
        icon: Send,
        title: "时光宝盒",
        subtitle: "封存至少 1 颗寄往未来的时光胶囊",
        description: "将此刻的心情与悄悄话锁进时间信箱，等待未来的某一天静静拆阅。",
        category: "ritual",
        isUnlocked: capsulesCount >= 1,
        progressText: `${Math.min(capsulesCount, 1)} / 1 颗胶囊`,
        progressPercent: capsulesCount >= 1 ? 100 : 0,
      },
      {
        id: "trip_countdown",
        icon: Luggage,
        title: "远方启程",
        subtitle: "制定至少 1 次旅行倒数或行程计划",
        description: "看倒计时一天天变少，行李箱整装待发，最心动的永远是出发前的那份期待。",
        category: "ritual",
        isUnlocked: tripsCount >= 1,
        progressText: `${Math.min(tripsCount, 1)} / 1 个计划`,
        progressPercent: tripsCount >= 1 ? 100 : 0,
      },
      {
        id: "anniversary_keeper",
        icon: Calendar,
        title: "岁岁年年",
        subtitle: "记录至少 2 个专属于两人的纪念日",
        description: "每个平凡的日子因为有了彼此而闪闪发光，岁岁年年，深情永在。",
        category: "ritual",
        isUnlocked: anniversariesCount >= 2,
        progressText: `${Math.min(anniversariesCount, 2)} / 2 个纪念日`,
        progressPercent: Math.min(Math.round((anniversariesCount / 2) * 100), 100),
      },
    ];
  }, [
    metrics,
    wishlistCount,
    fulfilledWishCount,
    capsulesCount,
    tripsCount,
    anniversariesCount,
    favoritesCount,
  ]);

  const unlockedCount = badges.filter((b) => b.isUnlocked).length;
  const totalBadges = badges.length;
  const unlockedPercent = Math.round((unlockedCount / totalBadges) * 100);

  // Category Filter
  const filteredBadges = useMemo(() => {
    if (selectedCategory === "all") return badges;
    return badges.filter((b) => b.category === selectedCategory);
  }, [badges, selectedCategory]);

  // Responsive Pagination
  // Mobile: 4 badges per page (2x2)
  // Desktop: 8 badges per page (4x2)
  const itemsPerPage = isMobile ? 4 : 8;
  const totalPages = Math.max(1, Math.ceil(filteredBadges.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedBadges = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBadges.slice(start, start + itemsPerPage);
  }, [filteredBadges, currentPage, itemsPerPage]);

  const handlePageChange = (p: number) => {
    setCurrentPage(p);
    scrollToPageTop();
  };

  const categoryStats = useMemo(() => {
    return {
      all: badges.length,
      journey: badges.filter((b) => b.category === "journey").length,
      romance: badges.filter((b) => b.category === "romance").length,
      memory: badges.filter((b) => b.category === "memory").length,
      ritual: badges.filter((b) => b.category === "ritual").length,
    };
  }, [badges]);

  return (
    <MemoryPageShell active="achievements">
      <div className="w-full space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5DCE0] text-[#D86F82] shadow-2xs">
                <Trophy className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3F4951]">
                  恋爱足迹 · 成就徽章馆
                </h1>
              </div>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-[#5A6670]/70">
              每一次出发、每一处打卡、每一句手写的情话，都会化作一枚永不褪色的荣耀勋章
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-[10px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/80 px-3.5 py-2 text-xs font-semibold text-[#5A6670] shadow-2xs backdrop-blur-md">
              已解锁 <span className="text-[#D86F82] font-bold">{unlockedCount}</span> / {totalBadges} 枚勋章 ({unlockedPercent}%)
            </div>
          </div>
        </header>

        {/* Big Dashboard Banner */}
        <div className="relative overflow-hidden rounded-[16px] sm:rounded-[20px] border border-[#D8DDD8]/80 bg-gradient-to-br from-[#FFFDF9] via-[#FAF7F0] to-[#FFF0F2] p-4 sm:p-6 shadow-sm">
          <div className="relative z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 sm:gap-6">
            {/* Progress overview */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-[#D86F82] text-white">
                  <Award className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </span>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#D86F82]">
                  LOVE ACHIEVEMENT MASTER
                </span>
              </div>
              <h2 className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-[#3F4951]">
                已共同点亮 {metrics.cityCount} 城 · 跨越 {metrics.maxDistance} 公里
              </h2>
              <p className="mt-1 text-xs text-[#5A6670]/75 leading-relaxed max-w-xl">
                所有勋章均根据你们在地图上留下的真实足迹、照片数量、回忆字数、心愿与生活仪式自动解锁。
              </p>

              {/* Progress Bar */}
              <div className="mt-3 sm:mt-4">
                <div className="flex items-center justify-between text-xs font-semibold text-[#5A6670] mb-1">
                  <span>勋章收集进度</span>
                  <span className="text-[#D86F82] font-bold">{unlockedPercent}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5 p-0.5">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#F5DCE0] via-[#E86F82] to-[#D86F82]"
                    initial={{ width: 0 }}
                    animate={{ width: `${unlockedPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
              <div className="rounded-[12px] border border-[#EBEBE6] bg-white/90 p-2.5 sm:p-3 text-center shadow-2xs">
                <span className="text-base sm:text-xl font-bold text-[#3F4951]">
                  {metrics.cityCount}
                </span>
                <p className="text-[10px] text-[#5A6670]/60 mt-0.5">打卡城市</p>
              </div>
              <div className="rounded-[12px] border border-[#EBEBE6] bg-white/90 p-2.5 sm:p-3 text-center shadow-2xs">
                <span className="text-base sm:text-xl font-bold text-[#D86F82]">
                  {metrics.totalPhotos}
                </span>
                <p className="text-[10px] text-[#5A6670]/60 mt-0.5">珍藏照片</p>
              </div>
              <div className="rounded-[12px] border border-[#EBEBE6] bg-white/90 p-2.5 sm:p-3 text-center shadow-2xs">
                <span className="text-base sm:text-xl font-bold text-[#3F4951]">
                  {metrics.totalWords}
                </span>
                <p className="text-[10px] text-[#5A6670]/60 mt-0.5">回忆字数</p>
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: "all" as const, label: "全部勋章", icon: Award, count: categoryStats.all },
            { id: "journey" as const, label: "旅途足迹", icon: Compass, count: categoryStats.journey },
            { id: "romance" as const, label: "浪漫时光", icon: Heart, count: categoryStats.romance },
            { id: "memory" as const, label: "光影定格", icon: Camera, count: categoryStats.memory },
            { id: "ritual" as const, label: "生活仪式", icon: Gift, count: categoryStats.ritual },
          ].map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
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
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Badges Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {paginatedBadges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.id}
                onClick={() => setSelectedBadge(badge)}
                className={`group relative flex flex-col justify-between rounded-[14px] sm:rounded-[16px] border p-3.5 sm:p-5 transition duration-300 cursor-pointer ${
                  badge.isUnlocked
                    ? "border-[#E8B8C2]/80 bg-gradient-to-b from-[#FFFDF9] to-[#FFF5F6] shadow-[0_8px_24px_rgba(216,111,130,0.1)] hover:scale-[1.02] hover:shadow-[0_14px_32px_rgba(216,111,130,0.18)]"
                    : "border-[#D8DDD8]/70 bg-[#FAFBF7]/60 shadow-xs opacity-75 hover:opacity-100 hover:border-[#D8DDD8]"
                }`}
              >
                <div>
                  {/* Top Badge Icon & Status */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl shadow-sm transition ${
                        badge.isUnlocked
                          ? "bg-gradient-to-br from-[#F5DCE0] to-[#E86F82] text-white ring-2 ring-[#FFF0F2]"
                          : "bg-[#EAEAEA] text-[#5A6670]/40"
                      }`}
                    >
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                      {badge.isUnlocked && (
                        <div className="absolute -top-1 -right-1 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-[#D86F82] text-white">
                          <Sparkles className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                        </div>
                      )}
                    </div>

                    {badge.isUnlocked ? (
                      <span className="rounded-full bg-[#FFF0F2] px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-[#D86F82] border border-[#F5DCE0]">
                        已达成 ✨
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium text-[#5A6670]/50">
                        <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        未解锁
                      </span>
                    )}
                  </div>

                  {/* Title & Subtitle */}
                  <div className="mt-2.5 sm:mt-4">
                    <h3
                      className={`text-sm sm:text-base font-bold transition ${
                        badge.isUnlocked ? "text-[#3F4951]" : "text-[#5A6670]/60"
                      }`}
                    >
                      {badge.title}
                    </h3>
                    <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-[#5A6670]/70 font-medium truncate">
                      {badge.subtitle}
                    </p>
                    <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[#5A6670]/60 hidden sm:block">
                      {badge.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Progress Bar */}
                <div className="mt-2.5 sm:mt-4 pt-2 sm:pt-3 border-t border-[#D8DDD8]/50">
                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-semibold text-[#5A6670]/60 mb-1">
                    <span>{badge.isUnlocked ? "荣耀达成" : "当前进度"}</span>
                    <span className={badge.isUnlocked ? "text-[#D86F82] font-bold" : ""}>
                      {badge.progressText}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5">
                    <div
                      className={`h-full transition-all duration-500 ${
                        badge.isUnlocked ? "bg-[#D86F82]" : "bg-[#D8DDD8]"
                      }`}
                      style={{ width: `${badge.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-[14px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/90 px-3.5 sm:px-4 py-3 shadow-2xs backdrop-blur-md">
            <span className="text-xs text-[#5A6670]/70 text-center sm:text-left">
              共 {filteredBadges.length} 枚勋章 · 第 {currentPage} / {totalPages} 页
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

                  // If totalPages > 5, generate windowed pages
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

        {/* Detailed Modal on Click */}
        <AnimatePresence>
          {selectedBadge && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative w-full max-w-sm rounded-[24px] border border-[#D8DDD8] bg-[#FFFDF9] p-6 shadow-2xl text-center"
              >
                <button
                  type="button"
                  onClick={() => setSelectedBadge(null)}
                  className="absolute top-4 right-4 p-1 text-[#5A6670]/40 hover:text-[#5A6670]"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Big Medal Icon */}
                <div className="mx-auto mt-2 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#F5DCE0] to-[#E86F82] text-white shadow-lg shadow-[#D86F82]/20">
                  {(() => {
                    const ModalIcon = selectedBadge.icon;
                    return <ModalIcon className="h-10 w-10" />;
                  })()}
                </div>

                <h3 className="mt-4 text-xl font-bold text-[#3F4951]">
                  {selectedBadge.title}
                </h3>
                <p className="mt-1 text-xs font-semibold text-[#D86F82]">
                  {selectedBadge.subtitle}
                </p>

                <div className="mt-4 rounded-[12px] bg-[#FAF8F2] p-4 text-xs leading-relaxed text-[#5A6670] border border-[#EBEBE6]">
                  “{selectedBadge.description}”
                </div>

                {/* Progress Status */}
                <div className="mt-4 rounded-[10px] bg-white p-3 border border-[#EBEBE6] flex items-center justify-between text-xs">
                  <span className="text-[#5A6670]/70 font-medium">完成进度</span>
                  <span className="font-bold text-[#D86F82]">
                    {selectedBadge.progressText}
                  </span>
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setSelectedBadge(null)}
                    className="w-full rounded-[10px] bg-[#D86F82] py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#c95d70] transition"
                  >
                    太棒啦！
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </MemoryPageShell>
  );
}
