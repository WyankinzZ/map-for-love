"use client";
import MemoryToolPage from "./MemoryToolPage";
import { configs } from "./Shared";

export default function FavoritesPage() {
  return <MemoryToolPage config={configs.favorite} />;
}
