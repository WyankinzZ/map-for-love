"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map as MapIcon, Image as ImageIcon, User } from "lucide-react";

export function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      key: "map",
      label: "地图",
      icon: MapIcon,
      href: "/map",
      isActive: pathname === "/map",
    },
    {
      key: "memories",
      label: "相册",
      icon: ImageIcon,
      href: "/memories",
      isActive: pathname === "/memories",
    },
    {
      key: "settings",
      label: "我的",
      icon: User,
      href: "/settings",
      isActive: pathname === "/settings",
    },
  ];

  return (
    <nav
      aria-label="移动端底部导航"
      className="fixed bottom-1.5 left-1/2 -translate-x-1/2 z-30 flex h-10 w-[220px] items-center justify-around rounded-full border border-[#D8DDD8]/90 bg-[#FAFBF7]/95 px-2 shadow-[0_4px_16px_rgba(90,102,112,0.12)] backdrop-blur-md lg:hidden"
    >
      {navItems.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition ${
            item.isActive
              ? "bg-[#F5DCE0] text-[#D86F82] font-semibold shadow-2xs"
              : "text-[#5A6670]/60 hover:text-[#5A6670]"
          }`}
        >
          <item.icon
            className={`h-3.5 w-3.5 ${item.isActive ? "fill-current" : ""}`}
            strokeWidth={item.isActive ? 2.5 : 2}
          />
          <span className="text-[11px]">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
