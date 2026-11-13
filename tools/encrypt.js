// 사용: PASSWORD='반비밀번호' node tools/encrypt.js   (data.json -> data.enc.json)
// AES-256-GCM + PBKDF2(SHA-256, 600000회). 브라우저 WebCrypto로 복호화.
const fs = require('fs'), c = require('crypto');
const pw = process.env.PASSWORD;
if (!pw) { console.error('PASSWORD 환경변수를 지정하세요'); process.exit(1); }
const salt = c.randomBytes(16), iv = c.randomBytes(12), ITER = 600000;
const key = c.pbkdf2Sync(pw, salt, ITER, 32, 'sha256');
const ci = c.createCipheriv('aes-256-gcm', key, iv);
const enc = Buffer.concat([ci.update(fs.readFileSync(__dirname + '/../data.json')), ci.final(), ci.getAuthTag()]);
fs.writeFileSync(__dirname + '/../data.enc.json', JSON.stringify({
  v: 1, iter: ITER, salt: salt.toString('base64'), iv: iv.toString('base64'), data: enc.toString('base64') }));
console.log('data.enc.json 생성 완료');
