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
  const input = () => $('#mnemonicInput');
  const cards = () => $$('.mnemonic-card').length;
  const click = el => { if(!el) throw new Error('no el'); el.click(); };
  const wait = ms => new Promise(r=>w.setTimeout(r, ms));

  function poll(cond, timeout=8000, step=40){
    return new Promise((res, rej)=>{
      const t0 = Date.now();
      (function loop(){
        if(cond()) return res(true);
        if(Date.now()-t0>timeout) return rej(new Error('poll timeout'));
        w.setTimeout(loop, step);
      })();
    });
  }

  async function main(){
    await poll(()=>$('#quickFill') && $('#completeBtn'));
    let pass = 0, fail = 0;
    const ok = (c, m) => { if(c){ pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };

    // EN 前11 -> 128 cards
    $('#langSeg').querySelector('[data-lang="EN"]').click();
    click($('#quickFill').querySelector('[data-q="11"]'));
    ok(input().value.trim().split(/\s+/).length === 11, '前11 fills 11 EN words');
    click($('#completeBtn'));
    await poll(()=>cards()>0, 8000);
    ok(cards() === 128, '前11 completion yields 128 cards (got '+cards()+')');

    // clear, EN 前23 -> 8 cards
    click($('#clearBtn'));
    click($('#quickFill').querySelector('[data-q="23"]'));
    ok(input().value.trim().split(/\s+/).length === 23, '前23 fills 23 EN words');
    click($('#completeBtn'));
    await poll(()=>cards()>0, 8000);
    ok(cards() === 8, '前23 completion yields 8 cards (got '+cards()+')');

    // EN 随机生成 -> 12 valid words
    click($('#clearBtn'));
    click($('#quickFill').querySelector('[data-q="rand"]'));
    const rwords = input().value.trim().split(/\s+/);
    ok(rwords.length === 12, '随机生成 fills 12 EN words (got '+rwords.length+')');
    ok(rwords.every(x=>/^[a-z]+$/.test(x)), '随机生成 words are lowercase EN');

    // ZH 前11 -> 128 cards
    click($('#clearBtn'));
    $('#langSeg').querySelector('[data-lang="ZH"]').click();
    click($('#quickFill').querySelector('[data-q="11"]'));
    const zhTokens = input().value.trim().split(/\s+/);
    ok(zhTokens.length === 11 && zhTokens.every(c=>c.length===1), '前11 (ZH) fills 11 chinese chars');
    click($('#completeBtn'));
    await poll(()=>cards()>0, 8000);
    ok(cards() === 128, '前11 (ZH) completion yields 128 cards (got '+cards()+')');

    // EN 前10 -> heavy (262144). Verify fill, then attempt completion within 25s.
    click($('#clearBtn'));
    $('#langSeg').querySelector('[data-lang="EN"]').click();
    click($('#quickFill').querySelector('[data-q="10"]'));
    ok(input().value.trim().split(/\s+/).length === 10, '前10 fills 10 EN words');
    click($('#completeBtn'));
    try {
      await poll(()=>$('#resultCount').textContent.includes('262,144'), 25000);
      ok(true, '前10 completion reaches 262,144 count');
    } catch(e){
      ok(false, '前10 completion did not finish in 25s (count='+$('#resultCount').textContent+')');
    }

    console.log('\n==== RESULT ====');
    console.log('PASS='+pass+' FAIL='+fail);
    if(fail>0) process.exitCode = 1;
  }

  main().catch(e=>{ console.error('ERROR', e); process.exitCode = 1; });
}
run();
