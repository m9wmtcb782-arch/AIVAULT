# ENGINE-19｜Virtual Recovery & Healing

**狀態：開發中**｜可調 `timeScale`｜非真實醫學復原時間驗證

## 功能
傷害紀錄追蹤、紅腫／瘀青衰減、傷口進度、骨折限制解除、疲勞／休息。

## API
```js
recovery.registerInjury(injury);
recovery.setTimeScale(20);
recovery.tick(100, injuryEngine); // realDtMs
```
