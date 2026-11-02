const { app, dialog } = require("electron");
const electronUpdater = require("electron-updater");
const log = require("electron-log");

const { autoUpdater } = electronUpdater;

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

module.exports.initUpdater = () => {
  // Обновления работают только в собранном приложении
  if (!app.isPackaged) {
    log.info("Dev-режим: проверка обновлений пропущена");
    return;
  }

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("update-available", (info) => {
    log.info("Доступно обновление:", info.version);
  });

  autoUpdater.on("update-not-available", () => {
    log.info("Обновлений нет");
  });

  autoUpdater.on("error", (err) => {
    log.error("Ошибка обновления:", err);
  });

  autoUpdater.on("download-progress", (p) => {
    log.info(`Загрузка: ${p.percent.toFixed(1)}%`);
  });

  autoUpdater.on("update-downloaded", async (info) => {
    log.info("Обновление загружено:", info.version);
    const { response } = await dialog.showMessageBox({
      type: "info",
      title: "Обновление готово",
      message: `Версия ${info.version} загружена.`,
      detail: "Перезапустить приложение сейчас, чтобы применить обновление?",
      buttons: ["Перезапустить", "Позже"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
};
