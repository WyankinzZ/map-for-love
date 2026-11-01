"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Archive,
  BookOpen,
  CalendarDays,
  Heart,
  Map as MapIcon,
  MapPin,
  Settings,
  Star,
  X,
  Info,
  Image as ImageIcon,
  PlaneTakeoff,
  CloudSun,
  Menu,
  Ticket,
  Mail,
  Compass,
  Trophy,
} from "lucide-react";
import { MobileBottomNav } from "./MobileBottomNav";

const githubUrl = "https://github.com/zkeyoned/map-of-us-template";
const devUrl = "https://github.com/WyankinzZ/map-for-everyone";
const douyinUrl = "https://www.douyin.com/user/MS4wLjABAAAAMWgaMMPGnFwsJmpKo1ha0HPQ6-ul-NEWzzMvQ9NIPYQ";

export type MemoryNavKey =
  | "map"
  | "memories"
  | "tickets"
  | "postcards"
  | "wishlist"
  | "achievements"
  | "favorites"
  | "anniversaries"
  | "capsule"
  | "landmarks"
  | "loginPhotos"
  | "trips"
  | "weather"
  | "settings";

export interface NavGroup {
  title: string;
  items: Array<{
    key: MemoryNavKey;
    matchKeys?: MemoryNavKey[];
    label: string;
    icon: typeof MapIcon;
    href: string;
    badge?: string;
  }>;
}

export const navGroups: NavGroup[] = [
  {
    title: "足迹与回忆",
    items: [
      { key: "map", label: "地图探索", icon: MapIcon, href: "/map" },
      {
        key: "memories",
        matchKeys: ["memories", "tickets", "postcards"],
        label: "回忆时光录",
        icon: BookOpen,
        href: "/memories",
      },
      { key: "achievements", label: "恋爱成就", icon: Trophy, href: "/achievements" },
      { key: "anniversaries", label: "纪念日", icon: CalendarDays, href: "/anniversaries" },
    ],
  },
  {
    title: "未来的约定",
    items: [
      { key: "wishlist", label: "未来心愿", icon: Compass, href: "/wishlist" },
      { key: "trips", label: "旅行倒数", icon: PlaneTakeoff, href: "/trips" },
      { key: "capsule", label: "时光宝盒", icon: Archive, href: "/time-capsule" },
    ],
  },
  {
    title: "偏好与设置",
    items: [
      { key: "favorites", label: "地点收藏", icon: Heart, href: "/favorites" },
      { key: "weather", label: "沿途天气", icon: CloudSun, href: "/weather" },
      {
        key: "settings",
        matchKeys: ["settings", "landmarks", "loginPhotos"],
        label: "系统设置",
        icon: Settings,
        href: "/settings",
      },
    ],
  },
];

