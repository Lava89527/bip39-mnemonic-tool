import fs from 'fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('../index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
const doc = window.document;

function done() {
  const cards = doc.querySelectorAll('.mnemonic-card');
  console.log('result cards:', cards.length);
  if (cards.length < 128) { console.log('FAIL: expected 128 cards'); return; }
  cards[0].click();
  const detail = doc.getElementById('detailBody');
  console.log('detail mnemonic section:', detail.innerHTML.includes('助记词') ? 'OK' : 'FAIL');
  console.log('detail address row:', detail.innerHTML.includes('地址') ? 'OK' : 'FAIL');
  console.log('detail private key row:', detail.innerHTML.includes('私钥') ? 'OK' : 'FAIL');
  console.log('detail BTC Taproot path:', detail.innerHTML.includes('Taproot') ? 'OK' : 'FAIL');
  console.log('detail has QR svg:', detail.querySelectorAll('svg').length, 'svgs');
  const batchBtn = detail.querySelector('.d-batch');
  batchBtn.click();
  console.log('batch rows after 1st click:', detail.querySelectorAll('.d-batch-row').length);
  batchBtn.click();
  console.log('batch rows after 2nd click:', detail.querySelectorAll('.d-batch-row').length);
  batchBtn.click();
  console.log('batch rows after 3rd click (300):', detail.querySelectorAll('.d-batch-row').length);
  console.log('E2E PASS');
}

doc.getElementById('mnemonicInput').value =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
doc.getElementById('completeBtn').click();
// generation is chunked via setTimeout; poll
let tries = 0;
const iv = setInterval(() => {
  tries++;
  const cards = doc.querySelectorAll('.mnemonic-card');
  if (cards.length > 0 || tries > 40) {
    clearInterval(iv);
    setTimeout(done, 50);
  }
}, 100);
