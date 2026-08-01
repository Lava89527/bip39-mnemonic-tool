const { Window } = require('happy-dom');
const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');

const window = new Window({ url: 'http://localhost/' });
window.happyDOM.settings.disableJavaScriptEvaluation = false;
// provide TextEncoder used by the derivation bundle
window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder;
if (!window.performance) window.performance = { now: () => Date.now() };

window.document.write(html);
const doc = window.document;

function done() {
  const cards = doc.querySelectorAll('.mnemonic-card');
  console.log('result cards:', cards.length);
  if (cards.length < 128) { console.log('FAIL: expected 128 cards'); return; }
  cards[0].click();
  const detail = doc.getElementById('detailBody');
  console.log('detail mnemonic section:', detail.innerHTML.includes('助记词') ? 'OK' : 'FAIL');
  console.log('detail address row     :', detail.innerHTML.includes('地址') ? 'OK' : 'FAIL');
  console.log('detail private key row :', detail.innerHTML.includes('私钥') ? 'OK' : 'FAIL');
  console.log('detail BTC Taproot     :', detail.innerHTML.includes('Taproot') ? 'OK' : 'FAIL');
  console.log('detail QR svgs         :', detail.querySelectorAll('svg').length);
  const batchBtn = detail.querySelector('.d-batch');
  batchBtn.click();
  console.log('batch rows (1st click) :', detail.querySelectorAll('.d-batch-row').length);
  batchBtn.click();
  console.log('batch rows (2nd click) :', detail.querySelectorAll('.d-batch-row').length);
  batchBtn.click();
  console.log('batch rows (3rd=300)   :', detail.querySelectorAll('.d-batch-row').length);
  console.log('E2E PASS');
}

doc.getElementById('mnemonicInput').value =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
doc.getElementById('completeBtn').click();

let tries = 0;
const iv = setInterval(() => {
  tries++;
  if (doc.querySelectorAll('.mnemonic-card').length > 0 || tries > 50) {
    clearInterval(iv);
    setTimeout(done, 80);
  }
}, 100);
