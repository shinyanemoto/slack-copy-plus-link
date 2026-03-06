const COPY_COMMAND = "copy-slack-message";
const COPY_MESSAGE = { type: "COPY_ACTIVE_SLACK_MESSAGE" };

async function sendCopyMessageToActiveSlackTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://app.slack.com/")) {
    return;
  }

  chrome.tabs.sendMessage(tab.id, COPY_MESSAGE);
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== COPY_COMMAND) {
    return;
  }

  sendCopyMessageToActiveSlackTab().catch(() => {});
});

chrome.action.onClicked.addListener(() => {
  sendCopyMessageToActiveSlackTab().catch(() => {});
});
