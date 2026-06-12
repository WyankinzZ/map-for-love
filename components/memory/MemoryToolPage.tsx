"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cities } from '@/data/cities';
import { MemoryPageShell } from '@/components/MemoryNav';
import { spring } from '@/components/province/Shared';
import { useAdminMode } from '@/hooks/useAdminMode';
import { type ToolConfig, type StoredItem, readItems, writeItems, daysUntil } from './Shared';

export default function MemoryToolPage({ config }: Readonly<{ config: ToolConfig }>) {
  const Icon = config.icon;
  const isAdmin = useAdminMode();
  const [items, setItems] = useState<StoredItem[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [cityId, setCityId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCityDropdownOpen(false);
        if (cityId) {
          const matchedCity = cities.find((c) => c.id === cityId);
          if (matchedCity) setCitySearch(matchedCity.name);
        } else {
          setCitySearch("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [cityId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(readItems(config.storageKey));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [config.storageKey]);

  const cityOptions = useMemo(() => cities.slice().sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN")), []);
  const canSave = title.trim().length > 0;

  const resetForm = () => {
    setTitle("");
    setDate("");
    setNote("");
    setEditingId("");
    setCityId("");
    setCitySearch("");
    setIsFormOpen(false);
  };

  const save = () => {
    if (!isAdmin) return;
    if (!canSave) return;

    const item = {
      id: editingId || `${config.kind}-${Date.now()}`,
      title: title.trim(),
      date: date.trim(),
      note: note.trim(),
      cityId: config.kind === "favorite" ? cityId : undefined,
    };
    const nextItems = editingId
      ? items.map((current) => (current.id === editingId ? item : current))
      : [item, ...items];

    setItems(nextItems);
    writeItems(config.storageKey, nextItems);
    resetForm();
  };

  const startEdit = (item: StoredItem) => {
    if (!isAdmin) return;
    setEditingId(item.id);
    setTitle(item.title);
    setDate(item.date ?? "");
    setNote(item.note);
    if (item.cityId) {
      setCityId(item.cityId);
      const matchedCity = cities.find((c) => c.id === item.cityId);
      if (matchedCity) setCitySearch(matchedCity.name);
    } else {
      setCityId("");
      setCitySearch("");
    }
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = (id: string) => {
    if (!isAdmin) return;
    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);
    writeItems(config.storageKey, nextItems);
    if (editingId === id) resetForm();
  };

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const paginatedItems = items.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  return (
    <MemoryPageShell active={config.active}>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <Icon className="h-8 w-8 fill-[#F5DCE0] text-[#E8B8C2]" />
            <h1 className="text-[34px] font-semibold leading-tight text-[#5A6670]">{config.title}</h1>
          </div>
          <p className="mt-2 text-sm font-medium text-[#5A6670]/58">{config.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/72 px-4 py-2 text-sm font-semibold text-[#5A6670]/62 shadow-[0_8px_24px_rgba(90,102,112,0.08)] backdrop-blur">
            {items.length} 条
          </div>
          <button
            className="flex items-center gap-1.5 rounded-[8px] bg-[#E8B8C2] px-4 py-2.5 text-sm font-semibold text-[#FAFBF7] shadow-[0_6px_14px_rgba(232,184,194,0.32)] transition hover:bg-[#D6A6B0] disabled:opacity-50"
            onClick={() => {
              if (isFormOpen && editingId) {
                resetForm();
              }
              setIsFormOpen(true);
            }}
            disabled={!isAdmin}
          >
            <Plus className="h-4 w-4" />
            新增记录
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#5A6670]/20 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg rounded-[16px] bg-white p-7 shadow-[0_20px_60px_rgba(90,102,112,0.12)]"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[#5A6670]">{editingId ? "编辑记录" : "新增记录"}</h2>
                <button
                  onClick={resetForm}
                  className="grid h-8 w-8 place-items-center rounded-full text-[#5A6670]/40 transition hover:bg-[#FAFBF7] hover:text-[#5A6670]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#5A6670]/80">
                    {config.kind === "favorite" ? "想去的地方" : "标题"}
                  </label>
                  <input
                    className="w-full rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] px-4 py-2.5 text-sm outline-none transition focus:border-[#E8B8C2] focus:bg-white"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="输入名称..."
                    disabled={!isAdmin}
                  />
                </div>

                {config.kind === "favorite" && (
                  <div className="relative" ref={dropdownRef}>
                    <label className="mb-1.5 block text-sm font-medium text-[#5A6670]/80">所属城市</label>
                    <div
                      className={`flex w-full items-center justify-between rounded-[8px] border ${isCityDropdownOpen ? 'border-[#E8B8C2] bg-white' : 'border-[#D8DDD8] bg-[#FAFBF7]'} px-4 py-2.5 text-sm outline-none transition`}
                    >
                      <input
                        className="w-full bg-transparent outline-none text-[#5A6670] placeholder-[#5A6670]/40"
                        placeholder="搜索或选择城市..."
                        value={citySearch}
                        onChange={(e) => {
                          setCitySearch(e.target.value);
                          if (!isCityDropdownOpen) setIsCityDropdownOpen(true);
                        }}
                        onFocus={() => {
                          if (isAdmin) setIsCityDropdownOpen(true);
                        }}
                        disabled={!isAdmin}
                      />
                      <ChevronDown 
                        className={`h-4 w-4 shrink-0 text-[#5A6670]/40 transition-transform cursor-pointer ${isCityDropdownOpen ? 'rotate-180' : ''}`} 
                        onClick={() => {
                          if (isAdmin) setIsCityDropdownOpen(!isCityDropdownOpen);
                        }}
                      />
                    </div>
                    {isCityDropdownOpen && (
                      <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-[8px] border border-[#D8DDD8] bg-white py-1.5 shadow-xl">
                        {cityOptions.filter(c => c.name.includes(citySearch)).map((city) => (
                          <div
                            key={city.id}
                            className={`cursor-pointer px-4 py-2 text-sm transition hover:bg-[#F5DCE0]/30 ${city.id === cityId ? 'bg-[#F5DCE0]/50 font-semibold text-[#E8B8C2]' : 'text-[#5A6670]'}`}
                            onClick={() => {
                              setCityId(city.id);
                              setCitySearch(city.name);
                              setIsCityDropdownOpen(false);
                            }}
                          >
                            {city.name}
                          </div>
                        ))}
                        {cityOptions.filter(c => c.name.includes(citySearch)).length === 0 && (
                          <div className="px-4 py-4 text-center text-sm text-[#5A6670]/40">
                            未找到相关城市
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {config.kind !== "favorite" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#5A6670]/80">日期</label>
                    <input
                      type="date"
                      className="w-full rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] px-4 py-2.5 text-sm outline-none transition focus:border-[#E8B8C2] focus:bg-white [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-80"
                      value={date.replace(/\./g, "-")}
                      onChange={(event) => setDate(event.target.value.replace(/-/g, "."))}
                      disabled={!isAdmin}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#5A6670]/80">备注</label>
                  <textarea
                    className="w-full resize-none rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-[#E8B8C2] focus:bg-white"
                    rows={4}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={config.kind === "trip" ? "写一点对这次旅行的期待或计划……" : "写一点关于这天的回忆……"}
                    disabled={!isAdmin}
                  />
                </div>
              </div>

              <div className="mt-8 flex items-center justify-end gap-3 border-t border-[#D8DDD8]/40 pt-5">
                <button
                  className="rounded-[8px] px-5 py-2.5 text-sm font-semibold text-[#5A6670]/60 transition hover:bg-[#FAFBF7] hover:text-[#5A6670]"
                  type="button"
                  onClick={resetForm}
                >
                  取消
                </button>
                <button
                  className="rounded-[8px] bg-[#E8B8C2] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#D6A6B0] disabled:opacity-40"
                  type="button"
                  onClick={save}
                  disabled={!isAdmin || !canSave}
                >
                  {editingId ? "保存修改" : "确认新增"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {paginatedItems.map((item) => {
          const city = cities.find((candidate) => candidate.id === item.cityId);
          const leftDays = daysUntil(item.date);

          return (
            <article
              key={item.id}
              className="group relative flex flex-col overflow-hidden rounded-[12px] border border-[#D8DDD8]/70 bg-gradient-to-br from-[#FAFBF7]/80 to-white/60 p-6 shadow-sm transition-all hover:shadow-[0_16px_36px_rgba(90,102,112,0.08)] backdrop-blur"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold text-[#5A6670]">{item.title}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {city && <p className="text-sm font-medium text-[#A8C8DC]">{city.name}</p>}
                    {item.date && <p className="text-sm text-[#5A6670]/54">{item.date}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    className="grid h-8 w-8 place-items-center rounded-[6px] text-[#5A6670]/42 transition hover:bg-[#D6E8F0]/34 hover:text-[#A8C8DC]"
                    type="button"
                    onClick={() => startEdit(item)}
                    aria-label="编辑"
                    disabled={!isAdmin}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-[6px] text-[#5A6670]/42 transition hover:bg-[#F5DCE0]/45 hover:text-[#E8B8C2]"
                    type="button"
                    onClick={() => remove(item.id)}
                    aria-label="删除"
                    disabled={!isAdmin}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              {leftDays !== null && (
                <div className="mt-4 self-start rounded-full bg-[#F5DCE0]/50 px-3 py-1 text-[13px] font-semibold text-[#E8B8C2]">
                  {leftDays >= 0 ? `还有 ${leftDays} 天` : `已经过去 ${Math.abs(leftDays)} 天`}
                </div>
              )}
              
              {item.note && (
                <p className="mt-4 text-sm leading-relaxed text-[#5A6670]/70 whitespace-pre-wrap border-t border-[#D8DDD8]/40 pt-4 flex-1">
                  {item.note}
                </p>
              )}
            </article>
          );
        })}
        {items.length === 0 && !isFormOpen && (
          <div className="col-span-full py-20 text-center text-sm text-[#5A6670]/54">
            这里还空着，点击右上方按钮新增一条吧。
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-[8px] border border-[#D8DDD8] px-4 py-2 text-sm text-[#5A6670]/70 transition hover:bg-white disabled:opacity-30"
          >
            上一页
          </button>
          <span className="px-3 text-sm font-medium text-[#5A6670]/60">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-[8px] border border-[#D8DDD8] px-4 py-2 text-sm text-[#5A6670]/70 transition hover:bg-white disabled:opacity-30"
          >
            下一页
          </button>
        </div>
      )}
    </MemoryPageShell>
  );
}
