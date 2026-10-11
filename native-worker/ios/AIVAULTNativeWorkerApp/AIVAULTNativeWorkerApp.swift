import UIKit
import WebKit

@main
final class AIVAULTNativeWorkerApp: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let controller = AIVAULTWorkerViewController()
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
    func applicationDidBecomeActive(_ application: UIApplication) {
        (window?.rootViewController as? AIVAULTWorkerViewController)?.setFabricForeground(true)
    }
    func applicationWillResignActive(_ application: UIApplication) {
        (window?.rootViewController as? AIVAULTWorkerViewController)?.setFabricForeground(false)
    }
    func applicationDidEnterBackground(_ application: UIApplication) {
        (window?.rootViewController as? AIVAULTWorkerViewController)?.setFabricForeground(false)
    }
    func applicationWillTerminate(_ application: UIApplication) {
        (window?.rootViewController as? AIVAULTWorkerViewController)?.setFabricForeground(false)
    }
}

@MainActor
final class AIVAULTWorkerViewController: UIViewController, WKNavigationDelegate {
    private var webView: WKWebView!
    private var bridge: AIVAULTWebBridge!
    private let fabricSession = AIVAULTForegroundSessionV01()
    private let fabricStatus = UILabel()
    private let joinButton = UIButton(type: .system)
    private let stopButton = UIButton(type: .system)

    func setFabricForeground(_ active: Bool) { fabricSession.setForeground(active) }
    // Trusted native provisioning seam only; never exposed to WebBridge or URL.
    // A fresh scoped receiver/grant and trusted SecIdentity must be supplied.
    func configureFabricListener(_ listener: AIVAULTTensorTLSListenerV01, expiresAt: Date) {
        fabricSession.prepare(AIVAULTForegroundTLSV01(listener: listener), expiresAt: expiresAt)
    }
    @objc private func requestJoin() {
        guard fabricSession.canJoin else { return }
        let alert = UIAlertController(title: "加入算力池", message: "只在 App 前景接收已授權的張量工作。停止或離開前景後不自動重新加入；已開始的運算可能完成。", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel))
        alert.addAction(UIAlertAction(title: "加入", style: .default) { [weak self] _ in
            guard UIApplication.shared.applicationState == .active else { return }
            self?.fabricSession.join(consentGranted: true)
        })
        present(alert, animated: true)
    }
    @objc private func stopFabric() { fabricSession.stop() }
    private func refreshFabricStatus() {
        joinButton.isEnabled = fabricSession.canJoin
        stopButton.isEnabled = fabricSession.canStop
        switch fabricSession.status {
        case .blocked: fabricStatus.text = "BLOCKED：尚未配置節點憑證與任務授權，未加入算力池。"
        case .prepared: fabricStatus.text = "尚未加入；請明確選擇加入算力池。"
        case .starting: fabricStatus.text = "正在啟動張量接收器，尚未確認就緒。"
        case .listening: fabricStatus.text = "CONFIRMED：前景接收器已就緒。GPU 任務執行尚未驗證。"
        case .stopped: fabricStatus.text = "已停止新工作接收。再次加入需要新的任務授權。"
        case .expired: fabricStatus.text = "授權已到期，已停止接收；需要新的任務授權。"
        case .failed: fabricStatus.text = "BLOCKED：接收器啟動或連線失敗，已停止接收。"
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        fabricStatus.numberOfLines = 0
        fabricStatus.font = .preferredFont(forTextStyle: .footnote)
        fabricStatus.adjustsFontForContentSizeCategory = true
        fabricStatus.accessibilityIdentifier = "fabricSessionStatus"
        joinButton.setTitle("加入算力池", for: .normal)
        joinButton.accessibilityIdentifier = "fabricJoinButton"
        joinButton.addTarget(self, action: #selector(requestJoin), for: .touchUpInside)
        stopButton.setTitle("停止接收", for: .normal)
        stopButton.accessibilityIdentifier = "fabricStopButton"
        stopButton.addTarget(self, action: #selector(stopFabric), for: .touchUpInside)
        let buttons = UIStackView(arrangedSubviews: [joinButton, stopButton])
        buttons.distribution = .fillEqually
        let panel = UIStackView(arrangedSubviews: [fabricStatus, buttons])
        panel.axis = .vertical; panel.spacing = 8
        panel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(panel)
        fabricSession.onChange = { [weak self] in self?.refreshFabricStatus() }
        fabricSession.setForeground(UIApplication.shared.applicationState == .active)
        refreshFabricStatus()

        let configuration = WKWebViewConfiguration()
        bridge = AIVAULTWebBridge()
        bridge.install(on: configuration)

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            panel.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            panel.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            panel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            joinButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            stopButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            webView.topAnchor.constraint(equalTo: panel.bottomAnchor, constant: 8),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        let url = URL(string: "https://m9wmtcb782-arch.github.io/AIVAULT/compute-mesh-gpu-test.html")!
        webView.load(URLRequest(url: url))
    }
}
