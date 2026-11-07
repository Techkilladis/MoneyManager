package com.moneymanager.notification.sms

import android.content.Context
import android.util.Log
import android.widget.Toast
import com.moneymanager.notification.health.CaptureHealth
import com.moneymanager.notification.parsers.ParsedUpiTransaction
import com.moneymanager.notification.store.PendingEventStore
import com.moneymanager.notification.widget.SpendWidgetProvider

/**
 * Shared path for live SMS (SmsReceiver) and inbox scans (SmsInbox):
 * parse -> skip if already seen -> store as a pending event.
 */
object SmsIngest {
    private const val TAG = "MoneyManagerSms"

    /**
     * Returns true when a new pending event was created. [popup] opens the
     * review screen for it: wanted for a live SMS, not for an inbox backfill.
     */
    fun process(context: Context, sender: String?, body: String?, timestamp: Long, popup: Boolean = false): Boolean {
        try {
            val result = SmsUpiParser.parse(sender, body) ?: return false
            CaptureHealth.recordUpiMessage(context)

            val direction = result.direction.name
            val key = SmsUpiParser.smsKey(sender, timestamp, body.orEmpty())
            val store = PendingEventStore.getInstance(context)
            if (store.isKnownSms(key, result.reference, result.amountPaise, direction, timestamp)) return false

            var confidence = 0.6
            if (result.counterparty != null) confidence += 0.2
            if (result.reference != null) confidence += 0.2

            val parsed = ParsedUpiTransaction(
                amountPaise = result.amountPaise,
                merchant = result.counterparty,
                sourceApp = "BANK_SMS",
                transactionTimestamp = timestamp,
                transactionReference = result.reference,
                parserName = "BankSmsParser",
                parserVersion = SmsUpiParser.VERSION,
                confidence = minOf(confidence, 1.0),
                direction = direction
            )
            val event = store.createEvent(parsed, notificationId = key.take(16), dedupeKey = key)
            CaptureHealth.recordCapture(context)
            SpendWidgetProvider.refreshAll(context)
            val autoMode = CaptureMode.isAutoMode(context)
            if (popup && !autoMode) {
                CapturePopup.show(context, event)
            } else if (autoMode) {
                Toast.makeText(context, "CDC saved", Toast.LENGTH_SHORT).show()
            }
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error processing SMS", e)
            return false
        }
    }
}
