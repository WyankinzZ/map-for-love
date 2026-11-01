"use client";

import { useMemo, useEffect } from "react";
import { ChevronDown, Calendar } from "lucide-react";

export interface DateDropdownSelectProps {
  value: string; // "YYYY.MM.DD" or "YYYY-MM-DD" or "YYYY/MM/DD"
  onChange: (val: string) => void;
  minYear?: number;
  maxYear?: number;
  presets?: Array<{ label: string; getDate: () => string }>;
  accent?: "pink" | "blue" | "default";
  className?: string;
}

export function DateDropdownSelect({
  value,
  onChange,
  minYear = 2012,
  maxYear = 2035,
  presets,
  accent = "pink",
  className = "",
}: Readonly<DateDropdownSelectProps>) {
  // Parse current year, month, day
  const { currentYear, currentMonth, currentDay } = useMemo(() => {
    const today = new Date();
    const defaultY = today.getFullYear();
    const defaultM = today.getMonth() + 1;
    const defaultD = today.getDate();

    if (!value) {
      return { currentYear: defaultY, currentMonth: defaultM, currentDay: defaultD };
    }

    const parts = value.split(/[./-]/).map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return {
        currentYear: parts[0],
        currentMonth: Math.min(12, Math.max(1, parts[1])),
        currentDay: Math.min(31, Math.max(1, parts[2])),
      };
    }

    return { currentYear: defaultY, currentMonth: defaultM, currentDay: defaultD };
  }, [value]);

  // Max days in the selected month
  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth, 0).getDate();
  }, [currentYear, currentMonth]);

  // If currentDay > daysInMonth (e.g. switching from Jan 31 to Feb), clamp it
  useEffect(() => {
    if (currentDay > daysInMonth) {
      const formatted = `${currentYear}.${String(currentMonth).padStart(2, "0")}.${String(daysInMonth).padStart(2, "0")}`;
      onChange(formatted);
    }
  }, [currentYear, currentMonth, currentDay, daysInMonth, onChange]);

  // List of years
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(y);
    }
    return list;
  }, [minYear, maxYear]);

  // Handlers
  const handleYearChange = (newYear: number) => {
    const maxD = new Date(newYear, currentMonth, 0).getDate();
    const validD = Math.min(currentDay, maxD);
    onChange(`${newYear}.${String(currentMonth).padStart(2, "0")}.${String(validD).padStart(2, "0")}`);
  };

  const handleMonthChange = (newMonth: number) => {
    const maxD = new Date(currentYear, newMonth, 0).getDate();
    const validD = Math.min(currentDay, maxD);
    onChange(`${currentYear}.${String(newMonth).padStart(2, "0")}.${String(validD).padStart(2, "0")}`);
  };

  const handleDayChange = (newDay: number) => {
    onChange(`${currentYear}.${String(currentMonth).padStart(2, "0")}.${String(newDay).padStart(2, "0")}`);
  };

  const focusRing =
    accent === "blue"
      ? "focus:border-[#A8C8DC] focus:ring-[#A8C8DC]/20"
      : "focus:border-[#E8B8C2] focus:ring-[#E8B8C2]/20";

  return (
    <div className={`space-y-2 ${className}`}>
      {/* 3 Select dropdowns */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {/* Year Dropdown */}
        <div className="relative">
          <select
            value={currentYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className={`w-full appearance-none rounded-[10px] border border-[#D8DDD8] bg-white py-2 pl-2 sm:pl-3 pr-6 text-xs sm:text-sm font-medium text-[#5A6670] outline-none transition focus:ring-2 ${focusRing}`}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y} 年
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 sm:right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5A6670]/40" />
        </div>

        {/* Month Dropdown */}
        <div className="relative">
          <select
            value={currentMonth}
            onChange={(e) => handleMonthChange(Number(e.target.value))}
            className={`w-full appearance-none rounded-[10px] border border-[#D8DDD8] bg-white py-2 pl-2 sm:pl-3 pr-6 text-xs sm:text-sm font-medium text-[#5A6670] outline-none transition focus:ring-2 ${focusRing}`}
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const m = i + 1;
              return (
                <option key={m} value={m}>
                  {m} 月
                </option>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 sm:right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5A6670]/40" />
        </div>

        {/* Day Dropdown */}
        <div className="relative">
          <select
            value={Math.min(currentDay, daysInMonth)}
            onChange={(e) => handleDayChange(Number(e.target.value))}
            className={`w-full appearance-none rounded-[10px] border border-[#D8DDD8] bg-white py-2 pl-2 sm:pl-3 pr-6 text-xs sm:text-sm font-medium text-[#5A6670] outline-none transition focus:ring-2 ${focusRing}`}
          >
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              return (
                <option key={d} value={d}>
                  {d} 日
                </option>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 sm:right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5A6670]/40" />
        </div>
      </div>

      {/* Quick Presets Pills (Optional) */}
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {presets.map((preset) => {
            const targetDate = preset.getDate();
            const isActive = value === targetDate;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(targetDate)}
                className={`rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-medium transition ${
                  isActive
                    ? accent === "blue"
                      ? "bg-[#A8C8DC] text-white shadow-2xs"
                      : "bg-[#E8B8C2] text-white shadow-2xs"
                    : "border border-[#D8DDD8]/80 bg-[#FAFBF7] text-[#5A6670]/70 hover:border-[#E8B8C2]"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
