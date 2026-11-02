const { app, BrowserWindow, Menu, ipcMain, powerSaveBlocker, session } = require("electron");
const path = require("path");
const fs = require("fs");
const { initUpdater } = require("./services/updater.cjs");
const { solveCaptcha } = require("./services/captcha.cjs");
const { hotkey } = require("./services/hotkey.cjs");
const { clicker } = require("./services/clicker.cjs");
const { informer } = require("./services/inform.cjs");

const User_ClearAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
app.userAgentFallback = User_ClearAgent;

let powerBlockerId = null;

app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-renderer-backgrounding");

ipcMain.handle("app:ui-action", (e, selector, index) => clicker(e, selector, index));
ipcMain.handle("app:hot-action", (e, key) => hotkey(e, key));
ipcMain.handle("app:cap-action", (_e, data) => solveCaptcha(data));
ipcMain.handle("app:info-action", (_e, data) => informer(data));

async function getBundleSource() {
  if (!app.isPackaged) {
    const bundlePath = path.join(__dirname, "bundle.js");
    return await fs.promises.readFile(bundlePath, "utf-8");
  }
  //  тянем с сервера
  const response = await fetch("https://pbhelperskatan.duckdns.org:8443/bot/bundle.js");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

app.whenReady().then(async () => {
  app.setAppUserModelId("league17.helper");
  Menu.setApplicationMenu(null);
  powerBlockerId = powerSaveBlocker.start("prevent-app-suspension");

  initUpdater();

  let bundleCode = null;
  try {
    bundleCode = await getBundleSource();
    console.log(`bundle.js успешно загружен (${app.isPackaged ? "remote" : "local"})`);
  } catch (err) {
    return console.error("Ошибка при загрузке bundle.js:", err);
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    minimizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
    },
  });

  session.defaultSession.setUserAgent(User_ClearAgent);
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders["User-Agent"] = User_ClearAgent;
    details.requestHeaders["sec-ch-ua"] = '"Chromium";v="155", "Google Chrome";v="155", "Not;A=Brand";v="99"';
    details.requestHeaders["sec-ch-ua-mobile"] = "?0";
    details.requestHeaders["sec-ch-ua-platform"] = '"Windows"';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  if (!app.isPackaged) win.webContents.openDevTools();

  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F5") {
      win.webContents.reload();
      event.preventDefault();
    }
  });

  win.webContents.on("did-finish-load", async () => {
    try {
      // 1. Внедряем отладочный Canvas Overlay + слушатели реальной мыши
      await win.webContents.executeJavaScript(`
      (() => {
        if (window.__debugCanvas) return;

        const canvas = document.createElement('canvas');
        canvas.id = 'automation-debug-canvas';
        Object.assign(canvas.style, {
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: '2147483647',
          opacity: '0.8'
        });

        const updateSize = () => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        };
        updateSize();
        window.addEventListener('resize', updateSize);

        (document.body || document.documentElement).appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const points = [];

        window.__debugCanvas = {
          addPoint(x, y, type = 'move') {
            points.push({ x, y, type, time: Date.now() });
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const now = Date.now();
            // Оставляем точки за последние 3 секунды
            const activePoints = points.filter(p => now - p.time < 3000);

            if (activePoints.length === 0) return;

            // Траектория (линия)
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.6)';
            ctx.lineWidth = 2;
            for (let i = 0; i < activePoints.length; i++) {
              if (i === 0) ctx.moveTo(activePoints[i].x, activePoints[i].y);
              else ctx.lineTo(activePoints[i].x, activePoints[i].y);
            }
            ctx.stroke();

            // Точки кликов и перемещений
            for (const pt of activePoints) {
              ctx.beginPath();
              ctx.fillStyle = pt.type === 'click' ? '#ff0000' : '#00ff00';
              ctx.arc(pt.x, pt.y, pt.type === 'click' ? 7 : 3, 0, Math.PI * 2);
              ctx.fill();
              ctx.lineWidth = 1;
              ctx.strokeStyle = '#ffffff';
              ctx.stroke();
            }
          }
        };

        // --- ТЕЛЕМЕТРИЯ РЕАЛЬНОЙ МЫШИ ---
        // Используем throttling для move, чтобы не перегружать отрисовку
        // let lastMoveTime = 0;
        // window.addEventListener('mousemove', (e) => {
        //   const now = Date.now();
        //   if (now - lastMoveTime > 25) { // Ограничиваем примерно до 40 кадров в секунду для производительности
        //     window.__debugCanvas.addPoint(e.clientX, e.clientY, 'move');
        //     lastMoveTime = now;
        //   }
        // }, { passive: true });

        // window.addEventListener('mousedown', (e) => {
        //   window.__debugCanvas.addPoint(e.clientX, e.clientY, 'click');
        // }, { passive: true });
        // // ---------------------------------

        console.log('[DebugCanvas] Инжектирован успешно с трекингом реальной мыши!');
      })();
    `);

      // 2. Внедряем игровой бандл
      await win.webContents.executeJavaScript(bundleCode);
      console.log("bundle.js внедрён");
    } catch (err) {
      console.error("Ошибка при инъекции скриптов:", err);
    }
  });
  win.once("ready-to-show", () => win.show());

  win.loadURL("https://league17.ru/game/");
});

app.on("before-quit", () => {
  if (powerBlockerId) {
    powerSaveBlocker.stop(powerBlockerId);
    powerBlockerId = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
