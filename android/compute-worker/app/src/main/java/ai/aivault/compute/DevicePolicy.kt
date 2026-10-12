package ai.aivault.compute

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

/** Read-only safety gates. Local diagnostic may run without charging;
 * future sustained contribution MUST call inspect() before each lease. */
object DevicePolicy {
    data class Status(
        val charging: Boolean,
        val batteryPercent: Int?,
        val thermalOkay: Boolean,
        val thermalLevel: Int?,
        val wifiConnected: Boolean,
        val canContribute: Boolean,
        val reason: String
    )

    fun inspect(context: Context): Status {
        val battery = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val percent = if (level >= 0 && scale > 0) level * 100 / scale else null
        val state = battery?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val charging = state == BatteryManager.BATTERY_STATUS_CHARGING ||
            state == BatteryManager.BATTERY_STATUS_FULL
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val thermal = if (Build.VERSION.SDK_INT >= 29) pm.currentThermalStatus else null
        val thermalOkay = thermal == null || thermal < PowerManager.THERMAL_STATUS_MODERATE
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork
        val caps = network?.let { cm.getNetworkCapabilities(it) }
        val wifi = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        val reason = when {
            !wifi -> "未連接 Wi-Fi，暫停持續算力"
            !charging -> "請連接充電器後再提供持續算力"
            percent == null -> "無法確認電量，暫停持續算力"
            percent < 30 -> "電量低於 30%，暫停持續算力"
            !thermalOkay -> "裝置溫度偏高，暫停持續算力"
            else -> "電力與溫度條件通過；使用者授權仍須另外驗證"
        }
        val allowed = wifi && charging && percent != null && percent >= 30 && thermalOkay
        return Status(charging, percent, thermalOkay, thermal, wifi, allowed, reason)
    }
}
