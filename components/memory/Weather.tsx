"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CloudSun,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  Thermometer,
  MapPin,
  Heart,
  Navigation,
  RefreshCw,
  Sparkles,
  Umbrella,
  Calendar,
  Compass,
  ArrowRight,
  ChevronDown,
  Info,
  Clock,
  Shirt,
  Moon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MemoryPageShell } from "@/components/MemoryNav";
import { useAdminMode } from "@/hooks/useAdminMode";
import { CitySearchSelect } from "@/components/shared/CitySearchSelect";
import { cities, type City } from "@/data/cities";
import {
  readAppSettings,
  writeAppSettings,
  defaultWeatherCityIds,
  maxWeatherCities,
  type AppSettings,
} from "@/data/appSettings";

export type WeatherKind =
  | "sunny"
  | "night-clear"
  | "partly"
  | "night-partly"
  | "cloudy"
  | "rain"
  | "light-rain"
  | "heavy-rain"
  | "thunder"
  | "snow"
  | "fog"
  | "wind";

export interface DayForecast {
  date: string;
  weekday: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  precipProb: number;
}

export interface CityWeatherData {
  cityId: string;
  cityName: string;
  provinceName?: string;
  temp: number;
  apparentTemp: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  weatherCode: number;
  isDay: boolean;
  kind: WeatherKind;
  label: string;
  highTemp: number;
  lowTemp: number;
  forecast: DayForecast[];
  lastUpdated: string;
  loading: boolean;
  error?: string;
}

// Distance calculation using Haversine formula
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

