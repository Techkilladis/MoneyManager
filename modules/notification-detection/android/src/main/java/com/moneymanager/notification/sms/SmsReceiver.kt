package com.moneymanager.notification.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.moneymanager.notification.health.CaptureHealth

/**
 * Captures bank SMS the moment they arrive, even when the app isn't running,
 * and pops up the review screen for each new payment.
 */
class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return
        CaptureHealth.recordReceiverRun(context)
        val sender = messages[0].originatingAddress
        val body = messages.joinToString("") { it.messageBody ?: "" }
        val timestamp = messages[0].timestampMillis.takeIf { it > 0 } ?: System.currentTimeMillis()
        SmsIngest.process(context.applicationContext, sender, body, timestamp, popup = true)
    }
}
