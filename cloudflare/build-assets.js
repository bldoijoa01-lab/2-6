// public/ 의 정적 파일을 src/assets.js 로 내장 (Workers Assets 업로드 없이 배포)
const fs = require('fs'), path = require('path');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };
const out = {};
for (const f of fs.readdirSync(path.join(__dirname, 'public')))
  out['/' + f] = { type: types[path.extname(f)] || 'text/plain', body: fs.readFileSync(path.join(__dirname, 'public', f), 'utf8') };
fs.writeFileSync(path.join(__dirname, 'src/assets.js'), 'export default ' + JSON.stringify(out) + ';\n');
