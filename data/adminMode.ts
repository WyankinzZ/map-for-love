import { isMobileStaticApp, isDesktopApp } from "@/lib/client/idb";

export const adminModeUpdatedEvent = "mapofus:admin-mode-updated";
export const adminModeSessionKey = "mapofus:admin-unlocked";

export const readAdminMode = () => {
  if (typeof window === "undefined") return false;

  // On mobile APK / static app or desktop client, the user is the private owner of their local app
  if (isMobileStaticApp() || isDesktopApp()) return true;

  return (
    window.sessionStorage.getItem(adminModeSessionKey) === "true" ||
    window.localStorage.getItem(adminModeSessionKey) === "true"
  );
};

export const writeAdminMode = (unlocked: boolean) => {
  if (unlocked) {
    window.sessionStorage.setItem(adminModeSessionKey, "true");
    window.localStorage.setItem(adminModeSessionKey, "true");
  } else {
    window.sessionStorage.removeItem(adminModeSessionKey);
    window.localStorage.removeItem(adminModeSessionKey);
  }

  window.dispatchEvent(new CustomEvent<boolean>(adminModeUpdatedEvent, { detail: unlocked }));
};
