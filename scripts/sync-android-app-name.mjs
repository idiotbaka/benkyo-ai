import { readFileSync, writeFileSync } from 'node:fs';

const androidAppName = '\u65e5\u5b66';
const stringsPath = new URL(
  '../src-tauri/gen/android/app/src/main/res/values/strings.xml',
  import.meta.url,
);

let content = readFileSync(stringsPath, 'utf8');

for (const name of ['app_name', 'main_activity_title']) {
  const pattern = new RegExp(
    `<string name="${name}">[^<]*</string>`,
  );
  const replacement = `<string name="${name}">${androidAppName}</string>`;

  if (pattern.test(content)) {
    content = content.replace(pattern, replacement);
  } else {
    content = content.replace(
      '</resources>',
      `    ${replacement}\n</resources>`,
    );
  }
}

writeFileSync(stringsPath, content);
