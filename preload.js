const { contextBridge, ipcRenderer, webFrame } = require("electron");

contextBridge.exposeInMainWorld("ssevsType", {
  triggerClick: (selector, index, priority) => ipcRenderer.invoke("app:ui-action", selector, index, priority),
  triggerHotkey: (key) => ipcRenderer.invoke("app:hot-action", key),
  triggerCaptcha: (data) => ipcRenderer.invoke("app:cap-action", data),
  triggerInformer: (data) => ipcRenderer.invoke("app:info-action", data),
});

const inject = () => {
  const SPOOF_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";

  const brands = [
    { brand: "Chromium", version: "155" },
    { brand: "Google Chrome", version: "155" },
    { brand: "Not;A=Brand", version: "99" },
  ];

  const fakeUAData = {
    brands: brands,
    mobile: false,
    platform: "Windows",
    toJSON: function () {
      return { brands: brands, mobile: false, platform: "Windows" };
    },
    getHighEntropyValues: function () {
      return Promise.resolve({
        architecture: "x86",
        bitness: "64",
        brands: brands,
        fullVersionList: [
          { brand: "Chromium", version: "155.0.0.0" },
          { brand: "Google Chrome", version: "155.0.0.0" },
          { brand: "Not;A=Brand", version: "99.0.0.0" },
        ],
        mobile: false,
        model: "",
        platform: "Windows",
        platformVersion: "10.0.0",
        uaFullVersion: "155.0.0.0",
        wow64: false,
      });
    },
  };

  try {
    Object.defineProperty(Navigator.prototype, "userAgent", {
      get: function () {
        return SPOOF_UA;
      },
      configurable: true,
    });
  } catch (e) {}

  try {
    Object.defineProperty(Navigator.prototype, "userAgentData", {
      get: function () {
        return fakeUAData;
      },
      configurable: true,
    });
  } catch (e) {}
};

if (typeof webFrame !== "undefined") {
  webFrame.executeJavaScript(`(${inject.toString()})();`);
}

// страница всегда в фокусе
const originalAddEventListener = window.addEventListener;
window.addEventListener = function (type, listener, options) {
  if (type === "blur") return;
  return originalAddEventListener.call(this, type, listener, options);
};
