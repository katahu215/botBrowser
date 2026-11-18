const path = require("path");
const { Notification } = require("electron");

module.exports.informer = async (message) => {
  if (!Notification.isSupported()) {
    console.log("Системные уведомления не поддерживаются на этой ОС");
    return false;
  }

  const notification = new Notification({
    title: "",
    body: message,
    icon: path.join(__dirname, "icon.ico"),
  });

  notification.show();

  return true;
};
