export function encodeState(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function decodeState(payload) {
  const binary = atob(payload);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function buildShareUrl(state, hashPrefix = "#bundle=") {
  const url = new URL(window.location.href);
  url.hash = `${hashPrefix}${encodeState(state)}`;
  return url.toString();
}

export function readSharedState(hashPrefix = "#bundle=") {
  const hash = window.location.hash || "";
  if (!hash.startsWith(hashPrefix)) {
    return null;
  }

  try {
    return decodeState(hash.slice(hashPrefix.length));
  } catch (error) {
    console.error("Freigabelink konnte nicht gelesen werden.", error);
    return null;
  }
}
