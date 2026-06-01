export function getFileNameFromUrl(url) {
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").pop() || "download";
    return decodeURIComponent(base.split("?")[0]);
  } catch {
    try {
      return url.split("/").pop().split("?")[0] || "download";
    } catch {
      return "download";
    }
  }
}

export function getMessageDownloadables(message) {
  if (!message || message.isRecalled || message.isDeletedForMe) return [];

  const items = [];
  const seen = new Set();

  const push = (url, fileName) => {
    if (!url || typeof url !== "string" || seen.has(url)) return;
    seen.add(url);
    items.push({
      url,
      fileName: fileName || getFileNameFromUrl(url),
    });
  };

  if (message.image) push(message.image);

  if (Array.isArray(message.images)) {
    message.images.forEach((url, index) => {
      const base = getFileNameFromUrl(url);
      const hasExt = /\.[a-z0-9]+$/i.test(base);
      push(url, hasExt ? base : `image-${index + 1}.jpg`);
    });
  }

  if (message.file) {
    push(message.file, message.fileName || getFileNameFromUrl(message.file));
  }

  return items;
}

export function hasMessageAttachments(message) {
  return getMessageDownloadables(message).length > 0;
}

export async function downloadAttachment(url, fileName) {
  const name = fileName || getFileNameFromUrl(url);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return;
  } catch {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
}

export async function downloadMessageAttachments(message) {
  const items = getMessageDownloadables(message);
  if (items.length === 0) return 0;

  for (let i = 0; i < items.length; i++) {
    await downloadAttachment(items[i].url, items[i].fileName);
    if (i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  return items.length;
}
