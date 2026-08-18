import pathlib

root = pathlib.Path('D:/D/music/safe')

def load_words(p):
    words = [w for w in p.read_text(encoding='utf-8').split('\n') if w.strip()]
    return words

en_words = load_words(root / 'assets/english.txt')
zh_words = load_words(root / 'assets/chinese_simplified.txt')
zht_words = load_words(root / 'assets/chinese_traditional.txt')
ja_words  = load_words(root / 'assets/japanese.txt')
ko_words  = load_words(root / 'assets/korean.txt')
es_words  = load_words(root / 'assets/spanish.txt')
fr_words  = load_words(root / 'assets/french.txt')
it_words  = load_words(root / 'assets/italian.txt')
cs_words  = load_words(root / 'assets/czech.txt')
pt_words  = load_words(root / 'assets/portuguese.txt')
qr_js = (root / 'assets/qrcode.js').read_text(encoding='utf-8')
core_js = (root / 'mnemonic_core.js').read_text(encoding='utf-8')
derive_js = (root / 'crypto_build/derivation.bundle.js').read_text(encoding='utf-8')

assert len(en_words) == 2048, f"EN wordlist must be 2048, got {len(en_words)}"
assert len(zh_words) == 2048, f"ZH wordlist must be 2048, got {len(zh_words)}"
assert len(zht_words) == 2048, f"ZHT wordlist must be 2048, got {len(zht_words)}"
assert len(ja_words) == 2048, f"JA wordlist must be 2048, got {len(ja_words)}"
assert len(ko_words) == 2048, f"KO wordlist must be 2048, got {len(ko_words)}"
assert len(es_words) == 2048, f"ES wordlist must be 2048, got {len(es_words)}"
assert len(fr_words) == 2048, f"FR wordlist must be 2048, got {len(fr_words)}"
assert len(it_words) == 2048, f"IT wordlist must be 2048, got {len(it_words)}"
assert len(cs_words) == 2048, f"CS wordlist must be 2048, got {len(cs_words)}"
assert len(pt_words) == 2048, f"PT wordlist must be 2048, got {len(pt_words)}"

t = (root / 'template.html').read_text(encoding='utf-8')
# EN/ZH are inlined directly in template.html as JS arrays (kept inline so the
# recovery-generator unit test can run without a build). The other 9 languages
# are injected via placeholders.
t = t.replace('__WORD_ZHT__', ' '.join(zht_words))
t = t.replace('__WORD_JA__', ' '.join(ja_words))
t = t.replace('__WORD_KO__', ' '.join(ko_words))
t = t.replace('__WORD_ES__', ' '.join(es_words))
t = t.replace('__WORD_FR__', ' '.join(fr_words))
t = t.replace('__WORD_IT__', ' '.join(it_words))
t = t.replace('__WORD_CS__', ' '.join(cs_words))
t = t.replace('__WORD_PT__', ' '.join(pt_words))
t = t.replace('__QR_JS__', qr_js)
t = t.replace('__CORE_JS__', core_js)
t = t.replace('__DERIVE_JS__', derive_js)

# sanity: no leftover placeholders
for ph in ['__WORD_ZHT__', '__WORD_JA__', '__WORD_KO__', '__WORD_ES__',
           '__WORD_FR__', '__WORD_IT__', '__WORD_CS__', '__WORD_PT__',
           '__QR_JS__', '__CORE_JS__', '__DERIVE_JS__']:
    assert ph not in t, f"placeholder {ph} left in output"

# Write to a temp file, then atomically replace the target. This uses
# MoveFileEx(REPLACE_EXISTING) semantics, which can replace a file that is
# held open by another process (e.g. an IDE file watcher) — unlike a direct
# exclusive CreateFileW/open('w'), which gets ERROR_ACCESS_DENIED (le=5).
import os, tempfile
tmpfd, tmpname = tempfile.mkstemp(dir=str(root), suffix='.tmp')
try:
    with os.fdopen(tmpfd, 'w', encoding='utf-8') as f:
        f.write(t)
    os.replace(tmpname, str(root / 'index.html'))
finally:
    if os.path.exists(tmpname):
        try: os.remove(tmpname)
        except OSError: pass
print('wrote', root / 'index.html', '| bytes =', len(t.encode('utf-8')))
print('EN words:', len(en_words), '| ZH words:', len(zh_words))
