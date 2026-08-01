# 助记词自动补全工具

> BIP39 助记词补全 + BTC / ETH / SOL / SUI 地址与私钥派生 · 纯前端单文件离线应用

## 简介

这是一个**完全离线运行**的 BIP39 助记词补全工具。输入已知的前 10/11 或 22/23 个词，工具会枚举所有校验和合法的完整助记词，并派生首个地址与私钥。

支持 BTC（Legacy / Nested SegWit / Native SegWit / Taproot 四种路径）、ETH、SOL、SUI。

## 特性

- 🔒 **完全离线**：所有计算在浏览器本地完成，数据不上传任何服务器
- ✅ **BIP39 标准**：实现完整的校验和枚举逻辑，SHA-256 纯 JS 实现
- 🌐 **多语言词表**：支持英文与简体中文 BIP39 词表
- 🔑 **多链派生**：BTC / ETH / SOL / SUI 的 BIP32/BIP44 地址与私钥派生
- 📦 **单文件应用**：构建后仅需一个 `index.html`，浏览器直接打开即可使用
- 🖼️ **二维码导出**：助记词、地址、私钥均可生成二维码，可批量导出 TXT

## 在线体验

开启 GitHub Pages 后可直接访问在线版（见下方部署说明），也可直接下载 `index.html` 用浏览器打开。

## 本地构建

```bash
# 1. 安装地址派生模块依赖
cd crypto_build
npm install

# 2. 打包派生逻辑（生成 derive.bundle.js）
npx esbuild derive.js --bundle --format=esm --outfile=derive.bundle.js

# 3. 构建单文件 index.html
cd ..
python build.py
```

构建完成后，直接用浏览器打开 `index.html` 即可。

## 项目结构

```
├── index.html                  # 构建产物（单文件应用，可直接打开）
├── template.html               # HTML 模板
├── build.py                    # 构建脚本（把模板 + 词表 + JS 打包成 index.html）
├── mnemonic_core.js            # BIP39 补全核心逻辑（纯 JS，含 SHA-256）
├── test_core.js                # 核心补全逻辑测试
├── assets/
│   ├── english.txt             # BIP39 英文词表（2048 词）
│   ├── chinese_simplified.txt  # BIP39 简体中文词表（2048 字）
│   └── qrcode.js               # QR 码生成库
└── crypto_build/
    ├── derive.js               # 地址派生源码（BTC/ETH/SOL/SUI）
    ├── derive.bundle.js        # esbuild 打包后的派生逻辑
    ├── derive.test.mjs         # 派生逻辑测试
    ├── e2e*.mjs / e2e*.cjs     # 端到端测试
    └── package.json            # 依赖配置
```

## 运行测试

```bash
# 核心补全逻辑测试（SHA-256 向量、12/24 词枚举数量、校验和独立验证）
node test_core.js

# 地址派生逻辑测试
node crypto_build/derive.test.mjs
```

## GitHub Pages 部署

1. Fork 或推送本仓库到 GitHub
2. 进入仓库 **Settings → Pages**
3. Source 选择 `Deploy from a branch`，分支选 `main`，目录选 `/ (root)`
4. 保存后几分钟即可通过 `https://<用户名>.github.io/<仓库名>/` 访问

## ⚠️ 安全声明

- 本工具**仅用于恢复你本人的助记词**，请勿用于任何非法用途
- 工具完全离线运行，不收集、不上传任何数据
- 私钥极其敏感，生成的私钥请妥善保管，切勿泄露给他人
- 使用本工具产生的任何后果由使用者自行承担

## 技术栈

- 纯 JavaScript（无前端框架）
- BIP39 / BIP32 / BIP44 标准
- [@noble/curves](https://github.com/paulmillr/noble-curves)、[@scure/bip39](https://github.com/paulmillr/scure-bip39) 等密码学库（地址派生）
- [esbuild](https://esbuild.github.io/) 打包

## License

MIT
