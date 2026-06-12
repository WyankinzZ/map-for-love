import { useState, useEffect } from "react";
import { memoryStoreUpdatedEvent, type LocalMemoryStore } from "@/data/progress";

export const useMemories = () => {
  const [memories, setMemories] = useState<LocalMemoryStore>({});

  useEffect(() => {
    let cancelled = false;
    const handleMemoryUpdate = (event: Event) => {
      const detail = (event as CustomEvent<LocalMemoryStore>).detail;
      if (detail) {
        setMemories(detail);
      }
    };

    async function loadLocalMemories() {
      const response = await fetch("/api/memories", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) {
        if (!cancelled) setMemories({});
        return;
      }

      const data = (await response.json().catch(() => null)) as
        | { memories?: LocalMemoryStore }
        | null;

      if (cancelled) return;

      setMemories(data?.memories ?? {});
    }

    window.addEventListener(memoryStoreUpdatedEvent, handleMemoryUpdate);
    loadLocalMemories();

    return () => {
      cancelled = true;
      window.removeEventListener(memoryStoreUpdatedEvent, handleMemoryUpdate);
    };
  }, []);

  return memories;
};
