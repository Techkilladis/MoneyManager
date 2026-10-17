package com.moneymanager.notification.health

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.service.notification.NotificationListenerService
import com.moneymanager.notification.MoneyManagerNotificationListenerService

/**
 * Records when the notification listener connects/disconnects and when UPI
 * notifications arrive, so the app can tell the user when auto-capture has
 * silently stopped (OEM battery savers often kill listeners).
 */
object CaptureHealth {
    private const val PREFS = "moneymanager_capture_health"
    private const val CONNECTED = "listenerConnected"
    private const val CONNECTED_AT = "lastConnectedAt"
    private const val DISCONNECTED_AT = "lastDisconnectedAt"
    private const val UPI_SEEN_AT = "lastUpiNotificationAt"
    private const val CAPTURED_AT = "lastCaptureAt"

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun recordConnected(context: Context) {
        prefs(context).edit().putBoolean(CONNECTED, true).putLong(CONNECTED_AT, System.currentTimeMillis()).apply()
    }

    fun recordDisconnected(context: Context) {
        prefs(context).edit().putBoolean(CONNECTED, false).putLong(DISCONNECTED_AT, System.currentTimeMillis()).apply()
    }

    fun recordUpiNotification(context: Context) {
        prefs(context).edit().putLong(UPI_SEEN_AT, System.currentTimeMillis()).apply()
    }

    fun recordCapture(context: Context) {
        prefs(context).edit().putLong(CAPTURED_AT, System.currentTimeMillis()).apply()
    }

    fun isIgnoringBatteryOptimizations(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    fun snapshot(context: Context): Map<String, Any?> {
        val p = prefs(context)
        fun time(key: String): Long? = p.getLong(key, 0L).takeIf { it > 0L }
        return mapOf(
            "listenerConnected" to p.getBoolean(CONNECTED, false),
            "lastConnectedAt" to time(CONNECTED_AT),
            "lastDisconnectedAt" to time(DISCONNECTED_AT),
            "lastUpiNotificationAt" to time(UPI_SEEN_AT),
            "lastCaptureAt" to time(CAPTURED_AT),
            "ignoringBatteryOptimizations" to isIgnoringBatteryOptimizations(context),
            "manufacturer" to Build.MANUFACTURER,
            "sdkInt" to Build.VERSION.SDK_INT
        )
    }

    /** Opens the system "allow background activity" prompt, falling back to the battery settings list. */
    fun requestIgnoreBatteryOptimizations(context: Context) {
        val direct = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
        val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        startFirst(context, direct, fallback)
    }

    /** App info screen, where OEM "Autostart" and battery toggles usually live. */
    fun openAppDetails(context: Context) {
        startFirst(context, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
    }

    /** Asks the system to reconnect the listener after it was killed. */
    fun requestRebind(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false
        return try {
            NotificationListenerService.requestRebind(ComponentName(context, MoneyManagerNotificationListenerService::class.java))
            true
        } catch (e: Exception) {
            android.util.Log.w("CaptureHealth", "requestRebind failed", e)
            false
        }
    }

    private fun startFirst(context: Context, vararg intents: Intent) {
        for (intent in intents) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                return
            } catch (e: Exception) {
                android.util.Log.w("CaptureHealth", "Could not open ${intent.action}", e)
            }
        }
    }
}
