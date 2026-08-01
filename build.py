import pathlib

root = pathlib.Path('D:/D/music/safe')

def load_words(p):
    words = [w for w in p.read_text(encoding='utf-8').split('\n') if w.strip()]
    return words

en_words = load_words(root / 'assets/english.txt')
zh_words = load_words(root / 'assets/chinese_simplified.txt')
qr_js = (root / 'assets/qrcode.js').read_text(encoding='utf-8')
core_js = (root / 'mnemonic_core.js').read_text(encoding='utf-8')
derive_js = (root / 'crypto_build/derive.bundle.js').read_text(encoding='utf-8')

assert len(en_words) == 2048, f"EN wordlist must be 2048, got {len(en_words)}"
assert len(zh_words) == 2048, f"ZH wordlist must be 2048, got {len(zh_words)}"

t = (root / 'template.html').read_text(encoding='utf-8')
t = t.replace('__WORD_EN__', ' '.join(en_words))
t = t.replace('__WORD_ZH__', ' '.join(zh_words))
t = t.replace('__QR_JS__', qr_js)
t = t.replace('__CORE_JS__', core_js)
t = t.replace('__DERIVE_JS__', derive_js)

# sanity: no leftover placeholders
for ph in ['__WORD_EN__', '__WORD_ZH__', '__QR_JS__', '__CORE_JS__', '__DERIVE_JS__']:
    assert ph not in t, f"placeholder {ph} left in output"

out = root / 'index.html'
out.write_text(t, encoding='utf-8')
print('wrote', out, '| bytes =', len(t.encode('utf-8')))
print('EN words:', len(en_words), '| ZH words:', len(zh_words))
