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

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        super.onNotificationPosted(sbn)
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
            if (!upiAppRegistry.isSupportedUpiApp(packageName)) {
                return
            }

            // Normalize the notification
            val normalized = NormalizedNotification.fromStatusBarNotification(sbn)
            
            // Try to parse with registered parsers
            val parsed = parserRegistry.tryParse(normalized)
            
            if (parsed != null) {
                // Check for duplicates
                val dedupeKey = dedupeEngine.generateKey(parsed)
                if (dedupeEngine.isDuplicate(dedupeKey)) {
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