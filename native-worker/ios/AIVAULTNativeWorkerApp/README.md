# AIVAULT Compute Mesh Worker — iOS App shell

This target is the next layer above the native hardware collector.

It loads the existing GitHub Pages Compute Mesh worker page inside WKWebView and installs the native hardware bridge before navigation.

URL loaded by the app:
https://m9wmtcb782-arch.github.io/AIVAULT/compute-mesh-gpu-test.html

The app does NOT yet:
- create a Compute Mesh worker registration
- send heartbeat directly from native code
- execute remote tasks with Metal
- consume Grok or Kling APIs

Those remain separate phases.

Status:
- App source shell: CONFIRMED
- Xcode project file: NOT YET CREATED
- Real iPhone build/install: NOT VERIFIED
- Native hardware visible in page: NOT VERIFIED
- Native Metal execution: NOT IMPLEMENTED