export function MemorySidebar({ active, className, onClose }: Readonly<{ active: MemoryNavKey; className?: string; onClose?: () => void }>) {
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <aside className={className ?? "hidden h-full max-h-screen w-[240px] shrink-0 sticky top-0 self-start border-r border-[#D8DDD8]/78 bg-[#FAFBF7]/85 px-3.5 py-6 shadow-[10px_0_30px_rgba(90,102,112,0.035)] backdrop-blur lg:flex lg:flex-col justify-between overflow-hidden"}>
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Brand Header */}
        <div className="text-center pb-2 border-b border-[#D8DDD8]/40">
          <div className="mx-auto grid h-10 w-10 place-items-center">
            <Heart className="h-7 w-7 fill-[#F5DCE0] text-[#E8B8C2]" />
          </div>
          <p className="mt-1 text-base font-bold text-[#5A6670]">Map For Love</p>
          <p className="text-[11px] text-[#5A6670]/50">只属于两个人的回忆</p>
        </div>

        {/* Grouped Nav Items */}
        <nav className="mt-3 flex-1 space-y-3 overflow-y-auto no-scrollbar">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5A6670]/40">
                {group.title}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isSelected =
                  item.key === active || (item.matchKeys && item.matchKeys.includes(active));

                return (
                  <Link
                    key={item.key}
                    onClick={onClose}
                    className={`flex w-full items-center gap-2.5 rounded-[7px] px-3 py-2 text-xs font-semibold transition ${
                      isSelected
                        ? "border border-[#F5DCE0] bg-[#F5DCE0]/60 text-[#D86F82] shadow-xs"
                        : "border border-transparent text-[#5A6670]/72 hover:border-[#D8DDD8]/80 hover:bg-white/80 hover:text-[#5A6670]"
                    }`}
                    href={item.href}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-[#D86F82]" : "text-[#5A6670]/60"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Love Footer Quote */}
        <div className="mt-3 rounded-[8px] border border-[#F5DCE0]/60 bg-[#FFFDF9]/80 p-2.5 text-center text-[11px] leading-relaxed text-[#5A6670]/70">
          地图的每个角落，都是爱的故事
          <Heart className="ml-1 inline h-3 w-3 fill-[#F5DCE0] text-[#E8B8C2]" />
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-[#D8DDD8]/40">
        <button
          onClick={() => setIsAboutOpen(true)}
          className="flex w-full items-center justify-between rounded-[7px] border border-[#D8DDD8]/60 bg-white/70 px-3 py-1.5 text-xs font-medium text-[#5A6670]/60 transition hover:border-[#D8DDD8] hover:text-[#5A6670]"
        >
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-[#A8C8DC]" />
            关于这份地图
          </div>
          <span className="text-[10px] text-[#5A6670]/40">v0.1</span>
        </button>
      </div>

      <AnimatePresence>
        {isAboutOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#5A6670]/20 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-[360px] rounded-[16px] bg-white p-6 shadow-[0_20px_60px_rgba(90,102,112,0.12)]"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 fill-[#F5DCE0] text-[#E8B8C2]" />
                  <h2 className="text-base font-semibold text-[#5A6670]">关于这份地图</h2>
                </div>
                <button
                  onClick={() => setIsAboutOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full text-[#5A6670]/40 transition hover:bg-[#FAFBF7] hover:text-[#5A6670]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-medium text-[#5A6670]/60">基于Map of Us 二次开发</p>

                <div className="border-t border-[#D8DDD8]/54 pt-4">
                  <p className="text-xs font-semibold text-[#5A6670]/60">数据存在哪</p>
                  <p className="mt-1.5 text-xs leading-5 text-[#5A6670]/50">
                    这个版本是「本地存储」：照片和回忆都只保存在你自己的电脑上，不上传云端、不联网同步。你的隐私完全留在本地。
                  </p>
                </div>

                <div className="border-t border-[#D8DDD8]/54 pt-4">
                  <p className="text-xs font-semibold text-[#5A6670]/60">开源项目</p>
                  <a
                    className="mt-2 flex items-center justify-center gap-1.5 rounded-[7px] border border-[#F5DCE0] bg-[#F5DCE0]/40 px-3 py-2 text-xs font-semibold text-[#E8B8C2] transition hover:bg-[#F5DCE0]/70"
                    href={githubUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Star className="h-3.5 w-3.5" />
                    去 GitHub 点个 Star
                  </a>
                  <p className="mt-2 select-text text-center text-[11px] text-[#5A6670]/40">
                    github.com/zkeyoned/map-of-us-template
                  </p>
                </div>

                <div className="border-t border-[#D8DDD8]/54 pt-4">
                  <p className="text-xs font-semibold text-[#5A6670]/60">二次开发</p>
                  <a
                    className="mt-2 flex items-center justify-center gap-1.5 rounded-[7px] border border-[#D6E8F0] bg-[#D6E8F0]/40 px-3 py-2 text-xs font-semibold text-[#A8C8DC] transition hover:bg-[#D6E8F0]/70"
                    href={devUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Star className="h-3.5 w-3.5" />
                    去 GitHub 了解更多
                  </a>
                  <p className="mt-2 select-text text-center text-[11px] text-[#5A6670]/40">
                    github.com/WyankinzZ/map-for-everyone
                  </p>
                </div>

                <div className="border-t border-[#D8DDD8]/54 pt-4">
                  <p className="mb-2 text-xs font-semibold text-[#5A6670]/60">作者联系方式</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#5A6670]/50">微信</span>
                    <span className="select-text font-medium text-[#5A6670]/72">fkqsj9999</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-[#5A6670]/50">抖音</span>
                    <a
                      className="font-medium text-[#E8B8C2] transition hover:underline"
                      href={douyinUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Www_531 ↗
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </aside>
  );
}

export function MemoryPageShell({
  active,
  children,
}: Readonly<{
  active: MemoryNavKey;
  children: ReactNode;
}>) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <main className="relative flex h-[100dvh] h-screen max-h-[100dvh] max-h-screen flex-col overflow-hidden bg-[#FAFBF7] text-[#5A6670]">
      <div className="map-mist-band" aria-hidden="true" />
      <span className="absolute left-[38%] top-[9%] h-2 w-2 bg-[#F5DCE0]" aria-hidden="true" />
      <span className="absolute right-[17%] top-[15%] h-2 w-2 bg-[#D6E8F0]" aria-hidden="true" />
      
      {/* Fixed mobile top header (compact & slim to prevent blocking content) */}
      <div className="fixed top-0 left-0 right-0 z-[100] flex h-10 items-center justify-between border-b border-[#D8DDD8]/78 bg-[#FAFBF7]/95 px-3.5 shadow-2xs backdrop-blur-md lg:hidden">
        <Link href="/map" className="flex items-center gap-1.5 transition hover:opacity-80 active:scale-95">
          <Heart className="h-4 w-4 fill-[#F5DCE0] text-[#E8B8C2]" />
          <span className="text-[13px] font-semibold text-[#5A6670]">Map For Love</span>
        </Link>
        <button
          type="button"
          onClick={() => setIsMobileNavOpen(true)}
          className="rounded-full p-1.5 text-[#5A6670] transition hover:bg-[#F5DCE0]/40 hover:text-[#E8B8C2] active:scale-95"
          aria-label="打开导航菜单"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Layout spacer for fixed mobile top header */}
      <div className="h-10 shrink-0 lg:hidden" aria-hidden="true" />

      <div className="relative z-10 flex min-h-0 flex-1 h-full overflow-hidden">
        <MemorySidebar active={active} />
        
        <AnimatePresence>
          {isMobileNavOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileNavOpen(false)}
                className="fixed inset-0 z-[110] bg-[#5A6670]/20 backdrop-blur-sm lg:hidden"
              />
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 z-[120] lg:hidden flex flex-col"
              >
                <MemorySidebar 
                  active={active} 
                  className="flex h-full w-[240px] shrink-0 flex-col overflow-y-auto overscroll-contain touch-pan-y border-r border-[#D8DDD8]/78 bg-[#FAFBF7] px-3.5 py-6" 
                  onClose={() => setIsMobileNavOpen(false)} 
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <section className="min-w-0 flex-1 h-full max-h-full overflow-y-auto px-3.5 pt-4 pb-24 sm:px-10 lg:py-8 overscroll-contain">{children}</section>
      </div>
      <MobileBottomNav />
    </main>
  );
}
