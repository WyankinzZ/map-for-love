export interface Memory {
  id: string;
  cityId: string;
  city: string;
  cityEn: string;
  date: string;
  image: string;
  photos?: string[];
  text: string;
  createdAt?: string;
  draft?: boolean;
}

export const memories: Memory[] = [];

export const recentMemories: Memory[] = memories.filter((memory) => !memory.draft).slice(0, 3);

export const memoryTime = (memory: Pick<Memory, "date" | "createdAt">) => {
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(memory.date)) {
    const [year, month, day] = memory.date.split(".").map(Number);

    return Date.UTC(year, month - 1, day);
  }

  return memory.createdAt ? new Date(memory.createdAt).getTime() : 0;
};

export const sortMemoriesByTime = <T extends Pick<Memory, "date" | "createdAt">>(items: T[]) =>
  [...items].sort((a, b) => memoryTime(b) - memoryTime(a));

export const recentTimelineMemories: Memory[] = sortMemoriesByTime(
  memories.filter((memory) => !memory.draft),
).slice(0, 5);

export const getLatestMemory = (cityId: string): Memory | undefined =>
  sortMemoriesByTime(memories.filter((memory) => memory.cityId === cityId && !memory.draft))[0];
