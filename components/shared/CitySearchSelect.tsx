"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cities } from "@/data/cities";

interface CitySearchSelectProps {
  value: string;
  onChange: (cityId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  accent?: "pink" | "blue";
}

const cityOptions = cities.slice().sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));

export function CitySearchSelect({
  value,
  onChange,
  disabled = false,
  placeholder = "搜索或选择城市...",
  accent = "pink",
}: Readonly<CitySearchSelectProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const matchedCity = useMemo(() => cities.find((c) => c.id === value), [value]);

  useEffect(() => {
    if (matchedCity) setSearch(matchedCity.name);
  }, [matchedCity]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (matchedCity) setSearch(matchedCity.name);
        else setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [matchedCity]);

  const filtered = useMemo(
    () => {
      if (!search.trim()) return cityOptions;
      const q = search.toLowerCase();
      return cityOptions.filter((c) => 
        c.name.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q)
      );
    },
    [search],
  );

  const borderActive = accent === "blue" ? "border-[#A8C8DC]" : "border-[#E8B8C2]";
  const highlightBg = accent === "blue" ? "bg-[#D6E8F0]/50" : "bg-[#F5DCE0]/50";
  const highlightText = accent === "blue" ? "text-[#A8C8DC]" : "text-[#E8B8C2]";
  const hoverBg = accent === "blue" ? "hover:bg-[#D6E8F0]/30" : "hover:bg-[#F5DCE0]/30";

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className={`flex w-full items-center justify-between rounded-[8px] border ${
          isOpen ? `${borderActive} bg-white` : "border-[#D8DDD8] bg-[#FAFBF7]"
        } px-4 py-2.5 text-sm outline-none transition`}
      >
        <input
          className="w-full bg-transparent outline-none text-[#5A6670] placeholder-[#5A6670]/40"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          disabled={disabled}
        />
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#5A6670]/40 transition-transform cursor-pointer ${
            isOpen ? "rotate-180" : ""
          }`}
          onClick={() => {
            if (!disabled) setIsOpen(!isOpen);
          }}
        />
      </div>
      {isOpen && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-[8px] border border-[#D8DDD8] bg-white py-1.5 shadow-xl">
          {filtered.map((city) => (
            <div
              key={city.id}
              className={`cursor-pointer px-4 py-2 text-sm transition ${hoverBg} ${
                city.id === value ? `${highlightBg} font-semibold ${highlightText}` : "text-[#5A6670]"
              }`}
              onClick={() => {
                onChange(city.id);
                setSearch(city.name);
                setIsOpen(false);
              }}
            >
              {city.name}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-4 text-center text-sm text-[#5A6670]/40">
              未找到相关城市
            </div>
          )}
        </div>
      )}
    </div>
  );
}
