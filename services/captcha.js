module.exports.solveCaptcha = async ({ sitekey, pageurl, apiKey }) => {
  if (!apiKey) return { success: false, error: "API key is missing" };

  try {
    const createRes = await fetch("https://api.capmonster.cloud/createTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: apiKey,
        task: {
          type: "NoCaptchaTaskProxyless",
          websiteURL: pageurl,
          websiteKey: sitekey,
        },
      }),
    });
    const createData = await createRes.json();
    if (createData.errorId !== 0) {
      const errMessage = `Ошибка создания задачи: ${createData.errorCode || "неизвестно"}`;
      console.error(`[CapMonster] ${errMessage}`);
      return { success: false, error: errMessage };
    }

    const taskId = createData.taskId;
    console.log(`[CapMonster] Задача создана (ID: ${taskId}). Ожидание решения...`);

    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const resultRes = await fetch("https://api.capmonster.cloud/getTaskResult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientKey: apiKey,
          taskId: taskId,
        }),
      });

      const resultData = await resultRes.json();

      if (resultData.status === "ready" && resultData.solution) {
        return { success: true, token: resultData.solution.gRecaptchaResponse };
      }

      if (resultData.status === "error") {
        const errMessage = `Ошибка сервиса: ${resultData.errorDescription || "неизвестно"}`;
        console.error(`[CapMonster] ${errMessage}`);
        return { success: false, error: errMessage };
      }
    }
    return { success: false, error: "Timeout" };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
