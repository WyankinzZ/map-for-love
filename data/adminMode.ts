export const adminModeUpdatedEvent = "mapofus:admin-mode-updated";
export const adminModeSessionKey = "mapofus:admin-unlocked";

export const readAdminMode = () => {
  if (typeof window === "undefined") return false;

  return window.sessionStorage.getItem(adminModeSessionKey) === "true";
};

export const writeAdminMode = (unlocked: boolean) => {
  if (unlocked) window.sessionStorage.setItem(adminModeSessionKey, "true");
  else window.sessionStorage.removeItem(adminModeSessionKey);

  window.dispatchEvent(new CustomEvent<boolean>(adminModeUpdatedEvent, { detail: unlocked }));
};