// Weather Kind determination
function parseWeatherKind(code: number, windSpeed: number, isDay: boolean): { kind: WeatherKind; label: string } {
  if (windSpeed >= 38) return { kind: "wind", label: "大风天气" };
  if (code === 0) return isDay ? { kind: "sunny", label: "晴朗万里" } : { kind: "night-clear", label: "星月皎洁" };
  if (code === 1 || code === 2) {
    return isDay ? { kind: "partly", label: "多云和煦" } : { kind: "night-partly", label: "夜色多云" };
  }
  if (code === 3) return { kind: "cloudy", label: "阴天舒凉" };
  if (code === 45 || code === 48) return { kind: "fog", label: "晨雾弥漫" };
  if ([51, 53, 55, 61, 80].includes(code)) return { kind: "light-rain", label: "细雨绵绵" };
  if ([63, 81].includes(code)) return { kind: "rain", label: "阵雨沥沥" };
  if ([65, 82].includes(code)) return { kind: "heavy-rain", label: "倾盆大雨" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { kind: "snow", label: "漫天雪花" };
  if ([95, 96, 99].includes(code)) return { kind: "thunder", label: "雷雨交加" };
  return { kind: "rain", label: "雨水相伴" };
}

const DEFAULT_SLOT_ROLES = [
  { role: "我的常驻之城", subtitle: "晨昏相伴，彼此牵挂的出发地" },
  { role: "心之所向 · TA的城市", subtitle: "同一片星空下，心跳同频的归宿" },
  { role: "下一次旅行目的地", subtitle: "未来牵手奔赴的诗与远方" },
];

export default function WeatherPage() {
  const isAdmin = useAdminMode();
  const [appSettings, setAppSettings] = useState<AppSettings>({});
  const [weatherMap, setWeatherMap] = useState<Record<string, CityWeatherData>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeTabMap, setActiveTabMap] = useState<Record<number, "current" | "forecast">>({
    0: "current",
    1: "current",
    2: "current",
  });

  // Load appSettings
  useEffect(() => {
    setAppSettings(readAppSettings());
  }, []);

  const weatherCityIds = useMemo(() => {
    return appSettings.weatherCityIds ?? defaultWeatherCityIds;
  }, [appSettings.weatherCityIds]);

  // Fetch weather for a given city
  const fetchCityWeather = useCallback(async (cityId: string): Promise<CityWeatherData | null> => {
    const city = cities.find((c) => c.id === cityId);
    if (!city) return null;

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Weather request failed");
      const data = await res.json();

      const current = data.current || {};
      const daily = data.daily || {};
      const temp = Math.round(current.temperature_2m ?? 20);
      const apparentTemp = Math.round(current.apparent_temperature ?? temp);
      const humidity = Math.round(current.relative_humidity_2m ?? 60);
      const windSpeed = Math.round(current.wind_speed_10m ?? 8);
      const precipitation = current.precipitation ?? 0;
      const weatherCode = current.weather_code ?? 0;
      const isDay = Boolean(current.is_day ?? 1);

      const { kind, label } = parseWeatherKind(weatherCode, windSpeed, isDay);

      const highTemp = daily.temperature_2m_max?.[0] !== undefined ? Math.round(daily.temperature_2m_max[0]) : temp + 4;
      const lowTemp = daily.temperature_2m_min?.[0] !== undefined ? Math.round(daily.temperature_2m_min[0]) : temp - 5;

      // 3-day forecast
      const forecast: DayForecast[] = [];
      if (Array.isArray(daily.time)) {
        for (let i = 0; i < Math.min(daily.time.length, 3); i++) {
          const dateStr = daily.time[i];
          const d = new Date(dateStr);
          const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
          forecast.push({
            date: dateStr.slice(5),
            weekday: i === 0 ? "今天" : weekdays[d.getDay()],
            maxTemp: Math.round(daily.temperature_2m_max?.[i] ?? temp),
            minTemp: Math.round(daily.temperature_2m_min?.[i] ?? temp - 4),
            weatherCode: daily.weather_code?.[i] ?? 0,
            precipProb: daily.precipitation_probability_max?.[i] ?? 0,
          });
        }
      }

      return {
        cityId,
        cityName: city.name,
        provinceName: city.provinceId,
        temp,
        apparentTemp,
        humidity,
        windSpeed,
        precipitation,
        weatherCode,
        isDay,
        kind,
        label,
        highTemp,
        lowTemp,
        forecast,
        lastUpdated: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        loading: false,
      };
    } catch {
      // Graceful fallback with offline-friendly estimation
      const { kind, label } = parseWeatherKind(0, 10, true);
      return {
        cityId,
        cityName: city.name,
        provinceName: city.provinceId,
        temp: 22,
        apparentTemp: 22,
        humidity: 55,
        windSpeed: 10,
        precipitation: 0,
        weatherCode: 0,
        isDay: true,
        kind,
        label,
        highTemp: 26,
        lowTemp: 18,
        forecast: [
          { date: "今天", weekday: "今天", maxTemp: 26, minTemp: 18, weatherCode: 0, precipProb: 10 },
          { date: "明天", weekday: "明天", maxTemp: 25, minTemp: 17, weatherCode: 1, precipProb: 15 },
          { date: "后天", weekday: "后天", maxTemp: 24, minTemp: 16, weatherCode: 2, precipProb: 20 },
        ],
        lastUpdated: "离线预估",
        loading: false,
      };
    }
  }, []);

  // Fetch weather for all slots
  const reloadAllWeather = useCallback(async () => {
    setIsRefreshing(true);
    const results: Record<string, CityWeatherData> = {};

    await Promise.all(
      weatherCityIds.map(async (cid) => {
        if (!cid) return;
        const res = await fetchCityWeather(cid);
        if (res) results[cid] = res;
      }),
    );

    setWeatherMap(results);
    setLastSyncTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
    setIsRefreshing(false);
  }, [weatherCityIds, fetchCityWeather]);

  useEffect(() => {
    reloadAllWeather();
  }, [reloadAllWeather]);

  // Update a city slot
  const updateWeatherCity = (index: number, newCityId: string) => {
    if (!isAdmin) {
      setStatusMessage("请先在左下角解锁管理员模式以配置城市");
      setTimeout(() => setStatusMessage(""), 3000);
      return;
    }

    setAppSettings((current) => {
      const nextIds = [...(current.weatherCityIds ?? defaultWeatherCityIds)];
      nextIds[index] = newCityId;
      const nextSettings = { ...current, weatherCityIds: nextIds };
      writeAppSettings(nextSettings);
      setStatusMessage(`城市已更新为「${cities.find((c) => c.id === newCityId)?.name || newCityId}」，天气数据已刷新`);
      setTimeout(() => setStatusMessage(""), 3000);
      return nextSettings;
    });
  };

  // Distance calculations
  const distanceMetrics = useMemo(() => {
    const c1 = cities.find((c) => c.id === weatherCityIds[0]);
    const c2 = cities.find((c) => c.id === weatherCityIds[1]);
    const c3 = cities.find((c) => c.id === weatherCityIds[2]);

    const dist12 = c1 && c2 ? getDistanceKm(c1.lat, c1.lng, c2.lat, c2.lng) : null;
    const dist23 = c2 && c3 ? getDistanceKm(c2.lat, c2.lng, c3.lat, c3.lng) : null;
    const totalDist = (dist12 ?? 0) + (dist23 ?? 0);

    return { c1, c2, c3, dist12, dist23, totalDist };
  }, [weatherCityIds]);

  // Temperature comparison & care tips
  const careCompanion = useMemo(() => {
    const list = weatherCityIds
      .map((id) => weatherMap[id])
      .filter((w): w is CityWeatherData => Boolean(w));

    if (list.length === 0) return null;

    const temps = list.map((w) => w.temp);
    const maxT = Math.max(...temps);
    const minT = Math.min(...temps);
    const tempDiff = maxT - minT;

    const rainCities = list.filter((w) => ["rain", "light-rain", "heavy-rain", "thunder"].includes(w.kind));
    const coldCities = list.filter((w) => w.temp <= 12);
    const hotCities = list.filter((w) => w.temp >= 30);

    // Tips generator
    const tips: Array<{ icon: any; title: string; content: string; color: string }> = [];

    if (rainCities.length > 0) {
      const cityNames = rainCities.map((c) => c.cityName).join("、");
      tips.push({
        icon: Umbrella,
        title: "细雨轻落 · 随身带伞",
        content: `【${cityNames}】今天有雨水光顾，出门前别忘了轻声提醒TA带好雨伞，下雨天路滑，慢慢走。`,
        color: "text-[#A8C8DC]",
      });
    }

    if (tempDiff >= 8) {
      const warmest = list.find((c) => c.temp === maxT);
      const coldest = list.find((c) => c.temp === minT);
      tips.push({
        icon: Shirt,
        title: `双城温差 ${tempDiff}°C · 贴心添衣`,
        content: `【${coldest?.cityName}】仅 ${minT}°C，相较于【${warmest?.cityName}】(${maxT}°C) 寒凉许多。距离再远，也要记得提醒TA多披一件厚外套保暖。`,
        color: "text-[#E8B8C2]",
      });
    }

    if (coldCities.length > 0 && tempDiff < 8) {
      tips.push({
        icon: Thermometer,
        title: "微凉气候 · 注意防寒",
        content: "夜间气温较低，两地昼夜温差显著，注意关好门窗，喝杯温热的饮品。",
        color: "text-[#A8C8DC]",
      });
    }

    if (hotCities.length > 0) {
      tips.push({
        icon: Sun,
        title: "晴热气象 · 防暑补水",
        content: "气温较高，户外活动注意防晒防暑，多给TA发消息提醒多喝温水。",
        color: "text-[#F2A97F]",
      });
    }

    // Default romantic connection tip if all good
    if (tips.length === 0) {
      tips.push({
        icon: Heart,
        title: "同沐清风 · 晴空万里",
        content: "两座城市今日气候宜人。跨越千里的风拂过我的脸庞，也正轻柔吹向你。",
        color: "text-[#E8B8C2]",
      });
    }

    return { maxT, minT, tempDiff, tips };
  }, [weatherCityIds, weatherMap]);

  return (
    <MemoryPageShell active="weather">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full bg-[#D6E8F0]/80 text-[#A8C8DC] shadow-sm">
              <CloudSun className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight text-[#5A6670]">沿途天气与双城气象</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm font-medium text-[#5A6670]/60">
            实时连线你们相隔的城市与未来旅程，看同一片天空下的阴晴雨雪，让关怀跨越千里。
          </p>
        </div>

        {/* Refresh & sync status button */}
        <div className="flex items-center gap-2.5">
          {lastSyncTime && (
            <span className="text-[11px] text-[#5A6670]/50 hidden sm:inline">
              最近同步: {lastSyncTime}
            </span>
          )}
          <button
            type="button"
            onClick={reloadAllWeather}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-full border border-[#D8DDD8] bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-[#5A6670] shadow-2xs transition hover:border-[#A8C8DC] hover:text-[#A8C8DC] active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-[#A8C8DC]" : ""}`} />
            <span>{isRefreshing ? "刷新中..." : "刷新天气"}</span>
          </button>
        </div>
      </header>

      {/* Admin Status Alert */}
      {statusMessage && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 rounded-[12px] bg-[#FAFBF7] p-3 text-xs font-semibold text-[#A8C8DC] shadow-xs border border-[#D6E8F0] flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4 text-[#E8B8C2]" />
          <span>{statusMessage}</span>
        </motion.div>
      )}

      {/* ✈️ Multi-City Journey Connector & Distance Bridge (沿途旅程联动轨迹) */}
      <div className="mb-6 sm:mb-8 overflow-hidden rounded-[20px] border border-[#D8DDD8]/80 bg-gradient-to-r from-white via-[#FAFBF7] to-white p-4 sm:p-6 shadow-[0_12px_28px_rgba(90,102,112,0.06)] backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D8DDD8]/40 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-[#E8B8C2]/20 px-2.5 py-0.5 text-xs font-bold text-[#E8B8C2]">
              <Heart className="h-3.5 w-3.5 fill-[#E8B8C2]" />
              沿途心跳轨迹
            </span>
            <span className="text-xs text-[#5A6670]/60">
              跨越山海，情牵三城
            </span>
          </div>

          {/* Total Distance Tag */}
          {distanceMetrics.totalDist > 0 && (
            <div className="flex items-center gap-3 text-xs font-semibold text-[#5A6670]/80">
              <span className="rounded-full bg-[#FAFBF7] px-3 py-1 border border-[#D8DDD8]/60 shadow-2xs">
                沿途全线跨越：<strong className="text-[#E8B8C2] font-bold">{distanceMetrics.totalDist.toLocaleString()}</strong> 公里
              </span>
              {careCompanion && careCompanion.tempDiff > 0 && (
                <span className="rounded-full bg-[#FAFBF7] px-3 py-1 border border-[#D8DDD8]/60 shadow-2xs">
                  最大温差：<strong className="text-[#A8C8DC] font-bold">{careCompanion.tempDiff}°C</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Milestone Corridor Path */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {weatherCityIds.map((cid, idx) => {
            const city = cities.find((c) => c.id === cid);
            const weather = weatherMap[cid];
            const roleInfo = DEFAULT_SLOT_ROLES[idx] || DEFAULT_SLOT_ROLES[0];
            const nextDist = idx === 0 ? distanceMetrics.dist12 : idx === 1 ? distanceMetrics.dist23 : null;

            return (
              <div key={`corridor-${cid}-${idx}`} className="relative flex flex-col justify-between rounded-[14px] bg-white/70 p-3.5 border border-[#D8DDD8]/60 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#A8C8DC] uppercase tracking-wider">
                    {roleInfo.role}
                  </span>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#FAFBF7] text-[10px] font-bold text-[#5A6670]/60 border border-[#D8DDD8]/60">
                    {idx + 1}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#5A6670]">
                      {city?.name || cid || "待配置城市"}
                    </h3>
                    <p className="text-[10px] text-[#5A6670]/50">{roleInfo.subtitle}</p>
                  </div>
                  {weather && (
                    <div className="text-right">
                      <span className="text-xl font-extrabold text-[#5A6670]">{weather.temp}°</span>
                      <p className="text-[10px] font-semibold text-[#A8C8DC]">{weather.label}</p>
                    </div>
                  )}
                </div>

                {/* Connecting arrow with distance to next city (for desktop) */}
                {nextDist !== null && (
                  <div className="hidden md:flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 z-20">
                    <span className="flex items-center gap-0.5 rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-[#E8B8C2] shadow-sm border border-[#E8B8C2]/40 whitespace-nowrap">
                      {nextDist.toLocaleString()} km ➔
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 💌 Romantic Weather Companion & Care Tips (贴心关怀与天气备忘) */}
      {careCompanion && careCompanion.tips.length > 0 && (
        <div className="mb-6 sm:mb-8 grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {careCompanion.tips.map((tip, idx) => {
            const Icon = tip.icon;
            return (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-[16px] border border-[#E8B8C2]/40 bg-gradient-to-r from-white via-[#FFF9FA] to-[#FAFBF7] p-4 shadow-sm"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F5DCE0]/80 text-[#E8B8C2]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-[#5A6670] flex items-center gap-1.5">
                    <span>{tip.title}</span>
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-[#5A6670]/75">
                    {tip.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🌤️ 3 Distinct Weather Atmosphere Cards */}
      <div className="grid gap-5 md:grid-cols-3">
        {weatherCityIds.map((cityId, index) => {
          const city = cities.find((c) => c.id === cityId);
          const weather = weatherMap[cityId];
          const roleInfo = DEFAULT_SLOT_ROLES[index] || DEFAULT_SLOT_ROLES[0];
          const currentTab = activeTabMap[index] || "current";

          // Atmospheric styling based on weather kind
          const isNight = weather?.kind === "night-clear" || weather?.kind === "night-partly";
          const isRain = ["rain", "light-rain", "heavy-rain", "thunder"].includes(weather?.kind || "");
          const isSnow = weather?.kind === "snow";
          const isSunny = weather?.kind === "sunny";

          const cardTheme = isNight
            ? "border-[#A8C8DC]/60 bg-gradient-to-br from-[#1E2530] via-[#242D3A] to-[#1A202C] text-white shadow-[0_16px_36px_rgba(26,32,44,0.18)]"
            : isRain
            ? "border-[#A8C8DC]/50 bg-gradient-to-br from-[#EBF3F7] via-[#F4F9FB] to-[#FAFBF7] text-[#5A6670] shadow-[0_16px_36px_rgba(168,200,220,0.15)]"
            : isSnow
            ? "border-[#D8DDD8]/80 bg-gradient-to-br from-[#F5F8FA] via-white to-[#F0F4F8] text-[#5A6670] shadow-[0_16px_36px_rgba(90,102,112,0.08)]"
            : isSunny
            ? "border-[#F5DCE0]/80 bg-gradient-to-br from-[#FFF9FA] via-[#FAFBF7] to-[#FDF4F5] text-[#5A6670] shadow-[0_16px_36px_rgba(232,184,194,0.14)]"
            : "border-[#D8DDD8]/80 bg-gradient-to-br from-white via-[#FAFBF7] to-white text-[#5A6670] shadow-[0_16px_36px_rgba(90,102,112,0.08)]";

          return (
            <motion.div
              key={`weather-card-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              className={`relative flex flex-col justify-between overflow-hidden rounded-[20px] border p-5 sm:p-6 transition-all backdrop-blur ${cardTheme}`}
            >
              {/* Dynamic Atmospheric background animations */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[20px]">
                {isSunny && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                    className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-gradient-to-br from-[#FFB24A]/15 to-[#FFD88A]/5 blur-xl"
                  />
                )}
                {isNight && (
                  <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />
                )}
                {isRain && (
                  <motion.div
                    animate={{ y: [0, 20, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -right-6 -bottom-6 h-36 w-36 rounded-full bg-[#A8C8DC]/15 blur-2xl"
                  />
                )}
              </div>

              {/* Card Header: Slot role & City selector */}
              <div className="relative z-10">
                <div className="flex items-center justify-between border-b pb-3 mb-4 border-black/5 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold shadow-xs ${
                        isNight ? "bg-white/20 text-white" : "bg-white text-[#E8B8C2]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <span className={`text-xs font-bold ${isNight ? "text-white/90" : "text-[#5A6670]"}`}>
                        {roleInfo.role}
                      </span>
                    </div>
                  </div>

                  {/* Tab switch inside card */}
                  <div className="flex items-center gap-1 rounded-full bg-black/5 dark:bg-white/10 p-0.5 text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setActiveTabMap((p) => ({ ...p, [index]: "current" }))}
                      className={`rounded-full px-2 py-0.5 transition ${
                        currentTab === "current"
                          ? "bg-white text-[#5A6670] shadow-xs"
                          : "text-inherit opacity-60 hover:opacity-100"
                      }`}
                    >
                      实况
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTabMap((p) => ({ ...p, [index]: "forecast" }))}
                      className={`rounded-full px-2 py-0.5 transition ${
                        currentTab === "forecast"
                          ? "bg-white text-[#5A6670] shadow-xs"
                          : "text-inherit opacity-60 hover:opacity-100"
                      }`}
                    >
                      3天预报
                    </button>
                  </div>
                </div>

                {/* City Picker Bar */}
                <div className="mb-4">
                  <CitySearchSelect
                    value={cityId ?? ""}
                    onChange={(cid) => updateWeatherCity(index, cid)}
                    disabled={!isAdmin}
                    accent={index === 0 ? "pink" : "blue"}
                  />
                  {!isAdmin && (
                    <span className="mt-1 block text-[10px] text-[#5A6670]/40">
                      （管理员模式下可切换此槽位城市）
                    </span>
                  )}
                </div>

                {/* Main Weather Display Area */}
                {weather ? (
                  currentTab === "current" ? (
                    <div>
                      {/* Big Temp and Weather Icon */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl sm:text-5xl font-black tracking-tighter">
                              {weather.temp}°
                            </span>
                            <span className="text-xs font-semibold opacity-70">
                              C
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs font-medium opacity-80">
                            <span>体感 {weather.apparentTemp}°</span>
                            <span>•</span>
                            <span>{weather.lowTemp}° ~ {weather.highTemp}°</span>
                          </div>
                        </div>

                        {/* Animated Weather Art Icon */}
                        <div className="relative">
                          {isSunny ? (
                            <Sun className="h-14 w-14 text-[#FFB24A] animate-spin" style={{ animationDuration: "20s" }} />
                          ) : isNight ? (
                            <Moon className="h-12 w-12 text-[#E2E8F0]" />
                          ) : isRain ? (
                            <CloudRain className="h-12 w-12 text-[#A8C8DC]" />
                          ) : isSnow ? (
                            <CloudSnow className="h-12 w-12 text-[#A8C8DC]" />
                          ) : (
                            <Cloud className="h-12 w-12 text-[#A8C8DC]" />
                          )}
                        </div>
                      </div>

                      {/* Weather Label description pill */}
                      <div className="mt-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                          isNight ? "bg-white/15 text-white" : "bg-white/80 text-[#5A6670] shadow-xs"
                        }`}>
                          <Sparkles className="h-3 w-3 text-[#E8B8C2]" />
                          {weather.label}
                        </span>
                      </div>

                      {/* 3 Metrics: Humidity, Wind, Precip */}
                      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                        <div className={`rounded-xl p-2.5 ${isNight ? "bg-white/10" : "bg-white/60"} border border-black/5 dark:border-white/5`}>
                          <Droplets className="mx-auto h-4 w-4 opacity-60 mb-1" />
                          <span className="block text-[10px] opacity-60">湿度</span>
                          <span className="text-xs font-bold">{weather.humidity}%</span>
                        </div>
                        <div className={`rounded-xl p-2.5 ${isNight ? "bg-white/10" : "bg-white/60"} border border-black/5 dark:border-white/5`}>
                          <Wind className="mx-auto h-4 w-4 opacity-60 mb-1" />
                          <span className="block text-[10px] opacity-60">风速</span>
                          <span className="text-xs font-bold">{weather.windSpeed} km/h</span>
                        </div>
                        <div className={`rounded-xl p-2.5 ${isNight ? "bg-white/10" : "bg-white/60"} border border-black/5 dark:border-white/5`}>
                          <Umbrella className="mx-auto h-4 w-4 opacity-60 mb-1" />
                          <span className="block text-[10px] opacity-60">降水量</span>
                          <span className="text-xs font-bold">{weather.precipitation} mm</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* 3-Day Forecast Tab */
                    <div className="space-y-2 py-1">
                      <span className="text-[11px] font-bold opacity-60 block mb-2">
                        📅 近期 3 天气温与降雨预测
                      </span>
                      {weather.forecast.map((fc, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between rounded-xl p-2.5 text-xs font-medium ${
                            isNight ? "bg-white/10" : "bg-white/70"
                          } border border-black/5`}
                        >
                          <div className="w-14">
                            <span className="font-bold">{fc.weekday}</span>
                            <span className="block text-[10px] opacity-50">{fc.date}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            {fc.weatherCode === 0 ? (
                              <Sun className="h-4 w-4 text-[#FFB24A]" />
                            ) : [51, 61, 80].includes(fc.weatherCode) ? (
                              <CloudRain className="h-4 w-4 text-[#A8C8DC]" />
                            ) : (
                              <Cloud className="h-4 w-4 text-[#A8C8DC]" />
                            )}
                            {fc.precipProb > 20 && (
                              <span className="text-[10px] text-[#A8C8DC] font-bold">
                                {fc.precipProb}%雨
                              </span>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="font-bold">{fc.minTemp}° ~ {fc.maxTemp}°</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="py-8 text-center opacity-50 text-xs">
                    正在连线气象卫星...
                  </div>
                )}
              </div>

              {/* Card Footer: City coordinates & update time */}
              <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[10px] opacity-50">
                <span>坐标: {city ? `${city.lat.toFixed(1)}°N, ${city.lng.toFixed(1)}°E` : "--"}</span>
                <span>{weather?.lastUpdated ? `更新于 ${weather.lastUpdated}` : "实时连线"}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </MemoryPageShell>
  );
}
