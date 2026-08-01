const { Window } = require('happy-dom');
const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');

const window = new Window({ url: 'http://localhost/' });
window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder;
if (!window.performance) window.performance = { now: () => Date.now() };
window.document.write(html);
const doc = window.document;
const $ = s => doc.querySelector(s);

function runCoin(coin, expectPrefix, expectQR, labelMust) {
  return new Promise(resolve => {
    // select coin
    const btn = doc.querySelector('#coinSeg button[data-coin="' + coin + '"]');
    if (!btn) { console.log(coin, 'FAIL: no coin button'); return resolve(); }
    btn.click();
    // 11 known words
    $('#mnemonicInput').value =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
    $('#completeBtn').click();
    console.log('   selected coin =', (doc.querySelector('#coinSeg button.active')||{}).getAttribute && doc.querySelector('#coinSeg button.active').getAttribute('data-coin'));
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      const cards = doc.querySelectorAll('.mnemonic-card');
      if (cards.length > 0 || tries > 60) {
        clearInterval(iv);
        setTimeout(() => {
          cards[0].click();
          const detail = $('#detailBody');
          const qrs = detail.querySelectorAll('svg').length;
          const txt = detail.textContent;
          const addr = (detail.querySelector('.d-section:not(.mne) .d-text') || {}).textContent || '';
          const okQR = qrs === expectQR;
          const okPrefix = expectPrefix ? addr.startsWith(expectPrefix) : true;
          const okLabel = labelMust ? txt.includes(labelMust) : true;
          console.log(
            coin.padEnd(4),
            'QR=' + qrs + (okQR ? ' OK' : ' FAIL exp ' + expectQR),
            '| addr="' + addr.slice(0, 12) + '..."' + (okPrefix ? ' OK' : ' FAIL prefix ' + expectPrefix),
            '| label=' + (okLabel ? 'OK' : 'FAIL(' + labelMust + ')')
          );
          resolve();
        }, 80);
      }
    }, 100);
  });
}

(async () => {
  await runCoin('BTC', '', 9, 'Taproot');
  await runCoin('ETH', '0x', 3, 'Ethereum');
  await runCoin('SOL', '', 3, 'Solana');
  await runCoin('SUI', '0x', 3, 'Sui');
  console.log('PER-COIN E2E DONE');
})();
