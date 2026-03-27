// background.js - Service Worker
// Calls local proxy server (localhost:3727) instead of Anthropic directly

const LOCAL_SERVER = 'http://127.0.0.1:3727';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'callClaude') {
    callLocalServer(message.payload)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function callLocalServer(payload) {
  let response;
  try {
    response = await fetch(`${LOCAL_SERVER}/parse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload })
    });
  } catch (err) {
    throw new Error('无法连接本地服务，请确认 server.js 已启动（npm start）');
  }

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || `HTTP ${response.status}`);
  }

  return result.data;
}
