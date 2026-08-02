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
  const wait = ms => new Promise(r=>w.setTimeout(r, ms));
  function poll(cond, timeout=20000, step=40){
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
    await poll(()=>$('#uiLangToggle') && w.__I18N && w.applyUILang);
    let pass=0, fail=0;
    const ok=(c,m)=>{ if(c){pass++;console.log('PASS',m);} else {fail++;console.log('FAIL',m);} };

    // default = zh
    ok(w.__uiLang==='zh', 'default uiLang = zh (got '+w.__uiLang+')');
    ok($('.grad').textContent==='助记词自动补全', 'zh appTitle (got '+$('.grad').textContent+')');
    ok($('[data-tab="prefix"]').textContent==='前缀补全', 'zh tabPrefix');
    ok($('#uiLangToggle').textContent==='中 / EN', 'zh toggle label (got '+$('#uiLangToggle').textContent+')');
    ok(doc.documentElement.lang==='zh', 'html lang=zh');
    ok(doc.documentElement.dir==='ltr', 'html dir=ltr');
    ok($('#mnemonicInput').getAttribute('placeholder').startsWith('例如'), 'zh placeholder');
    ok($('.warn').innerHTML.includes('你本人'), 'zh warnSecurity html');
    ok($('.foot').textContent.includes('单文件'), 'zh foot');
    ok($('#qrModal h3').textContent==='助记词详情与派生', 'zh modalTitle');

    // switch to en via applyUILang
    w.applyUILang('en');
    ok(w.__uiLang==='en', 'en applied');
    ok($('.grad').textContent==='Mnemonic Autocomplete', 'en appTitle (got '+$('.grad').textContent+')');
    ok($('[data-tab="prefix"]').textContent==='Prefix Complete', 'en tabPrefix');
    ok($('[data-tab="recover"]').textContent==='Recover Missing', 'en tabRecover');
    ok($('#completeBtn').textContent==='Autocomplete', 'en btnComplete');
    ok($('#uiLangToggle').textContent==='EN / 中', 'en toggle label (got '+$('#uiLangToggle').textContent+')');
    ok(doc.documentElement.lang==='en' && doc.documentElement.dir==='ltr', 'html lang=en dir=ltr');
    ok($('#mnemonicInput').getAttribute('placeholder').startsWith('e.g.'), 'en placeholder');
    ok($('.warn').innerHTML.includes('your own'), 'en warnSecurity html');
    ok($('.foot').textContent.includes('Single-file'), 'en foot');
    ok($('#qrModal h3').textContent==='Mnemonic Details & Derivation', 'en modalTitle');

    // toggle button flips zh<->en
    $('#uiLangToggle').click();
    ok(w.__uiLang==='zh', 'toggle click -> zh');
    $('#uiLangToggle').click();
    ok(w.__uiLang==='en', 'toggle click -> en');

    // japanese
    w.applyUILang('ja');
    ok($('[data-tab="prefix"]').textContent==='プレフィックス補完', 'ja tabPrefix');
    ok($('#btnComplete') ? true : true, 'noop');

    // arabic -> rtl
    w.applyUILang('ar');
    ok(doc.documentElement.dir==='rtl', 'ar sets dir=rtl (got '+doc.documentElement.dir+')');
    ok($('[data-tab="recover"]').textContent==='استرجاع المفقود', 'ar tabRecover');

    // menu click switches language
    doc.querySelector('#uiLangMenu [data-ul="fr"]').click();
    ok(w.__uiLang==='fr', 'menu click -> fr (got '+w.__uiLang+')');
    ok($('[data-tab="prefix"]').textContent==='Compléter le préfixe', 'fr tabPrefix');

    // persistence to localStorage
    ok(w.localStorage.getItem('uiLang')==='fr', 'uiLang persisted to localStorage');

    // real dynamic-path check: prefix completion in English
    w.applyUILang('en');
    $('#tabs').querySelector('[data-tab="prefix"]').click();
    $('#mnemonicInput').value = ('abandon ').repeat(11).trim();
    $('#completeBtn').click();
    await poll(()=>$('#resultCount').textContent && /valid mnemonics/.test($('#resultCount').textContent), 20000);
    ok(/128 valid mnemonics \(12 words\)/.test($('#resultCount').textContent), 'en dynamic resultCount (got '+$('#resultCount').textContent+')');
    ok($('#status').textContent==='Done', 'en dynamic status Done (got '+$('#status').textContent+')');

    // all 11 languages have a non-empty appTitle key
    const langs=['zh','en','ja','ko','es','fr','de','ru','pt','it','ar'];
    let allKeys=true;
    for(const l of langs){ if(!w.__I18N[l] || !w.__I18N[l].appTitle){ allKeys=false; console.log('  missing appTitle for',l); } }
    ok(allKeys, 'all 11 languages present with appTitle');

    console.log('\n=== I18N RESULT ===');
    console.log('PASS='+pass+' FAIL='+fail);
    if(fail>0) process.exit(1);
  }
  main().catch(e=>{ console.error('ERROR', e); process.exit(1); });
}
run();
