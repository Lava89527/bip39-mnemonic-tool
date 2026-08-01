const { Window } = require('happy-dom');
const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');
const zh = fs.readFileSync('../assets/chinese_simplified.txt','utf8').split(/\s+/).filter(Boolean);

const window = new Window({ url: 'http://localhost/' });
window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
if (!window.performance) window.performance = { now: () => Date.now() };
window.document.write(html);
const doc = window.document;
const $ = s => doc.querySelector(s);

// switch to Chinese
doc.querySelector('#langSeg button[data-lang="ZH"]').click();
const eleven = zh.slice(0, 11).join(' ');
$('#mnemonicInput').value = eleven;
$('#completeBtn').click();

let tries = 0;
const iv = setInterval(() => {
  tries++;
  const cards = doc.querySelectorAll('.mnemonic-card');
  if (cards.length > 0 || tries > 60) {
    clearInterval(iv);
    setTimeout(() => {
      console.log('lang selected   :', (doc.querySelector('#langSeg button.active')||{}).getAttribute('data-lang'));
      console.log('Chinese prefix  :', eleven);
      console.log('result cards    :', cards.length, cards.length === 128 ? 'OK (expect 128)' : 'FAIL');
      // pick first, ensure detail + address derive
      cards[0].click();
      const detail = $('#detailBody');
      const qrs = detail.querySelectorAll('svg').length;
      const addr = (detail.querySelector('.d-section:not(.mne) .d-text')||{}).textContent||'';
      console.log('detail QR count :', qrs, qrs===9?'OK (BTC=9)':'note');
      console.log('first address   :', addr.slice(0,16));
      console.log('ZH E2E DONE');
    }, 80);
  }
}, 100);
