# t-v102-mobile-stage2 构建窗口（workbuddy）

任务：`t-v102-mobile-stage2`（T5 手机端第二段：建 apps/mobile（Capacitor）并完成安卓实测）
开始：2026-10-17 11:35（本地）
完成：____（构建全部结束时填「已释放」）

## 占用声明（构建互斥）

- **Android Gradle 构建**：`apps/mobile/android/app/build`（`assembleDebug`）— 占用中
- 开工前检查（实测）：`tasklist` 无 `java.exe` / `gradle` 进程；本工作副本无其他 Android Gradle 构建在途
- 只构建 `apps/mobile`，不触碰 `apps/tv-android`（qoder 领域）

## 构建产物

- APK：`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- Web 产物：`apps/mobile/dist`（`npm run build` = tsc + vite）
- 日志：`outputs/testing/mobile-stage2-20261017/`
