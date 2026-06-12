"use client";

import { useState, useEffect } from 'react';
import { CloudSun, ChevronDown, Save } from 'lucide-react';
import { MemoryPageShell } from '@/components/MemoryNav';
import { useAdminMode } from '@/hooks/useAdminMode';
import { cities } from '@/data/cities';
import {
  readAppSettings,
  writeAppSettings,
  defaultWeatherCityIds,
  maxWeatherCities,
  type AppSettings,
} from '@/data/appSettings';

export default function WeatherPage() {
  const isAdmin = useAdminMode();
  const [appSettings, setAppSettings] = useState<AppSettings>({});
  const [status, setStatus] = useState("");
  
  const [weatherSearches, setWeatherSearches] = useState<string[]>(Array(maxWeatherCities).fill(""));
  const [weatherDropdowns, setWeatherDropdowns] = useState<boolean[]>(Array(maxWeatherCities).fill(false));

  useEffect(() => {
    const settings = readAppSettings();
    setAppSettings(settings);
  }, []);

  useEffect(() => {
    const ids = appSettings.weatherCityIds ?? defaultWeatherCityIds;
    setWeatherSearches(ids.map(id => {
      if (!id) return "";
      return cities.find(c => c.id === id)?.name ?? "";
    }));
  }, [appSettings.weatherCityIds]);

  const updateWeatherCity = (index: number, cityId: string) => {
    if (!isAdmin) {
      setStatus("请先进入管理员模式");
      return;
    }

    setAppSettings((current) => {
      const nextIds = [...(current.weatherCityIds ?? defaultWeatherCityIds)];
      nextIds[index] = cityId;
      const nextSettings = { ...current, weatherCityIds: nextIds };
      writeAppSettings(nextSettings);
      setStatus("城市更新成功，首页天气已刷新");
      return nextSettings;
    });
  };

  const weatherCityIds = appSettings.weatherCityIds ?? defaultWeatherCityIds;

  return (
    <MemoryPageShell active="weather">
      <header>
        <div className="flex items-center gap-3">
          <CloudSun className="h-8 w-8 text-[#A8C8DC]" />
          <h1 className="text-[34px] font-semibold leading-tight text-[#5A6670]">沿途天气</h1>
        </div>
        <p className="mt-2 text-sm font-medium text-[#5A6670]/58">
          配置首页顶部卡片显示的城市天气，最多可以设置 {maxWeatherCities} 个。
        </p>
      </header>

      {status && (
        <div className="mt-4 rounded-[8px] bg-[#FAFBF7]/80 p-3 text-sm font-semibold text-[#A8C8DC] shadow-sm backdrop-blur">
          {status}
        </div>
      )}

      <div className="mt-8 rounded-[8px] border border-[#D8DDD8]/78 bg-[#FAFBF7]/76 p-6 shadow-[0_12px_28px_rgba(90,102,112,0.06)]">
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: maxWeatherCities }).map((_, index) => {
            const isOpen = weatherDropdowns[index];
            const search = weatherSearches[index];
            const filteredCities = cities.filter(c => c.name.includes(search));

            return (
              <div key={`weather-slot-${index}`} className="relative">
                <div className="mb-2 text-xs font-semibold text-[#5A6670]/50">城市 {index + 1}</div>
                <div
                  className={`flex h-12 w-full items-center justify-between rounded-[7px] border ${isOpen ? 'border-[#A8C8DC] bg-white shadow-[0_4px_12px_rgba(168,200,220,0.15)]' : 'border-[#D8DDD8]/80 bg-[#FAFBF7]/70'} px-4 text-sm transition`}
                >
                  <input
                    className="w-full bg-transparent outline-none text-[#5A6670] placeholder-[#5A6670]/40 font-medium"
                    placeholder="搜索或选择城市..."
                    value={search}
                    onChange={(e) => {
                      const val = e.target.value;
                      setWeatherSearches(prev => {
                        const next = [...prev];
                        next[index] = val;
                        return next;
                      });
                      if (!isOpen) {
                        setWeatherDropdowns(prev => {
                          const next = [...prev];
                          next[index] = true;
                          return next;
                        });
                      }
                    }}
                    onFocus={() => {
                      if (isAdmin) {
                        setWeatherDropdowns(prev => {
                          const next = [...prev];
                          next[index] = true;
                          return next;
                        });
                      }
                    }}
                    disabled={!isAdmin}
                  />
                  <ChevronDown 
                    className={`h-4 w-4 shrink-0 text-[#5A6670]/40 transition-transform cursor-pointer ${isOpen ? 'rotate-180' : ''}`} 
                    onClick={() => {
                      if (isAdmin) {
                        setWeatherDropdowns(prev => {
                          const next = [...prev];
                          next[index] = !next[index];
                          return next;
                        });
                      }
                    }}
                  />
                </div>
                
                {isOpen && (
                  <div className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-[8px] border border-[#D8DDD8]/80 bg-white py-1.5 shadow-[0_12px_34px_rgba(90,102,112,0.12)]">
                    {filteredCities.map((city) => (
                      <div
                        key={city.id}
                        className={`cursor-pointer px-4 py-2.5 text-sm transition hover:bg-[#D6E8F0]/30 ${city.id === weatherCityIds[index] ? 'bg-[#D6E8F0]/50 font-semibold text-[#A8C8DC]' : 'text-[#5A6670] font-medium'}`}
                        onClick={() => {
                          updateWeatherCity(index, city.id);
                          setWeatherSearches(prev => {
                            const next = [...prev];
                            next[index] = city.name;
                            return next;
                          });
                          setWeatherDropdowns(prev => {
                            const next = [...prev];
                            next[index] = false;
                            return next;
                          });
                        }}
                      >
                        {city.name}
                      </div>
                    ))}
                    {filteredCities.length === 0 && (
                      <div className="px-4 py-4 text-center text-sm font-medium text-[#5A6670]/40">
                        未找到相关城市
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </MemoryPageShell>
  );
}
