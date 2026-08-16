const KEY = "psychlab_participant_id";

/** Persistent, anonymous participant identifier. Browser only. */
export function getParticipantId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = `p_${crypto.randomUUID().replace(/-/g, "")}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

const NAME_KEY = "psychlab_participant_name";

export function getParticipantName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function setParticipantName(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NAME_KEY, name);
}
