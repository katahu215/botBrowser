const { BrowserWindow } = require("electron");

const sleep = (mean, stdDev = 15) => new Promise((r) => setTimeout(r, Math.max(10, Math.round(Math.sqrt(-2.0 * Math.log(Math.max(1e-9, Math.random()))) * Math.cos(2.0 * Math.PI * Math.random()) * stdDev + mean))));

module.exports.hotkey = async (event, key) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);

  try {
    if (!win || win.isDestroyed()) return false;

    if (!win.isFocused()) win.focus();
    if (!webContents.isFocused()) webContents.focus();

    await sleep(120, 30);
    let keyString = String(key);
    if (key === 100) keyString = "E";

    try {
      webContents.sendInputEvent({ type: "keyDown", keyCode: "Alt" });
      await sleep(60, 15);

      webContents.sendInputEvent({ type: "keyDown", keyCode: keyString, modifiers: ["alt"] });
      webContents.sendInputEvent({ type: "char", keyCode: keyString, modifiers: ["alt"] });

      await sleep(65, 15);

      webContents.sendInputEvent({ type: "keyUp", keyCode: keyString, modifiers: ["alt"] });
    } finally {
      await sleep(25, 8);
      webContents.sendInputEvent({ type: "keyUp", keyCode: "Alt" });
    }

    return true;
  } catch (err) {
    console.error("Ошибка при эмуляции горячей клавиши:", err);
    return false;
  }
};
