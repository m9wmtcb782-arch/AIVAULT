# Dark Star Wake

控管者：base-001:technical-dark-star
入口：Issue #30

## 現況
runtime.mjs 可輪詢 Issue #30，跳過已處理與自己的留言，回覆並標記。

## 需要
- ctx.github.token
- ctx.github.owner = m9wmtcb782-arch
- ctx.github.repo = AIVAULT
- ctx.github.actor = 執行者帳號

## 限制
每次最多處理 3 則。
不寫死 provider。
不自動部署。
