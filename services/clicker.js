const CONFIG = {
  enableDebug: false,
  lastMousePosition: { x: 100, y: 100 },
};

const sleep = (mean, stdDev = 15) => new Promise((r) => setTimeout(r, Math.max(10, Math.round(Math.sqrt(-2.0 * Math.log(Math.max(1e-9, Math.random()))) * Math.cos(2.0 * Math.PI * Math.random()) * stdDev + mean))));

const trajectories = {
  presetA: (startX, startY, targetX, targetY) => {
    const points = [];
    const dx = targetX - startX;
    const dy = targetY - startY;
    const length = Math.hypot(dx, dy);

    const totalSteps = Math.max(12, Math.floor(length / 15));
    const nx = -dy / (length || 1);
    const ny = dx / (length || 1);
    const curveIntensity = (Math.random() - 0.5) * Math.min(length * 0.3, 60);

    for (let i = 1; i <= totalSteps; i++) {
      let t = i / totalSteps;
      t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const baseX = startX + dx * t;
      const baseY = startY + dy * t;
      const arc = Math.sin((i / totalSteps) * Math.PI) * curveIntensity;
      const noiseX = (Math.random() - 0.5) * 3;
      const noiseY = (Math.random() - 0.5) * 3;

      points.push({
        x: Math.round(baseX + nx * arc + noiseX),
        y: Math.round(baseY + ny * arc + noiseY),
      });
    }
    return points;
  },
  presetB: (startX, startY, targetX, targetY) => {
    const points = [];
    const dx = targetX - startX;
    const dy = targetY - startY;
    const length = Math.hypot(dx, dy);

    const totalSteps = Math.max(10, Math.floor(length / 16));
    const nx = -dy / (length || 1);
    const ny = dx / (length || 1);
    const curveIntensity = (Math.random() > 0.5 ? 1 : -1) * Math.min(length * 0.4, 75);

    for (let i = 1; i <= totalSteps; i++) {
      let t = i / totalSteps;
      t = Math.pow(t, 1.5);

      const baseX = startX + dx * t;
      const baseY = startY + dy * t;
      const arc = Math.sin((i / totalSteps) * Math.PI) * curveIntensity;
      const noiseX = (Math.random() - 0.5) * 5;
      const noiseY = (Math.random() - 0.5) * 5;
      const delay = Math.round(20 + Math.random() * 40);

      points.push({
        x: Math.round(baseX + nx * arc + noiseX),
        y: Math.round(baseY + ny * arc + noiseY),
        delay: delay,
      });
    }
    return points;
  },
  presetC: (startX, startY, targetX, targetY) => {
    return trajectories.presetA(startX, startY, targetX, targetY);
  },
  presetD: (startX, startY, targetX, targetY) => {
    return trajectories.presetA(startX, startY, targetX, targetY);
  },
};

function getTrajectoryPoints(startX, startY, targetX, targetY) {
  const rand = Math.random() * 100;
  if (rand < 25) {
    return trajectories.presetB(startX, startY, targetX, targetY);
  } else if (rand < 50) {
    return trajectories.presetA(startX, startY, targetX, targetY);
  } else if (rand < 75) {
    return trajectories.presetB(startX, startY, targetX, targetY);
  } else {
    return trajectories.presetA(startX, startY, targetX, targetY);
  }
}

const clickQueues = new WeakMap();

