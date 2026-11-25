const { app, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

// Скачиваем только после подтверждения пользователем
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let updaterInitialized = false;
let isInstalling = false;
let isPromptingDownload = false;
let isPromptingInstall = false;
let targetWindow = null;

function getDialogParent() {
  if (targetWindow && !targetWindow.isDestroyed()) {
    return targetWindow;
  }
  return undefined;
}

module.exports.initUpdater = (win = null) => {
  if (win) {
    targetWindow = win;
  }

  if (!app.isPackaged) return;
  if (updaterInitialized) return;
  updaterInitialized = true;

  autoUpdater.on("update-available", async (info) => {
    if (isPromptingDownload || isInstalling) return;
    isPromptingDownload = true;

    try {
      const parent = getDialogParent();
      const options = {
        type: "info",
        title: "Доступно обновление",
        message: `Найдена версия ${info.version}.`,
        detail: "Скачать обновление сейчас?",
        buttons: ["Скачать", "Не сейчас"],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      };

      const { response } = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options);

      if (response === 0) {
        autoUpdater.downloadUpdate().catch((err) => {
          log.error("downloadUpdate failed:", err);
        });
      }
    } catch (err) {
      log.error("Download dialog error:", err);
    } finally {
      isPromptingDownload = false;
    }
  });

  autoUpdater.on("update-downloaded", async (info) => {
    if (isPromptingInstall || isInstalling) return;
    isPromptingInstall = true;

    try {
      const parent = getDialogParent();
      const options = {
        type: "info",
        title: "Обновление готово",
        message: `Версия ${info.version} загружена.`,
        detail: "Перезапустить приложение сейчас, чтобы установить обновление?",
        buttons: ["Перезапустить", "Позже"],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      };

      const { response } = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options);

      if (response === 0) {
        isInstalling = true;
        setImmediate(() => {
          autoUpdater.quitAndInstall(false, true);
        });
      }
    } catch (err) {
      log.error("Install dialog error:", err);
    } finally {
      isPromptingInstall = false;
    }
  });

  autoUpdater.on("error", (err) => {
    log.error("AutoUpdater error:", err);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error("checkForUpdates failed:", err);
    });
  }, 3000);
};
