package com.moneymanager.notification.sms

import android.annotation.SuppressLint
import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.moneymanager.notification.health.CaptureHealth
import com.moneymanager.notification.store.PendingUpiEvent
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Locale

/**
 * Puts a payment captured from a live bank SMS in front of the user: opens the
 * review screen right away when "Display over other apps" is allowed (Android
 * blocks background activity starts otherwise) and posts a heads-up
 * notification that opens the same screen. A payment that isn't reviewed
 * simply stays pending.
 */
object CapturePopup {
    private const val TAG = "MoneyManagerSms"
    private const val CHANNEL_ID = "upi-captures"
    private const val NOTIFICATION_TAG = "upi-capture"
    private const val BRAND_COLOR = 0xFF4F46E5.toInt()

    // Must match "scheme" in app.json; Expo Router opens app/quick-capture.tsx.
    private const val REVIEW_URL = "moneymanager://quick-capture"

    /** "Display over other apps" lets the app open itself when a payment arrives. */
    fun canOpenDirectly(context: Context): Boolean = Settings.canDrawOverlays(context)

    fun canNotify(context: Context): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

    fun show(context: Context, event: PendingUpiEvent) {
        // When the SMS interrupts another app, the review screen hands the
        // phone back to it once the payment is confirmed or ignored.
        val intent = reviewIntent(context, event.id, leaveAfter = !isAppInForeground()) ?: return
        notify(context, event, intent)
        if (!canOpenDirectly(context)) return
        try {
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.w(TAG, "Could not open the review screen", e)
        }
    }

    /** Removes the notification once the payment is confirmed or ignored. */
    fun cancel(context: Context, eventId: String) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_TAG, eventId.hashCode())
    }

    fun openOverlaySettings(context: Context) {
        try {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            // Some OEM builds hide the per-app overlay screen.
            CaptureHealth.openAppDetails(context)
        }
    }

    private fun isAppInForeground(): Boolean {
        val info = ActivityManager.RunningAppProcessInfo()
        ActivityManager.getMyMemoryState(info)
        return info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    }

    private fun reviewIntent(context: Context, eventId: String, leaveAfter: Boolean): Intent? {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
        intent.action = Intent.ACTION_VIEW
        intent.removeCategory(Intent.CATEGORY_LAUNCHER)
        val leave = if (leaveAfter) "&leave=1" else ""
        intent.data = Uri.parse("$REVIEW_URL?sourceEventId=${Uri.encode(eventId)}$leave")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return intent
    }

    @SuppressLint("MissingPermission") // areNotificationsEnabled() covers POST_NOTIFICATIONS
    private fun notify(context: Context, event: PendingUpiEvent, intent: Intent) {
        val manager = NotificationManagerCompat.from(context)
        if (!manager.areNotificationsEnabled()) return
        ensureChannel(context)

        val amount = formatRupees(event.amountPaise)
        val party = event.merchant.takeIf { it.isNotBlank() }
        val title = when {
            event.direction == "CREDIT" && party != null -> "$amount received from $party"
            event.direction == "CREDIT" -> "$amount received"
            party != null -> "$amount paid to $party"
            else -> "$amount paid"
        }
        val tap = PendingIntent.getActivity(
            context,
            event.id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(smallIcon(context))
            .setColor(BRAND_COLOR)
            .setContentTitle(title)
            .setContentText("Tap to add a category and note")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setWhen(event.transactionTimestamp)
            .setShowWhen(true)
            .setAutoCancel(true)
            .setContentIntent(tap)
            .build()
        try {
            manager.notify(NOTIFICATION_TAG, event.id.hashCode(), notification)
        } catch (e: SecurityException) {
            Log.w(TAG, "Notification permission missing", e)
        }
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(CHANNEL_ID, "Detected payments", NotificationManager.IMPORTANCE_HIGH)
        channel.description = "A UPI payment was found in a bank SMS and is ready to review"
        manager.createNotificationChannel(channel)
    }

    /** The monochrome icon generated by the expo-notifications plugin, else the app icon. */
    private fun smallIcon(context: Context): Int =
        context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
            .takeIf { it != 0 } ?: context.applicationInfo.icon

    private fun formatRupees(paise: Long): String =
        NumberFormat.getCurrencyInstance(Locale("en", "IN")).format(BigDecimal.valueOf(paise, 2))
}
