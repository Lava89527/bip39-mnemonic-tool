const fs = require('fs');
const { Window } = require('happy-dom');
const html = fs.readFileSync('../index.html', 'utf8');

function run(){
  const w = new Window({ url: 'http://localhost/' });
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  w.crypto = globalThis.crypto;
  w.document.write(html);
  const doc = w.document;
  const $ = s => doc.querySelector(s);
  const $$ = s => [...doc.querySelectorAll(s)];
  const wait = ms => new Promise(r=>w.setTimeout(r, ms));
  function poll(cond, timeout=20000, step=40){
    return new Promise((res, rej)=>{
      const t0 = Date.now();
      (function loop(){
        if(cond()) return res(true);
        if(Date.now()-t0>timeout) return rej(new Error('poll timeout: '+cond.toString().slice(0,60)));
        w.setTimeout(loop, step);
      })();
    });
  }
  const cells = () => $$('#recoverGrid .wcell');
  const fillFirst = (n, word) => { const c=cells(); for(let i=0;i<n;i++) c[i].value = word; };
  const clearGrid = () => cells().forEach(c=>c.value='');

  async function main(){
    await poll(()=>$('#recoverBtn') && $('#tabs'));
    let pass=0, fail=0;
    const ok=(c,m)=>{ if(c){pass++;console.log('PASS',m);} else {fail++;console.log('FAIL',m);} };

    // switch to recover tab
    $('#tabs').querySelector('[data-tab="recover"]').click();
    ok(!$('#recoverInputCard').classList.contains('hidden'), 'recover tab visible');
    ok(cells().length===12, 'recover grid has 12 inputs');

    // ---- m=2 (last 2 blank) -> enumerate all 262144 ----
    clearGrid();
    fillFirst(10, 'abandon');
    $('#recoverBtn').click();
    await poll(()=>$$('#recoverOutput .mnemonic-card').length>0, 20000);
    ok($$('#recoverOutput .mnemonic-card').length===1000, 'm=2 display capped at 1000 cards');
    ok($('#recoverResultCount').textContent.includes('262,144'), 'm=2 total 262,144 (got '+$('#recoverResultCount').textContent+')');

    // ---- m=3 (last 3 blank) -> warn + cap 1万 ----
    $('#recoverClear').click();
    clearGrid();
    fillFirst(9, 'abandon');
    $('#recoverBtn').click();
    await poll(()=>!$('#recoverWarn').classList.contains('hidden'), 5000);
    ok(!$('#recoverWarn').classList.contains('hidden'), 'm=3 warning shown');
    ok($$('#recoverWarn .rw-cap').length===2, 'm=3 has 2 cap buttons (1万/10万)');
    $('#recoverWarn').querySelector('[data-cap="10000"]').click();
    await poll(()=>$('#recoverResultCount').textContent.includes('10,000'), 15000);
    ok($('#recoverResultCount').textContent.includes('10,000'), 'm=3 generated 10,000 (got '+$('#recoverResultCount').textContent+')');
    ok($$('#recoverOutput .mnemonic-card').length===1000, 'm=3 display capped 1000');

    // ---- m=6 (>5) -> warn + cap 100 + suggest other sw ----
    $('#recoverClear').click();
    clearGrid();
    fillFirst(6, 'abandon');
    $('#recoverBtn').click();
    await poll(()=>!$('#recoverWarn').classList.contains('hidden'), 5000);
    ok(!$('#recoverWarn').classList.contains('hidden'), 'm=6 warning shown');
    ok($$('#recoverWarn .rw-cap').length===1, 'm=6 has 1 cap button (100)');
    ok(!!$('#recoverWarn .rw-tip'), 'm=6 shows suggest-other-software tip');
    $('#recoverWarn').querySelector('[data-cap="100"]').click();
    await poll(()=>$('#recoverResultCount').textContent.includes('100'), 8000);
    ok($('#recoverResultCount').textContent.includes('100'), 'm=6 generated 100 (got '+$('#recoverResultCount').textContent+')');
    ok($$('#recoverOutput .mnemonic-card').length===100, 'm=6 shows 100 cards');

    // ---- ZH mode, m=2 ----
    $('#recoverClear').click();
    $('#recoverLang').querySelector('[data-lang="ZH"]').click();
    clearGrid();
    const zh = ['的','一','是','在','不','了','有','和','人','这'];
    const c = cells();
    for(let i=0;i<10;i++) c[i].value = zh[i];
    $('#recoverBtn').click();
    await poll(()=>$$('#recoverOutput .mnemonic-card').length>0, 20000);
    ok($('#recoverResultCount').textContent.includes('262,144'), 'ZH m=2 total 262,144 (got '+$('#recoverResultCount').textContent+')');

    // ---- unknown word error ----
    $('#recoverClear').click();
    $('#recoverLang').querySelector('[data-lang="EN"]').click();
    clearGrid();
    fillFirst(10, 'abandon');
    cells()[10].value = 'zzzznotaword';
    $('#recoverBtn').click();
    await poll(()=>$('#recoverStatus').textContent.includes('无法识别') || $('#recoverStatus').classList.contains('err'), 5000);
    ok($('#recoverStatus').classList.contains('err'), 'invalid word shows error status');

    console.log('\n==== RESULT ====');
    console.log('PASS='+pass+' FAIL='+fail);
    if(fail>0) process.exitCode = 1;
  }
  main().catch(e=>{ console.error('ERROR', e); process.exitCode=1; });
}
run();
