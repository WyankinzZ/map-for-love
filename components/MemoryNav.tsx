"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Archive,
  BookOpen,
  CalendarDays,
  Heart,
  Map as MapIcon,
  Settings,
  Star,
} from "lucide-react";

const githubUrl = "https://github.com/zkeyoned/map-of-us-template";
const bilibiliUrl = "https://b23.tv/5YY2Xx9";
const douyinUrl = "https://v.douyin.com/Pc3UKc03Wac/";

export type MemoryNavKey = "map" | "memories" | "favorites" | "anniversaries" | "capsule" | "settings";

const navItems = [
  { key: "map", label: "地图", icon: MapIcon, href: "/map" },
  { key: "memories", label: "回忆记录", icon: BookOpen, href: "/memories" },
  { key: "favorites", label: "地点收藏", icon: Heart, href: "/favorites" },
  { key: "anniversaries", label: "纪念日", icon: CalendarDays, href: "/anniversaries" },
  { key: "capsule", label: "时光宝盒", icon: Archive, href: "/time-capsule" },
  { key: "settings", label: "设置", icon: Settings, href: "/settings" },
] satisfies Array<{
  key: MemoryNavKey;
  label: string;
  icon: typeof MapIcon;
  href: string;
}>;

export function MemorySidebar({ active }: Readonly<{ active: MemoryNavKey }>) {
  return (
    <aside className="hidden min-h-screen w-[260px] shrink-0 border-r border-[#D8DDD8]/78 bg-[#FAFBF7]/78 px-5 py-8 shadow-[12px_0_34px_rgba(90,102,112,0.04)] backdrop-blur lg:block">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center">
          <Heart className="h-10 w-10 fill-[#F5DCE0] text-[#E8B8C2]" />
        </div>
        <p className="mt-2 text-lg font-semibold text-[#5A6670]">我们的地图</p>
        <p className="mt-1 text-xs text-[#5A6670]/52">只属于两个人的回忆</p>
      </div>

      <nav className="mt-10 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const selected = item.key === active;

          return (
            <Link
              key={item.key}
              className={`flex w-full items-center gap-3 rounded-[8px] border px-4 py-3 text-sm font-medium transition ${
                selected
                  ? "border-[#F5DCE0] bg-[#F5DCE0]/52 text-[#E8B8C2]"
                  : "border-transparent text-[#5A6670]/72 hover:border-[#D8DDD8] hover:bg-[#FAFBF7]"
              }`}
              href={item.href}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-10 rounded-[8px] border border-[#D8DDD8]/72 bg-[#FAFBF7]/72 p-4 text-sm leading-7 text-[#5A6670]/62 shadow-[0_12px_26px_rgba(90,102,112,0.05)]">
        在地图的每个角落，都有我们一起走过的故事
        <Heart className="ml-1 inline h-3.5 w-3.5 fill-[#F5DCE0] text-[#E8B8C2]" />
      </div>

      <div className="mt-4 rounded-[8px] border border-[#D8DDD8]/72 bg-[#FAFBF7]/72 p-4 shadow-[0_12px_26px_rgba(90,102,112,0.05)]">
        <div className="flex items-center gap-2">
          <Heart className="h-3.5 w-3.5 fill-[#F5DCE0] text-[#E8B8C2]" />
          <p className="text-xs font-semibold text-[#5A6670]">关于这份地图</p>
        </div>
        <p className="mt-2 text-xs leading-6 text-[#5A6670]/60">
          基于Map Of Us 二次开发
        </p>

        <div className="mt-3 border-t border-[#D8DDD8]/54 pt-3">
          <p className="text-[11px] font-semibold text-[#5A6670]/48">数据存在哪</p>
          <p className="mt-1 text-xs leading-6 text-[#5A6670]/60">
            这个版本是「本地存储」：照片和回忆都只保存在你自己的电脑上，不上传云端、不联网同步。和线上网站不同，你的隐私完全留在本地。
          </p>
        </div>

        <div className="mt-3 border-t border-[#D8DDD8]/54 pt-3">
          <p className="text-[11px] font-semibold text-[#5A6670]/48">开源项目</p>
          <a
            className="mt-1.5 flex items-center justify-center gap-1.5 rounded-[7px] border border-[#F5DCE0] bg-[#F5DCE0]/40 px-3 py-2 text-xs font-semibold text-[#E8B8C2] transition hover:bg-[#F5DCE0]/70"
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Star className="h-3.5 w-3.5" />
            去 GitHub 点个 Star
          </a>
          <p className="mt-1.5 select-text text-[11px] leading-5 text-[#5A6670]/55">
            github.com/zkeyoned/map-of-us-template
          </p>
        </div>

        <div className="mt-3 space-y-1.5 border-t border-[#D8DDD8]/54 pt-3">
          <p className="text-[11px] font-semibold text-[#5A6670]/48">作者联系方式</p>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[#5A6670]/48">微信</span>
            <span className="select-text font-medium text-[#5A6670]/72">Zz00726yd</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[#5A6670]/48">抖音</span>
            <a
              className="font-medium text-[#E8B8C2] transition hover:underline"
              href={douyinUrl}
              target="_blank"
              rel="noreferrer"
            >
              Zz00726yd ↗
            </a>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 border-t border-[#D8DDD8]/54 pt-3">
          <p className="text-[11px] font-semibold text-[#5A6670]/48">情侣 Vlog</p>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[#5A6670]/48">B 站</span>
            <a
              className="font-medium text-[#E8B8C2] transition hover:underline"
              href={bilibiliUrl}
              target="_blank"
              rel="noreferrer"
            >
              HuTieZhu_ ↗
            </a>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[#5A6670]/48">UID</span>
            <span className="select-text font-medium text-[#5A6670]/72">1604079591</span>
          </div>
        </div>
      </div>
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
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FAFBF7] text-[#5A6670]">
      <div className="map-mist-band" aria-hidden="true" />
      <span className="absolute left-[38%] top-[9%] h-2 w-2 bg-[#F5DCE0]" aria-hidden="true" />
      <span className="absolute right-[17%] top-[15%] h-2 w-2 bg-[#D6E8F0]" aria-hidden="true" />
      <div className="relative z-10 flex min-h-screen">
        <MemorySidebar active={active} />
        <section className="min-w-0 flex-1 px-6 py-8 sm:px-10">{children}</section>
      </div>
    </main>
  );
}
