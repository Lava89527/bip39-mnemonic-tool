const { Window } = require('happy-dom');
const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');

const window = new Window({ url: 'http://localhost/' });
window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
if (!window.performance) window.performance = { now: () => Date.now() };
window.addEventListener('error', e => {
  console.log('WINDOW ERROR:', e.message);
  if (e.error && e.error.stack) console.log(e.error.stack.split('\n').slice(0,4).join('\n'));
});
window.console.error = (...a) => console.log('CONSOLE ERROR:', ...a);
window.document.write(html);
const doc = window.document;
const $ = s => doc.querySelector(s);

console.log('have completeBtn:', !!$('#completeBtn'));
$('#mnemonicInput').value =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
try {
  $('#completeBtn').click();
  console.log('clicked completeBtn (no throw)');
} catch (e) {
  console.log('THROW on completeBtn click:', e.message);
  console.log(e.stack.split('\n').slice(0,6).join('\n'));
}
setTimeout(() => {
  console.log('cards after 1s:', doc.querySelectorAll('.mnemonic-card').length);
}, 1000);
