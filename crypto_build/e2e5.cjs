const { Window } = require('happy-dom');
const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');

const window = new Window({ url: 'http://localhost/' });
window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
if (!window.performance) window.performance = { now: () => Date.now() };
// simulate clipboard for offline file:// (execCommand fallback)
window.document.execCommand = () => true;
window.document.write(html);
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
      cards[0].click();
      const detail = $('#detailBody');
      const firstBatch = detail.querySelector('.d-batch');
      firstBatch.click();
      const rows = detail.querySelectorAll('.d-batch-row');
      console.log('batch rows        :', rows.length, rows.length === 100 ? 'OK' : 'FAIL');
      const r0 = rows[0];
      const copyBtns = r0.querySelectorAll('.br-copy').length;
      const qrs = r0.querySelectorAll('.br-qr svg').length;
      console.log('row0 copy buttons :', copyBtns, copyBtns === 2 ? 'OK (addr+priv)' : 'FAIL');
      console.log('row0 QR codes     :', qrs, qrs === 2 ? 'OK (addr+priv)' : 'FAIL');
      // copy delegation
      const cb = r0.querySelector('.br-copy');
      cb.click();
      console.log('copy feedback     :', cb.textContent === '已复制' ? 'OK' : 'FAIL ("' + cb.textContent + '")');
      // modal width css
      const css = html.match(/\.modal-content\{[^}]*\}/)[0];
      const m = css.match(/max-width:(\d+)px/);
      console.log('modal max-width   :', m ? m[1] + 'px' : '?', m && +m[1] > 700 ? 'OK (wider)' : 'FAIL');
      console.log('E2E5 DONE');
    }, 80);
  }
}, 100);
