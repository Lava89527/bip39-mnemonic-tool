const { Window } = require('happy-dom');
const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

const window = new Window({ url: 'http://localhost/' });
window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
window.happyDOM.settings.disableJavaScriptEvaluation = true; // prevent auto-eval quirk
window.document.write(html);
// manually eval in order (DOM now exists)
blocks.forEach((s, i) => {
  try { window.eval(s); }
  catch (e) { console.log('eval block', i, 'ERR:', e.message); }
});
const doc = window.document;
const $ = s => doc.querySelector(s);

$('#mnemonicInput').value =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
$('#completeBtn').click();
let tries = 0;
const iv = setInterval(() => {
  tries++;
  const cards = doc.querySelectorAll('.mnemonic-card');
  if (cards.length > 0 || tries > 60) {
    clearInterval(iv);
    setTimeout(() => {
      console.log('cards:', cards.length);
      cards[0].click();
      const d = $('#detailBody');
      const b = d.querySelector('.d-batch'); b.click();
      const rows = d.querySelectorAll('.d-batch-row');
      console.log('batch rows:', rows.length, '| row0 copy btns:', rows[0].querySelectorAll('.br-copy').length, '| row0 qr:', rows[0].querySelectorAll('.br-qr svg').length);
      const cb = rows[0].querySelector('.br-copy'); cb.click();
      console.log('copy feedback text:', cb.textContent);
      console.log('MANUAL-EVAL PIPELINE OK');
    }, 80);
  }
}, 100);
