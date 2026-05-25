# 排障手册

## opencli doctor 未绿（超时）

**症状**：launch-browser.mjs 等待 30s 后报错 "Extension connected" 未出现。

**排查步骤**：

1. **确认 daemon 运行**
   ```powershell
   opencli doctor
   opencli daemon   # 若 daemon 未运行则先执行
   ```

2. **确认扩展文件完整**
   ```powershell
   Test-Path "$env:USERPROFILE\.opencli\browser-bridge-extension\manifest.json"
   Test-Path "$env:USERPROFILE\.opencli\browser-bridge-extension\dist\background.js"
   ```

3. **强制重新安装扩展**
   ```powershell
   node scripts/ensure-extension.mjs --force
   ```

4. **手动验证（不用本 skill）**
   ```powershell
   # 找到 Chromium 路径
   $exe = node -e "import('./lib/paths.mjs').then(m => m.getChromiumExecutablePath()).then(p => process.stdout.write(p))"
   # 手动启动
   & $exe --user-data-dir="$env:USERPROFILE\.opencli\chrome-profiles\test-manual" `
          --disable-web-security `
          --load-extension="$env:USERPROFILE\.opencli\browser-bridge-extension" `
          --disable-extensions-except="$env:USERPROFILE\.opencli\browser-bridge-extension"
   # 等待 5s 后检查
   opencli doctor
   ```

5. **开发者模式横幅**：首次加载 unpacked 扩展时 Chromium 会显示横幅，无需操作，不影响连接。

---

## 浏览器双开 / 僵尸进程

**症状**：`launcher.pid 进程存活` 但 doctor 未绿。

```powershell
# 查看现有 PID
Get-Content "$env:USERPROFILE\.opencli\chrome-profiles\opencli\launcher.pid"
# 终止
$chromePid = [int](Get-Content ...)
Stop-Process -Id $chromePid -Force -ErrorAction SilentlyContinue
# 删除 PID 文件
Remove-Item "$env:USERPROFILE\.opencli\chrome-profiles\opencli\launcher.pid"
# 重新启动
node scripts/launch-browser.mjs
```

---

## pnpm install 失败

**症状**：`pnpm install --frozen-lockfile` 失败。

```powershell
cd "$env:USERPROFILE\.cursor\skills\opencli-browser-launch\scripts"
Remove-Item -Recurse node_modules -ErrorAction SilentlyContinue
pnpm install
```

---

## Chromium 安装失败

**症状**：`playwright install chromium` 网络超时。

- 检查 npm registry 和 Playwright CDN 网络连通性
- 可设置代理：`$env:HTTPS_PROXY = "http://proxy:port"`
- 重试：`node scripts/ensure-playwright-browser.mjs`

---

## 扩展版本不匹配

**症状**：`update-check.json` 中 `latestExtensionVersion` 与 `manifest.json` 中版本不一致。

```powershell
node scripts/ensure-extension.mjs --force
# 或指定版本
node scripts/ensure-extension.mjs --version 1.0.15
```
