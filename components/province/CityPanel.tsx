"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Maximize2, Minimize2, Pencil, Plus, Trash2, X } from "lucide-react";
import { type City } from "@/data/cities";
import { type Memory, sortMemoriesByTime, getLatestMemory, type MemoryMood, moodConfig } from "@/data/memories";
import { type LocalMemoryStore } from "@/data/progress";
import { MemoryImage } from "./MemoryImage";
import { readCompressedImageDataUrl } from "@/utils/imageUtils";
import { 
  type CardAnchor, type PhotoDraft, type MemoryPanelTab,
  spring, memoryTextMaxLength, maxPhotosPerMemory, memoryPhotoMaxDimension, memoryPhotoQuality,
  revokePhotoDrafts, photosOfMemory, normalizeMemoryDate 
} from "./Shared";
import { LocalPrivacyImg } from "@/components/LocalPrivacyImage";

export default function CityPanel({
  city,
  localMemories,
  isLit,
  anchor,
  isAdmin,
  onClose,
  onSave,
  onSetCover,
  onUpdate,
  onDelete,
  landmarkImage,
}: Readonly<{
  city: City;
  localMemories: Memory[];
  isLit: boolean;
  anchor: CardAnchor | null;
  isAdmin: boolean;
  onClose: () => void;
  onSave: (cityId: string, memory: Memory) => Promise<void>;
  onSetCover: (cityId: string, memoryId: string, coverImage: string) => Promise<void>;
  onUpdate: (cityId: string, memoryId: string, memory: Memory) => Promise<void>;
  onDelete: (cityId: string, memoryId: string) => Promise<void>;
  landmarkImage: string;
}>) {
  const defaultMemory = isLit ? getLatestMemory(city.id) : undefined;
  const memories = sortMemoriesByTime(
    [
      ...localMemories,
      ...(defaultMemory && !localMemories.some((item) => item.id === defaultMemory.id)
        ? [defaultMemory]
        : []),
    ],
  );
  const memory = memories[0];
  const memoryPhotos = photosOfMemory(memory);
  const galleryPhotos = Array.from(new Set(memories.flatMap((item) => photosOfMemory(item))));
  const localMemoryIds = useMemo(
    () => new Set(localMemories.map((item) => item.id)),
    [localMemories],
  );
  const [formOpen, setFormOpen] = useState(!isLit && isAdmin);
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [mood, setMood] = useState<MemoryMood | undefined>();
  const [photoDrafts, setPhotoDrafts] = useState<PhotoDraft[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [coverError, setCoverError] = useState("");
  const [settingCover, setSettingCover] = useState("");
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [deletingMemoryId, setDeletingMemoryId] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<MemoryPanelTab>("memory");
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const photoDraftsRef = useRef<PhotoDraft[]>([]);
  const photoReadTokenRef = useRef(0);
  const mountedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedDate = date.trim();
  const trimmedText = text.trim();
  const normalizedDate = normalizeMemoryDate(trimmedDate);
  const dateInvalid = trimmedDate.length > 0 && !normalizedDate;
  const canSave =
    isAdmin &&
    Boolean(normalizedDate) &&
    trimmedText.length > 0 &&
    !isReadingPhoto &&
    !photoError &&
    !isSaving;
  const isEditing = Boolean(editingMemory);
  const showMemory = (!expanded || activeTab === "memory") && !formOpen;
  const showGallery = expanded && activeTab === "gallery" && !formOpen;
  const showHistory = (!expanded || activeTab === "history") && memories.length > 0 && !formOpen;

  const resetForm = (revokePhoto: boolean) => {
    photoReadTokenRef.current += 1;
    setDate("");
    setText("");
    setMood(undefined);
    setPhotoError("");
    setSaveError("");
    setCoverError("");
    setDeleteError("");
    setIsReadingPhoto(false);
    setEditingMemory(null);
    if (revokePhoto) revokePhotoDrafts(photoDraftsRef.current);
    photoDraftsRef.current = [];
    setPhotoDrafts([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startEdit = (record: Memory) => {
    if (!isAdmin) return;

    photoReadTokenRef.current += 1;
    revokePhotoDrafts(photoDraftsRef.current);
    photoDraftsRef.current = [];
    setPhotoDrafts([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setDate(record.date);
    setText(record.text);
    setMood(record.mood);
    setPhotoError("");
    setSaveError("");
    setCoverError("");
    setDeleteError("");
    setEditingMemory(record);
    setFormOpen(true);
    setActiveTab("memory");
  };

  const handleDelete = async (record: Memory) => {
    if (!isAdmin) {
      setDeleteError("请先进入管理员模式");
      return;
    }

    if (deletingMemoryId) return;
    const confirmed = window.confirm(`确定删除 ${record.city} ${record.date} 的这条回忆吗？`);
    if (!confirmed) return;

    setDeletingMemoryId(record.id);
    setDeleteError("");

    try {
      await onDelete(city.id, record.id);
      if (editingMemory?.id === record.id) resetForm(true);
    } catch {
      setDeleteError("删除失败，请稍后再试");
    } finally {
      if (mountedRef.current) setDeletingMemoryId("");
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      photoReadTokenRef.current += 1;
      revokePhotoDrafts(photoDraftsRef.current);
    };
  }, []);

  const handlePickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      event.target.value = "";
      setPhotoError("请先进入管理员模式");
      return;
    }

    const files = Array.from(event.target.files ?? [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, maxPhotosPerMemory);
    if (files.length === 0) return;

    const readToken = photoReadTokenRef.current + 1;
    photoReadTokenRef.current = readToken;
    revokePhotoDrafts(photoDraftsRef.current);
    const nextPhotoDrafts = files.map((file) => ({
      previewUrl: URL.createObjectURL(file),
      dataUrl: null,
      name: file.name,
    }));

    photoDraftsRef.current = nextPhotoDrafts;
    setPhotoDrafts(nextPhotoDrafts);
    setPhotoError("");
    setSaveError("");
    setIsReadingPhoto(true);

    try {
      const dataUrls = await Promise.all(
        files.map((file) =>
          readCompressedImageDataUrl(file, {
            maxDimension: memoryPhotoMaxDimension,
            quality: memoryPhotoQuality,
          }),
        ),
      );
      if (!mountedRef.current || photoReadTokenRef.current !== readToken) return;
      const nextReadyDrafts = nextPhotoDrafts.map((photo, index) => ({
        ...photo,
        dataUrl: dataUrls[index],
      }));
      photoDraftsRef.current = nextReadyDrafts;
      setPhotoDrafts(nextReadyDrafts);
    } catch {
      if (!mountedRef.current || photoReadTokenRef.current !== readToken) return;
      setPhotoError("图片读取失败，请重新选择");
    } finally {
      if (mountedRef.current && photoReadTokenRef.current === readToken) setIsReadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      setSaveError("请先进入管理员模式");
      return;
    }
    if (!canSave) return;
    if (!normalizedDate) return;
    setIsSaving(true);
    setSaveError("");

    try {
      const photos = photoDrafts.map((photo) => photo.dataUrl).filter((photo): photo is string => Boolean(photo));

      const nextPhotos = photos.length > 0 ? photos : editingMemory?.photos ?? [editingMemory?.image ?? landmarkImage];
      const nextMemory: Memory = {
        id: editingMemory?.id ?? `${city.id}-local`,
        cityId: city.id,
        city: city.name,
        cityEn: city.nameEn,
        date: normalizedDate,
        image: editingMemory && photos.length === 0 ? editingMemory.image : nextPhotos[0],
        photos: nextPhotos,
        text: trimmedText,
        createdAt: editingMemory?.createdAt,
        mood: mood,
      };

      if (editingMemory) await onUpdate(city.id, editingMemory.id, nextMemory);
      else await onSave(city.id, {
        id: `${city.id}-local`,
        cityId: city.id,
        city: city.name,
        cityEn: city.nameEn,
        date: normalizedDate,
        image: photos[0] ?? landmarkImage,
        photos: photos.length > 0 ? photos : [landmarkImage],
        text: trimmedText,
        mood: mood,
      });
      resetForm(true);
      setFormOpen(false);
    } catch {
      setSaveError("保存失败，请稍后再试");
    } finally {
      if (mountedRef.current) setIsSaving(false);
    }
  };

  const handleSetCover = async (photo: string) => {
    if (!isAdmin) {
      setCoverError("请先进入管理员模式");
      return;
    }

    if (!memory || memory.image === photo || settingCover) return;
    setSettingCover(photo);
    setCoverError("");

    try {
      await onSetCover(city.id, memory.id, photo);
    } catch {
      setCoverError("封面保存失败，请稍后再试");
    } finally {
      if (mountedRef.current) setSettingCover("");
    }
  };

  return (
    <motion.article
      className={`absolute z-50 overflow-y-auto rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7]/94 text-[#5A6670] shadow-[0_18px_42px_rgba(90,102,112,0.18)] backdrop-blur ${
        expanded
          ? "max-h-[min(720px,calc(100vh-92px))] w-[390px] p-6"
          : "max-h-[min(620px,calc(100vh-110px))] w-[292px] p-5"
      }`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      style={
        expanded
          ? { right: 0, top: 12 }
          : {
              left: anchor ? anchor.x : 24,
              top: anchor ? anchor.y : "50%",
            }
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <span className={`h-3 w-3 rounded-sm ${isLit ? "bg-[#E8B8C2]" : "bg-[#D8DDD8]"}`} />
            {city.name}
            <span className="text-sm font-normal text-[#5A6670]/62">{city.nameEn}</span>
          </h2>
          <p className="mt-3 text-sm text-[#5A6670]/76">
            {memory?.date ?? "添加回忆后点亮"}
          </p>
          {!isAdmin && (
            <p className="mt-2 text-xs font-semibold text-[#5A6670]/42">管理员锁定，无法修改回忆</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="grid h-8 w-8 place-items-center rounded-[6px] text-[#5A6670]/62 transition hover:bg-[#D6E8F0]/32 hover:text-[#A8C8DC]"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "收起城市记录面板" : "展开城市记录面板"}
            type="button"
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            className="grid h-8 w-8 place-items-center rounded-[6px] text-[#5A6670]/62 transition hover:bg-[#D8DDD8]/28 hover:text-[#5A6670]"
            onClick={onClose}
            aria-label="关闭回忆卡片"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 flex rounded-[8px] border border-[#D8DDD8]/72 bg-[#FAFBF7]/72 p-1 text-xs font-semibold text-[#5A6670]/58">
          {([
            ["memory", "回忆"],
            ["gallery", "相册"],
            ["history", "历史"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              className={`flex-1 rounded-[7px] px-3 py-2 text-center transition ${
                activeTab === tab ? "bg-[#F5DCE0] text-[#E8B8C2]" : "hover:bg-[#D6E8F0]/30"
              }`}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {showMemory && (
        <>
          <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-[6px] border border-[#D8DDD8] bg-[#D6E8F0]">
            <MemoryImage
              src={memory?.image ?? landmarkImage}
              alt={`${city.name} memory`}
              dim={!isLit}
              fit={memory ? "cover" : "contain"}
            />
            {memoryPhotos.length > 1 && (
              <span className="absolute bottom-2 right-2 rounded-[6px] bg-[#FAFBF7]/86 px-2 py-1 text-xs font-medium text-[#5A6670]/78 shadow-[0_6px_14px_rgba(90,102,112,0.12)]">
                {memoryPhotos.length} photos
              </span>
            )}
          </div>

          {memoryPhotos.length > 1 && (
            <div className={`mt-3 grid gap-2 ${expanded ? "grid-cols-5" : "grid-cols-4"}`}>
              {memoryPhotos.map((photo, index) => {
                const isCover = memory?.image === photo;

                return (
                  <button
                    key={`${memory?.id ?? city.id}-photo-${index}`}
                    className={`group relative aspect-square overflow-hidden rounded-[4px] border bg-[#D6E8F0] transition ${
                      isCover
                        ? "border-[#E8B8C2] shadow-[0_0_0_2px_rgba(245,220,224,0.75)]"
                        : "border-[#D8DDD8] hover:border-[#E8B8C2]"
                    }`}
                    type="button"
                    onClick={() => handleSetCover(photo)}
                    aria-label={isCover ? "当前封面" : `将第 ${index + 1} 张照片设为封面`}
                    disabled={!isAdmin || isCover || Boolean(settingCover)}
                  >
                    <MemoryImage src={photo} alt={`${city.name} memory photo ${index + 1}`} fit="cover" />
                    <span
                      className={`absolute inset-x-1 bottom-1 rounded-[4px] bg-[#FAFBF7]/90 px-1.5 py-1 text-[10px] font-medium shadow-[0_4px_10px_rgba(90,102,112,0.10)] transition ${
                        isCover
                          ? "text-[#E8B8C2] opacity-100"
                          : "text-[#5A6670]/68 opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {isCover ? "封面" : settingCover === photo ? "保存中" : "设封面"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {coverError && <p className="mt-2 text-xs text-[#E8B8C2]">{coverError}</p>}

          <p className="mt-4 text-sm leading-6 text-[#5A6670]/82">
            {memory?.text ?? "写下第一段回忆后，这座城市会被点亮。"}
          </p>
          {memory && localMemoryIds.has(memory.id) && (
            <div className="mt-4 flex gap-2">
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-[#D8DDD8] px-3 py-2 text-xs font-medium text-[#5A6670]/70 transition hover:border-[#A8C8DC] hover:text-[#A8C8DC]"
                type="button"
                onClick={() => startEdit(memory)}
                disabled={!isAdmin}
              >
                <Pencil className="h-3.5 w-3.5" />
                编辑
              </button>
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-[#F5DCE0] px-3 py-2 text-xs font-medium text-[#E8B8C2] transition hover:bg-[#F5DCE0]/55 disabled:opacity-45"
                type="button"
                onClick={() => handleDelete(memory)}
                disabled={!isAdmin || deletingMemoryId === memory.id}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deletingMemoryId === memory.id ? "删除中" : "删除"}
              </button>
            </div>
          )}
          {deleteError && <p className="mt-2 text-xs text-[#E8B8C2]">{deleteError}</p>}
        </>
      )}

      {showGallery && (
        <div className="mt-4">
          {galleryPhotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {galleryPhotos.map((photo, index) => (
                <span
                  key={`${city.id}-gallery-photo-${index}`}
                  className="relative aspect-square overflow-hidden rounded-[5px] border border-[#D8DDD8] bg-[#D6E8F0]"
                >
                  <MemoryImage src={photo} alt={`${city.name} gallery photo ${index + 1}`} fit="cover" />
                </span>
              ))}
            </div>
          ) : (
            <p className="rounded-[7px] border border-dashed border-[#D8DDD8] px-4 py-6 text-center text-sm text-[#5A6670]/56">
              还没有照片，添加第一段回忆后会出现在这里。
            </p>
          )}
        </div>
      )}

      {showHistory && (
        <div className="mt-4 border-t border-dashed border-[#D8DDD8] pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold text-[#5A6670]/70">历史记录</p>
            <span className="text-[11px] text-[#5A6670]/42">{memories.length} 条</span>
          </div>
          <div className={`mt-3 ${expanded ? "space-y-4" : "space-y-3"}`}>
            {memories.map((record, recordIndex) => {
              const recordPhotos = photosOfMemory(record);
              const editable = localMemoryIds.has(record.id);

              return (
                <article
                  key={record.id}
                  className="rounded-[7px] border border-[#D8DDD8]/70 bg-[#FAFBF7]/72 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-[#5A6670]/70">{record.date}</p>
                    <div className="flex items-center gap-1.5">
                      {recordIndex === 0 && (
                        <span className="rounded-full bg-[#F5DCE0]/82 px-2 py-0.5 text-[10px] font-medium text-[#E8B8C2]">
                          最新
                        </span>
                      )}
                      {editable ? (
                        <>
                          <button
                            className="grid h-6 w-6 place-items-center rounded-[5px] text-[#5A6670]/46 transition hover:bg-[#D6E8F0]/34 hover:text-[#A8C8DC]"
                            type="button"
                            onClick={() => startEdit(record)}
                            disabled={!isAdmin}
                            aria-label={`编辑 ${record.city} ${record.date} 回忆`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="grid h-6 w-6 place-items-center rounded-[5px] text-[#5A6670]/46 transition hover:bg-[#F5DCE0]/46 hover:text-[#E8B8C2] disabled:opacity-40"
                            type="button"
                            onClick={() => handleDelete(record)}
                            disabled={!isAdmin || deletingMemoryId === record.id}
                            aria-label={`删除 ${record.city} ${record.date} 回忆`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-[#5A6670]/36">示例</span>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#5A6670]/72">{record.text}</p>
                  {recordPhotos.length > 0 && (
                    <div className={`mt-3 grid gap-1.5 ${expanded ? "grid-cols-6" : "grid-cols-5"}`}>
                      {recordPhotos.slice(0, expanded ? 12 : 10).map((photo, photoIndex) => (
                        <span
                          key={`${record.id}-timeline-photo-${photoIndex}`}
                          className="relative aspect-square overflow-hidden rounded-[4px] border border-[#D8DDD8] bg-[#D6E8F0]"
                        >
                          <MemoryImage
                            src={photo}
                            alt={`${city.name} history photo ${photoIndex + 1}`}
                            fit="cover"
                          />
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {showMemory && !formOpen && (
        <button
          className="mt-4 flex w-full items-center gap-2 border-t border-dashed border-[#D8DDD8] pt-4 text-sm font-medium text-[#5A6670]/78 transition hover:text-[#A8C8DC]"
          type="button"
          onClick={() => setFormOpen(true)}
          disabled={!isAdmin}
        >
          <Plus className="h-4 w-4" />
          {isLit ? "Add memory" : "Add memory to light"}
        </button>
      )}

      <AnimatePresence initial={false}>
        {formOpen && (
          <motion.div
            key="memory-form"
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
          >
            <div className="mt-4 space-y-3 border-t border-dashed border-[#D8DDD8] pt-4">
              <label className="block">
                <span className="text-xs font-medium text-[#5A6670]/70">日期</span>
                <input
                  className="mt-1.5 w-full rounded-[6px] border border-[#D8DDD8] bg-[#FAFBF7] px-3 py-2 text-sm text-[#5A6670] placeholder:text-[#5A6670]/40 outline-none transition focus:border-[#E8B8C2] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:transition"
                  type="date"
                  value={date ? date.replace(/\./g, "-") : ""}
                  onChange={(event) => setDate(event.target.value.replace(/-/g, "."))}
                  aria-invalid={dateInvalid}
                  disabled={!isAdmin}
                />
                {dateInvalid && (
                  <span className="mt-1.5 block text-xs text-[#E8B8C2]">
                    请选择有效的日期
                  </span>
                )}
              </label>

              <div className="block">
                <span className="text-xs font-medium text-[#5A6670]/70">心情标签</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(Object.entries(moodConfig) as [MemoryMood, { emoji: string; label: string }][]).map(([key, info]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMood(mood === key ? undefined : key)}
                      disabled={!isAdmin}
                      className={`flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-xs transition ${
                        mood === key 
                          ? 'bg-[#E8B8C2] text-white shadow-sm' 
                          : 'bg-[#FAFBF7] border border-[#D8DDD8] text-[#5A6670]/80 hover:border-[#E8B8C2] hover:text-[#E8B8C2]'
                      } disabled:opacity-50`}
                    >
                      <span className="text-sm leading-none">{info.emoji}</span>
                      <span>{info.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="flex items-center justify-between gap-3 text-xs font-medium text-[#5A6670]/70">
                  一句话回忆
                  <span className="font-normal text-[#5A6670]/45">
                    {text.length}/{memoryTextMaxLength}
                  </span>
                </span>
                <textarea
                  className="mt-1.5 w-full resize-none rounded-[6px] border border-[#D8DDD8] bg-[#FAFBF7] px-3 py-2 text-sm leading-6 text-[#5A6670] placeholder:text-[#5A6670]/40 outline-none transition focus:border-[#E8B8C2]"
                  rows={3}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="写下这一刻……"
                  maxLength={memoryTextMaxLength}
                  disabled={!isAdmin}
                />
              </label>

              <div>
                <span className="text-xs font-medium text-[#5A6670]/70">照片</span>
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePickFile}
                  disabled={!isAdmin}
                />
                <button
                  className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-[#D8DDD8] bg-[#FAFBF7] px-3 py-3 text-sm text-[#5A6670]/70 transition hover:border-[#E8B8C2] hover:text-[#E8B8C2]"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isAdmin}
                >
                  {photoDrafts.length > 0 ? (
                    <span className="relative w-full">
                      <span className="grid grid-cols-4 gap-2">
                        {photoDrafts.slice(0, 8).map((photo, index) => (
                          <span
                            key={`${photo.previewUrl}-${index}`}
                            className="relative aspect-square overflow-hidden rounded-[4px] bg-[#D6E8F0]"
                          >
                            <LocalPrivacyImg
                              className="pixelated h-full w-full object-cover"
                              src={photo.previewUrl}
                              alt={photo.name || `照片预览 ${index + 1}`}
                            />
                          </span>
                        ))}
                      </span>
                      <span className="mt-2 block text-xs text-[#5A6670]/58">
                        已选择 {photoDrafts.length} 张
                      </span>
                      {isReadingPhoto && (
                        <span className="absolute inset-0 grid place-items-center bg-[#FAFBF7]/72 text-xs text-[#5A6670]/70">
                          读取中
                        </span>
                      )}
                    </span>
                  ) : editingMemory && editingMemory.photos && editingMemory.photos.length > 0 ? (
                    <span className="relative w-full">
                      <span className="grid grid-cols-4 gap-2">
                        {editingMemory.photos.slice(0, 8).map((photo, index) => (
                          <span
                            key={`editing-photo-${index}`}
                            className="relative aspect-square overflow-hidden rounded-[4px] bg-[#D6E8F0]"
                          >
                            <MemoryImage
                              src={photo}
                              alt={`已有照片 ${index + 1}`}
                              fit="cover"
                            />
                          </span>
                        ))}
                      </span>
                      <span className="mt-2 flex items-center justify-between text-xs text-[#5A6670]/58">
                        <span>已有 {editingMemory.photos.length} 张照片</span>
                        <span className="text-[#A8C8DC]">点击重新选择</span>
                      </span>
                    </span>
                  ) : (
                    <>
                      <ImagePlus className="h-4 w-4" />
                      选择本地图片，可多选
                    </>
                  )}
                </button>
                {photoError && (
                  <span className="mt-1.5 block text-xs text-[#E8B8C2]">{photoError}</span>
                )}
              </div>

              <div className="sticky bottom-0 -mx-5 flex items-center gap-2 border-t border-[#D8DDD8]/70 bg-[#FAFBF7]/96 px-5 pb-1 pt-3 shadow-[0_-10px_18px_rgba(250,251,247,0.88)] backdrop-blur">
                <button
                  className="flex-1 rounded-[6px] bg-[#F5DCE0] px-3 py-2 text-sm font-medium text-[#E8B8C2] transition hover:bg-[#E8B8C2] hover:text-[#FAFBF7] disabled:cursor-not-allowed disabled:opacity-45"
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                >
                  {isSaving ? "保存中" : isEditing ? "保存修改" : "保存回忆"}
                </button>
                <button
                  className="rounded-[6px] px-3 py-2 text-sm text-[#5A6670]/62 transition hover:bg-[#D8DDD8]/28 hover:text-[#5A6670]"
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    resetForm(true);
                    setFormOpen(false);
                  }}
                >
                  取消
                </button>
              </div>
              {saveError && <p className="text-xs text-[#E8B8C2]">{saveError}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

