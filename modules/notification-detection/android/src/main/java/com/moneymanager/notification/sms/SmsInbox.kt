package com.moneymanager.notification.sms

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Telephony
import android.util.Log
import com.moneymanager.notification.health.CaptureHealth

/** Reads the SMS inbox for bank messages that arrived while the app wasn't capturing. */
object SmsInbox {
    private const val TAG = "MoneyManagerSms"
    private const val PREFS = "moneymanager_sms_scan"
    private const val LAST_SCAN = "lastScanAt"
    private const val MAX_ROWS = 1000
    private const val HOUR_MS = 60L * 60 * 1000
    private const val DAY_MS = 24 * HOUR_MS

    fun hasPermission(context: Context): Boolean =
        context.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED &&
            context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED

    /**
     * Scans messages newer than the last scan (or [firstScanDays] back on the
     * first run). Already-seen messages are skipped by [SmsIngest], so the
     * one-hour overlap is safe.
     */
    fun scan(context: Context, firstScanDays: Int): Map<String, Int> {
        if (!hasPermission(context)) return mapOf("scanned" to 0, "captured" to 0)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val last = prefs.getLong(LAST_SCAN, 0L)
        val since = if (last > 0) last - HOUR_MS else now - firstScanDays * DAY_MS

        var scanned = 0
        var captured = 0
        try {
            context.contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
                "${Telephony.Sms.DATE} >= ?",
                arrayOf(since.toString()),
                "${Telephony.Sms.DATE} ASC"
            )?.use { c ->
                val addr = c.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val body = c.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val date = c.getColumnIndexOrThrow(Telephony.Sms.DATE)
                while (c.moveToNext() && scanned < MAX_ROWS) {
                    scanned++
                    if (SmsIngest.process(context, c.getString(addr), c.getString(body), c.getLong(date))) captured++
                }
            }
            prefs.edit().putLong(LAST_SCAN, now).apply()
            // After the first backfill, the live receiver should already have
            // caught every payment; one found here means the phone kept it away.
            if (last > 0 && captured > 0) CaptureHealth.recordMissed(context)
        } catch (e: Exception) {
            Log.e(TAG, "Inbox scan failed", e)
        }
        return mapOf("scanned" to scanned, "captured" to captured)
    }
}
