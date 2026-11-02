const bytenode = require("bytenode");
const JavaScriptObfuscator = require("javascript-obfuscator");
const path = require("path");
const fs = require("fs");

// Настройки обфускации
const obfuscatorOptions = {
  compact: true,
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 1,
  rotateStringArray: true,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  selfDefending: false,
};

// Обфускация и компиляция файла
function compileObfuscatedFile(inputPath, outputPath) {
  const source = fs.readFileSync(inputPath, "utf8");

  const obfuscated = JavaScriptObfuscator.obfuscate(source, obfuscatorOptions).getObfuscatedCode();

  // Временный JS-файл для bytenode
  const tempPath = inputPath + ".obfuscated.tmp.js";

  try {
    fs.writeFileSync(tempPath, obfuscated, "utf8");

    bytenode.compileFile({
      filename: tempPath,
      output: outputPath,
      electron: true,
    });

    console.log(`Скомпилирован: ${path.relative(__dirname, outputPath)}`);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

// 1. Компилируем главный файл
compileObfuscatedFile(path.join(__dirname, "main.js"), path.join(__dirname, "main.jsc"));

// 2. Компилируем файлы из services
const servicesDir = path.join(__dirname, "services");

fs.readdirSync(servicesDir).forEach((file) => {
  if (file.endsWith(".js")) {
    const inputPath = path.join(servicesDir, file);
    const outputPath = path.join(servicesDir, file.replace(/\.js$/, ".jsc"));

    compileObfuscatedFile(inputPath, outputPath);
  }
});

console.log("Все файлы успешно обфусцированы и скомпилированы!");