async function _clickerInternal(event, selector, index, maxRetries = 10) {
  const webContents = event.sender;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const script = `(async () => {
        const sessionId = 'session_' + Math.random().toString(36).substring(2);
        const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
        if (!el) return null;

        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        
        // 1. Двойной requestAnimationFrame с таймаутом (защита от зависания в фоне)
        await Promise.race([
          new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))),
          new Promise((_, rej) => setTimeout(() => rej(new Error('RAF timeout')), 1000))
        ]).catch(() => {});

        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return null;

        const paddingX = r.width * 0.3;
        const paddingY = r.height * 0.3;
        const targetX = Math.round(r.x + paddingX + Math.random() * (r.width - 2 * paddingX));
        const targetY = Math.round(r.y + paddingY + Math.random() * (r.height - 2 * paddingY));

        const modifiedElements = [];
        const shadowOverlaySelectors = ['.modal-dialog', '.Modal', '.backdrop','.Drops'];
        
        const disableShadowOverlays = (root = document) => {
          const allElements = root.querySelectorAll('*');
          for (let i = 0, len = allElements.length; i < len; i++) {
            const childEl = allElements[i];
            if (childEl.shadowRoot) {
              for (let s = 0; s < shadowOverlaySelectors.length; s++) {
                const found = childEl.shadowRoot.querySelectorAll(shadowOverlaySelectors[s]);
                for (let j = 0, fLen = found.length; j < fLen; j++) {
                  const overlayEl = found[j];
                  if (overlayEl.style.pointerEvents !== 'none') {
                    modifiedElements.push({ el: overlayEl, prev: overlayEl.style.pointerEvents });
                    overlayEl.style.pointerEvents = 'none';
                  }
                }
              }
              disableShadowOverlays(childEl.shadowRoot);
            }
          }
        };
        disableShadowOverlays(document);

        let currentTop = document.elementFromPoint(targetX, targetY);
        while (currentTop && !el.contains(currentTop) && currentTop !== el && currentTop !== document.body && currentTop !== document.documentElement) {
          modifiedElements.push({ el: currentTop, prev: currentTop.style.pointerEvents });
          currentTop.style.pointerEvents = 'none';
          currentTop = document.elementFromPoint(targetX, targetY);
        }

        // 2. Локальное замыкание вместо глобальной функции window.__restorePointerEvents
        const restore = () => {
          for (let i = 0, len = modifiedElements.length; i < len; i++) {
            const item = modifiedElements[i];
            if (item && item.el) {
              try { item.el.style.pointerEvents = item.prev; } catch (e) {}
            }
          }
        };

        // 3. Promise с событием и AbortController вместо поллинга window.__lastClickSuccess
        const clickPromise = new Promise((resolve) => {
          const controller = new AbortController();
          const clickHandler = () => {
            controller.abort();
            resolve(true);
          };

          el.addEventListener('click', clickHandler, { once: true, signal: controller.signal });

          setTimeout(() => {
            controller.abort();
            resolve(false);
          }, 1500);
        });

        // Сохраняем сессию в изолированном объекте страницы
        window.__clickerSessions = window.__clickerSessions || {};
        window.__clickerSessions[sessionId] = { restore, clickPromise };

        return { sessionId, x: r.x, y: r.y, width: r.width, height: r.height, targetX, targetY };
      })()`;

      const rect = await webContents.executeJavaScript(script);

      if (!rect) {
        console.warn(`Попытка ${attempt}: элемент не найден, пробуем снова...`);
        await sleep(200, 400);
        continue;
      }

      const { sessionId, targetX, targetY } = rect;
      const pathPoints = getTrajectoryPoints(CONFIG.lastMousePosition.x, CONFIG.lastMousePosition.y, targetX, targetY);

      for (let i = 0, len = pathPoints.length; i < len; i++) {
        const pt = pathPoints[i];
        webContents.sendInputEvent({ type: "mouseMove", x: pt.x, y: pt.y });

        if (CONFIG.enableDebug) {
          webContents.executeJavaScript(`window.__debugCanvas && window.__debugCanvas.addPoint(${pt.x}, ${pt.y}, 'move')`).catch(() => {});
        }

        await sleep(10, 35);
      }
      CONFIG.lastMousePosition = { x: targetX, y: targetY };

      webContents.sendInputEvent({ type: "mouseDown", x: targetX, y: targetY, button: "left", clickCount: 1 });
      await sleep(50, 100);

      if (CONFIG.enableDebugCanvas) {
        webContents.executeJavaScript(`window.__debugCanvas && window.__debugCanvas.addPoint(${targetX}, ${targetY}, 'click')`).catch(() => {});
      }

      webContents.sendInputEvent({ type: "mouseUp", x: targetX, y: targetY, button: "left", clickCount: 1 });
      await sleep(80, 120);

      // Ожидание клика и гарантированное восстановление через try/finally на стороне страницы
      const waitScript = `(async () => {
        const session = window.__clickerSessions && window.__clickerSessions[${JSON.stringify(sessionId)}];
        if (!session) return false;

        try {
          return await session.clickPromise;
        } finally {
          session.restore();
          delete window.__clickerSessions[${JSON.stringify(sessionId)}];
        }
      })()`;

      const isClicked = await webContents.executeJavaScript(waitScript).catch(() => false);

      if (!isClicked) {
        await sleep(100, 300);
        continue;
      }

      return true;
    } catch (err) {
      console.error(`Ошибка в попытке ${attempt}:`, err);
      // Страховка от зависших оверлеев при сбоях
      webContents
        .executeJavaScript(
          `
        if (window.__clickerSessions) {
          for (const id in window.__clickerSessions) {
            try { window.__clickerSessions[id].restore(); } catch(e) {}
            delete window.__clickerSessions[id];
          }
        }
      `,
        )
        .catch(() => {});

      if (attempt === maxRetries) return false;
      await sleep(200, 400);
    }
  }

  return false;
}

module.exports.clicker = async (event, selector, index, maxRetries = 10) => {
  const webContents = event.sender;

  let currentQueue = clickQueues.get(webContents) || Promise.resolve();

  const nextQueueItem = currentQueue.catch(() => {}).then(() => _clickerInternal(event, selector, index, maxRetries));

  clickQueues.set(webContents, nextQueueItem);

  return nextQueueItem;
};
