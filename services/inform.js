const { Notification } = require("electron");
module.exports.informer = async (data) => {
  if (!Notification.isSupported()) {
    console.log("Системные уведомления не поддерживаются на этой ОС");
    return false;
  }

  console.log(data);
  const prefixMap = {
    success: "✅ Успех: ",
    error: "❌ Ошибка: ",
    warning: "⚠️ Внимание: ",
    info: "ℹ️ Информация: ",
  };

  const titleWithPrefix = (prefixMap[data.type] || "") + data.title;

  // Сохраняем уведомление в переменную
  const notification = new Notification({
    title: titleWithPrefix,
    body: data.body,
  });

  notification.show();

  return true;
};
