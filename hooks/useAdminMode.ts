import { useState, useEffect } from "react";
import { adminModeUpdatedEvent, readAdminMode } from "@/data/adminMode";

export const useAdminMode = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsAdmin(readAdminMode()), 0);
    const handleAdminMode = (event: Event) => {
      setIsAdmin(Boolean((event as CustomEvent<boolean>).detail));
    };

    window.addEventListener(adminModeUpdatedEvent, handleAdminMode);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(adminModeUpdatedEvent, handleAdminMode);
    };
  }, []);

  return isAdmin;
};
