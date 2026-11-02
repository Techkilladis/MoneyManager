package com.moneymanager.notification.health

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

/**
 * Records when UPI bank SMS are seen and captured, so the app can show the
 * user when auto-capture last worked.
 */
object CaptureHealth {
    private const val PREFS = "moneymanager_capture_health"
    private const val UPI_SEEN_AT = "lastUpiMessageAt"
    private const val CAPTURED_AT = "lastCaptureAt"
    private const val RECEIVER_AT = "lastReceiverAt"
    private const val MISSED_AT = "lastMissedAt"

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** The live SMS receiver ran, so the phone is delivering SMS to the app. */
    fun recordReceiverRun(context: Context) {
        prefs(context).edit().putLong(RECEIVER_AT, System.currentTimeMillis()).apply()
    }

    /**
     * An inbox scan found a UPI payment the live receiver never saw: the phone
     * didn't wake the app for that SMS (usually Autostart is off).
     */
    fun recordMissed(context: Context) {
        prefs(context).edit().putLong(MISSED_AT, System.currentTimeMillis()).apply()
    }

    fun recordUpiMessage(context: Context) {
        prefs(context).edit().putLong(UPI_SEEN_AT, System.currentTimeMillis()).apply()
    }

    fun recordCapture(context: Context) {
        prefs(context).edit().putLong(CAPTURED_AT, System.currentTimeMillis()).apply()
    }

    fun snapshot(context: Context): Map<String, Any?> {
        val p = prefs(context)
        fun time(key: String): Long? = p.getLong(key, 0L).takeIf { it > 0L }
        return mapOf(
            "lastUpiMessageAt" to time(UPI_SEEN_AT),
            "lastCaptureAt" to time(CAPTURED_AT),
            "lastReceiverAt" to time(RECEIVER_AT),
            "lastMissedAt" to time(MISSED_AT),
            "manufacturer" to Build.MANUFACTURER,
            "sdkInt" to Build.VERSION.SDK_INT
        )
    }

    /** App info screen, where the SMS permission can be re-enabled after being denied. */
    fun openAppDetails(context: Context) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            android.util.Log.w("CaptureHealth", "Could not open app settings", e)
        }
    }
}
