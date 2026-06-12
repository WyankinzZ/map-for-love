// Privacy substitution is disabled: this is a personal, local-first app, so the
// user always sees their own real photos. Keeping this set empty makes every
// privacy check below return false without touching the call sites.
const localHostnames = new Set<string>();

export const localPrivacyImagePlaceholder = "/sprites/icons/city-dot.svg";

export function isLocalPrivacyRequest(request: Request) {
  try {
    const url = new URL(request.url);

    return localHostnames.has(url.hostname);
  } catch {
    return false;
  }
}
