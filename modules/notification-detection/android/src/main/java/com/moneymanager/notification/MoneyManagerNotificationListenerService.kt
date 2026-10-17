package com.moneymanager.notification

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.annotation.RequiresApi
import com.moneymanager.notification.normalizer.NormalizedNotification
import com.moneymanager.notification.parsers.ParserRegistry
import com.moneymanager.notification.store.PendingEventStore
import com.moneymanager.notification.store.PendingUpiEvent
import com.moneymanager.notification.dedupe.DedupeEngine
import com.moneymanager.notification.registry.UpiAppRegistry
import com.moneymanager.notification.access.NotificationAccessManager
import com.moneymanager.notification.health.CaptureHealth
import com.moneymanager.notification.widget.SpendWidgetProvider

/**
 * Android NotificationListenerService for detecting UPI payment notifications.
 * 
 * This service runs independently of the React Native JavaScript runtime
 * and can detect UPI notifications even when the app UI is not running.
 */
@RequiresApi(Build.VERSION_CODES.JELLY_BEAN_MR2)
class MoneyManagerNotificationListenerService : NotificationListenerService() {

    private lateinit var parserRegistry: ParserRegistry
    private lateinit var pendingEventStore: PendingEventStore
    private lateinit var dedupeEngine: DedupeEngine
    private lateinit var upiAppRegistry: UpiAppRegistry
    private lateinit var accessManager: NotificationAccessManager

    override fun onCreate() {
        super.onCreate()
        initializeComponents()
        android.util.Log.d(
            "MoneyManagerNotif",
            "listener service created; debuggable=" +
                ((applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0)
        )
    }

    private fun initializeComponents() {
        parserRegistry = ParserRegistry.getInstance(this)
        pendingEventStore = PendingEventStore.getInstance(this)
        dedupeEngine = DedupeEngine.getInstance(this)
        upiAppRegistry = UpiAppRegistry.getInstance(this)
        accessManager = NotificationAccessManager.getInstance(this)
        
        // Notify access manager that listener is active
        accessManager.onListenerCreated()
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        CaptureHealth.recordConnected(this)
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        CaptureHealth.recordDisconnected(this)
        // Ask to be reconnected; OEM battery savers often unbind listeners.
        CaptureHealth.requestRebind(this)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        super.onNotificationPosted(sbn)
        // Diagnostic: confirms listener callbacks are delivered (package only,
        // never content — content stays on-device in the pending-event store).
        android.util.Log.d("MoneyManagerNotif", "onNotificationPosted: ${sbn.packageName} (id=${sbn.id})")
        processNotification(sbn)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        super.onNotificationRemoved(sbn)
        // Handle notification removal if needed for dedupe tracking
        processNotificationRemoval(sbn)
    }

    private fun processNotification(sbn: StatusBarNotification) {
        try {
            // Check if this is from a supported UPI app
            val packageName = sbn.packageName
            val supported = upiAppRegistry.isSupportedUpiApp(packageName)
            android.util.Log.d("MoneyManagerNotif", "processNotification: pkg=$packageName supported=$supported")
            if (!supported) {
                return
            }
            CaptureHealth.recordUpiNotification(this)

            // Normalize the notification
            val normalized = NormalizedNotification.fromStatusBarNotification(sbn)
            android.util.Log.d(
                "MoneyManagerNotif",
                "normalized: titleLen=${normalized.title?.length ?: -1} textLen=${normalized.text?.length ?: -1} bigTextLen=${normalized.bigText?.length ?: -1} subTextLen=${normalized.subText?.length ?: -1}"
            )

            // Try to parse with registered parsers
            val parsed = parserRegistry.tryParse(normalized)
            android.util.Log.d("MoneyManagerNotif", "parse result: ${parsed != null}")

            if (parsed != null) {
                // Check for duplicates
                val dedupeKey = dedupeEngine.generateKey(parsed)
                val isDuplicate = dedupeEngine.isDuplicate(dedupeKey)
                android.util.Log.d("MoneyManagerNotif", "dedupe: key=$dedupeKey duplicate=$isDuplicate")
                if (isDuplicate) {
                    // Update existing event if needed
                    dedupeEngine.updateExisting(dedupeKey, parsed)
                    return
                }

                // Store as pending event
                val event = pendingEventStore.createEvent(
                    parsed = parsed,
                    notificationId = sbn.id.toString(),
                    dedupeKey = dedupeKey
                )
                android.util.Log.d("MoneyManagerNotif", "stored pending event: ${event.id}")

                // Register the key AFTER the event is durable so re-deliveries
                // of this notification are recognized as duplicates (both in
                // this process and after restarts, via SharedPreferences).
                dedupeEngine.markSeen(dedupeKey)
                CaptureHealth.recordCapture(this)
                SpendWidgetProvider.refreshAll(this)

                // Broadcast to React Native if available
                broadcastPendingEvent(event)
            }
        } catch (e: Exception) {
            // Log error but don't crash the service
            android.util.Log.e("MoneyManagerNotif", "Error processing notification", e)
        }
    }

    private fun processNotificationRemoval(sbn: StatusBarNotification) {
        // Handle notification removal if needed
        // Could update dedupe tracking
    }

    private fun broadcastPendingEvent(event: PendingUpiEvent) {
        try {
            val intent = Intent("com.moneymanager.NOTIFICATION_PENDING_EVENT")
            intent.putExtra("event", event.toBundle())
            sendBroadcast(intent)
        } catch (e: Exception) {
            android.util.Log.e("MoneyManagerNotif", "Error broadcasting event", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        accessManager.onListenerDestroyed()
    }

    companion object {
        fun isNotificationAccessEnabled(context: Context): Boolean {
            return NotificationAccessManager.isNotificationAccessEnabled(context)
        }

        fun openNotificationAccessSettings(context: Context) {
            NotificationAccessManager.openNotificationAccessSettings(context)
        }
    }
}