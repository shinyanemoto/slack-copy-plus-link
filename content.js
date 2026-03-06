const MESSAGE_SELECTOR = [
  '[data-qa="message_container"]',
  '[data-qa="virtual-list-item"]',
  ".c-virtual_list__item"
].join(",");

const TEXT_SELECTORS = [
  '[data-qa="message-text"]',
  '[data-qa="message-text-container"]',
  ".c-message__body",
  ".p-rich_text_block"
];

let hoveredMessage = null;
let lastInteractedMessage = null;
let copyButton = null;
let toastTimer = null;
let isButtonHovered = false;

function init() {
  createCopyButton();
  bindHoverTracking();
  bindInteractionTracking();
  bindRuntimeMessage();
}

function createCopyButton() {
  copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "scpl-copy-btn";
  copyButton.textContent = "Copy";
  copyButton.addEventListener("mouseenter", () => {
    isButtonHovered = true;
  });
  copyButton.addEventListener("mouseleave", () => {
    isButtonHovered = false;
  });
  copyButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (hoveredMessage) {
      copyMessageData(hoveredMessage);
    }
  });
  document.body.appendChild(copyButton);

  window.addEventListener(
    "scroll",
    () => {
      if (hoveredMessage && isElementVisible(hoveredMessage)) {
        showCopyButton(hoveredMessage);
      }
    },
    true
  );
  window.addEventListener("resize", () => {
    if (hoveredMessage && isElementVisible(hoveredMessage)) {
      showCopyButton(hoveredMessage);
    }
  });
}

function bindHoverTracking() {
  document.addEventListener("pointermove", (event) => {
    if (copyButton.contains(event.target)) {
      return;
    }
    const candidate = findMessageContainer(event.target);
    if (!candidate || !isElementVisible(candidate)) {
      if (!isButtonHovered) {
        hoveredMessage = null;
        hideCopyButton();
      }
      return;
    }
    hoveredMessage = candidate;
    showCopyButton(candidate);
  });
}

function bindInteractionTracking() {
  document.addEventListener("click", (event) => {
    const candidate = findMessageContainer(event.target);
    if (candidate) {
      lastInteractedMessage = candidate;
    }
  });

  document.addEventListener("focusin", (event) => {
    const candidate = findMessageContainer(event.target);
    if (candidate) {
      lastInteractedMessage = candidate;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.shiftKey && event.code === "KeyC") {
      event.preventDefault();
      copyFromBestTarget();
    }
  });
}

function bindRuntimeMessage() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "COPY_ACTIVE_SLACK_MESSAGE") {
      return;
    }
    copyFromBestTarget()
      .then((ok) => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  });
}

async function copyFromBestTarget() {
  const target =
    (hoveredMessage && isElementVisible(hoveredMessage) ? hoveredMessage : null) ||
    (lastInteractedMessage && isElementVisible(lastInteractedMessage) ? lastInteractedMessage : null) ||
    findMostRecentVisibleMessage();

  if (!target) {
    showToast("メッセージが見つかりません");
    return false;
  }

  return copyMessageData(target);
}

async function copyMessageData(messageNode) {
  const text = extractMessageText(messageNode);
  const permalink = extractPermalink(messageNode);

  if (!text) {
    showToast("本文の取得に失敗しました");
    return false;
  }
  if (!permalink) {
    showToast("リンクの取得に失敗しました");
    return false;
  }

  const payload = `${text}\n${permalink}`;
  const copied = await writeToClipboard(payload);
  showToast(copied ? "本文 + リンクをコピーしました" : "コピーに失敗しました");
  return copied;
}

function showCopyButton(messageNode) {
  const rect = messageNode.getBoundingClientRect();
  const top = Math.max(8, rect.top + 6);
  const left = Math.min(window.innerWidth - 80, rect.right - 64);

  copyButton.style.top = `${top}px`;
  copyButton.style.left = `${Math.max(8, left)}px`;
  copyButton.style.display = "inline-flex";
}

function hideCopyButton() {
  copyButton.style.display = "none";
}

function findMessageContainer(node) {
  if (!(node instanceof Element)) {
    return null;
  }
  const candidate = node.closest(MESSAGE_SELECTOR);
  if (!candidate) {
    return null;
  }

  const hasText = Boolean(extractMessageText(candidate));
  const hasLink = Boolean(extractPermalink(candidate));
  return hasText && hasLink ? candidate : null;
}

function findMostRecentVisibleMessage() {
  const items = Array.from(document.querySelectorAll(MESSAGE_SELECTOR));
  const visible = items.filter(isElementVisible).filter((item) => {
    return Boolean(extractMessageText(item) && extractPermalink(item));
  });
  if (visible.length === 0) {
    return null;
  }
  return visible[visible.length - 1];
}

function extractMessageText(messageNode) {
  for (const selector of TEXT_SELECTORS) {
    const element = messageNode.querySelector(selector);
    const text = normalizeText(element?.innerText || "");
    if (text) {
      return text;
    }
  }

  const richTextParts = Array.from(messageNode.querySelectorAll(".p-rich_text_section"))
    .map((el) => normalizeText(el.innerText))
    .filter(Boolean);
  if (richTextParts.length > 0) {
    return richTextParts.join("\n");
  }

  return "";
}

function extractPermalink(messageNode) {
  const anchor = messageNode.querySelector('a[href*="/archives/"][href*="/p"]');
  if (anchor) {
    return toAbsoluteUrl(anchor.getAttribute("href"));
  }

  const tsCandidate = messageNode.querySelector("[data-ts]");
  const rawTs =
    tsCandidate?.getAttribute("data-ts") ||
    messageNode.getAttribute("data-ts") ||
    "";
  const ts = rawTs.replace(/[^\d]/g, "");
  const channelId = getChannelIdFromLocation();

  if (!ts || !channelId) {
    return "";
  }

  return `${location.origin}/archives/${channelId}/p${ts}`;
}

function getChannelIdFromLocation() {
  const archives = location.pathname.match(/\/archives\/([A-Z0-9]+)/);
  if (archives?.[1]) {
    return archives[1];
  }
  const client = location.pathname.match(/\/client\/[A-Z0-9]+\/([A-Z0-9]+)/);
  if (client?.[1]) {
    return client[1];
  }
  return "";
}

function normalizeText(value) {
  return value.replace(/\n{3,}/g, "\n\n").trim();
}

function toAbsoluteUrl(rawHref) {
  if (!rawHref) {
    return "";
  }
  try {
    return new URL(rawHref, location.origin).toString();
  } catch (_error) {
    return "";
  }
}

async function writeToClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (_error) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      textarea.remove();
      return success;
    } catch (_fallbackError) {
      return false;
    }
  }
}

function isElementVisible(element) {
  if (!(element instanceof Element)) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0 && rect.height > 0;
}

function showToast(message) {
  const existing = document.querySelector(".scpl-toast");
  const toast = existing || document.createElement("div");
  toast.className = "scpl-toast";
  toast.textContent = message;
  if (!existing) {
    document.body.appendChild(toast);
  }

  requestAnimationFrame(() => toast.classList.add("scpl-show"));
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("scpl-show");
  }, 1400);
}

init();
