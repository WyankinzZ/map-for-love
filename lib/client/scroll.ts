"use client";

/**
 * Smoothly scrolls the active page / container to the top.
 * Handles both standard window/document scrolling and nested overflow-y-auto containers
 * such as the one used inside MemoryPageShell.
 */
export function scrollToPageTop() {
  if (typeof window === "undefined") return;

  // 1. Standard window / document element scroll
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (document.documentElement) {
    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (document.body) {
    document.body.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 2. Any internal scroll containers (e.g. MemoryPageShell <section className="overflow-y-auto">)
  const containers = document.querySelectorAll<HTMLElement>(
    "main section.overflow-y-auto, [data-scroll-container], .overflow-y-auto"
  );
  containers.forEach((el) => {
    el.scrollTo({ top: 0, behavior: "smooth" });
  });
}
