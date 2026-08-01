const { Window } = require('happy-dom');
function tryEval(label, code){
  const w = new Window({ url:'http://localhost/' });
  try { w.eval(code); console.log(label, 'OK'); }
  catch(e){ console.log(label, 'ERR:', e.message); }
}
tryEval('makeQRsmall', 'function makeQRsmall(t){const q=qrcode(0,"M");q.addData(t);q.make();return q.createSvgTag(2,2);}');
tryEval('esc-regex', "function esc(s){return String(s).replace(/[&<>\"]'/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c];});}");
tryEval('fallbackCopy', 'function fallbackCopy(t){try{var ta=document.createElement("textarea");ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);}catch(e){}}');
tryEval('copyText', 'function copyText(t){try{if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t).catch(function(){});}else{}}catch(e){}}');
