package ai.aivault.compute

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.view.ViewGroup
import java.util.concurrent.Executors

/** Local opt-in hardware proof only. No network, background work or GPU credit. */
class MainActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var status: TextView
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(36, 48, 36, 36)
        }
        status = TextView(this).apply {
            text = "AIVAULT GPU Worker\n尚未測試。此版本只驗證本機 GPU，不會連線或提供算力。"
            textSize = 18f
        }
        val button = Button(this).apply {
            text = "測試我的 GPU"
            setOnClickListener {
                isEnabled = false
                status.text = "正在執行原生 OpenGL ES 3.0 GPU 測試…"
                executor.execute {
                    val result = try { NativeGpu().probe(256, 1) }
                                 catch (e: Throwable) { "ERROR:" + (e.message ?: e.javaClass.simpleName) }
                    runOnUiThread {
                        status.text = if (result.startsWith("VERIFIED:"))
                            "GPU 真實運算與校驗通過\n$result\n尚未加入算力池"
                        else "GPU 測試未通過\n$result"
                        isEnabled = true
                    }
                }
            }
        }
        layout.addView(status, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        layout.addView(button, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        setContentView(layout)
    }
    override fun onDestroy() {
        executor.shutdown()
        super.onDestroy()
    }
}
