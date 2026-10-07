# AIVAULT Native Worker — iOS v1

這是 AIVAULT Compute Mesh 的原生 iOS Worker 第一階段骨架。

架構：

iOS AIVAULT Native Worker
→ WKWebView
→ 注入 window.aivaultNativeHardware
→ 現有 compute-mesh-gpu-test.html
→ 下一階段才加入註冊、heartbeat、任務執行

Apple 官方文件確認 WKWebView 可承載 Web 內容，而 WKUserContentController 可注入 JavaScript 並建立 JavaScript 與原生程式之間的橋接。此方式適合把現有 Compute Mesh 測試頁放進原生 Worker，而不是另外複製一套網頁。 

v1 收集：
- iOS model
- hw.machine（若可取得，仍標示 REQUIRES TEST）
- iOS version
- logical CPU
- physical CPU（若可取得）
- active CPU
- physical RAM
- Metal GPU name（若可取得）
- Metal working-set limit（若可取得）
- Metal max threads per threadgroup
- ray-tracing capability（若可取得）
- display size/scale
- NPU 狀態

重要：
UIDevice.model 可能只回傳「iPhone」這類通用字串，因此不把它當成精確行銷型號。
不使用 identifierForVendor 當硬體身份。
Worker node ID 後續應是 App 自己產生的隨機 UUID，而不是硬體序號。

目前狀態：
- Native source scaffold：CONFIRMED
- 真實 iPhone 17 原生建置：NOT VERIFIED
- 真實 iPhone 17 精確型號識別：NOT VERIFIED
- Native Metal 執行：NOT IMPLEMENTED
- Compute Coordinator 註冊：NOT IMPLEMENTED
- 現有 browser Worker UI：UNCHANGED
- Dark Star/Gemini：UNCHANGED

下一階段：
1. 建立 iOS Xcode App target
2. 用 WKWebView 載入現有 Compute Mesh 測試頁
3. 在載入前安裝 AIVAULTWebBridge
4. 用真實 iPhone 17 執行
5. 確認硬體面板出現 native 資料
6. 再加入 native worker registration/heartbeat
7. 最後再做 native Metal 任務執行
