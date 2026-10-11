package com.moneymanager.notification.access

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.util.Log

/**
 * Manages notification access permission state.
 * Provides utilities to check if notification access is enabled
 * and to open the notification access settings.
 */
class NotificationAccessManager private constructor(context: Context) {

    private val context: Context = context.applicationContext
    private var listenerCreated = false

    companion object {
        @Volatile
        private var INSTANCE: NotificationAccessManager? = null

        fun getInstance(context: Context): NotificationAccessManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: NotificationAccessManager(context.applicationContext).also { INSTANCE = it }
            }
        }

        /**
         * Checks if notification access is enabled for this app.
         */
        fun isNotificationAccessEnabled(context: Context): Boolean {
            // "enabled_notification_listeners" is Settings.Secure.ENABLED_NOTIFICATION_LISTENERS,
            // which is not part of the public Android SDK, so the raw value is used here.
            val enabledListeners = Settings.Secure.getString(
                context.contentResolver,
                "enabled_notification_listeners"
            )
            return enabledListeners?.contains(context.packageName) == true
        }

        /**
         * Opens the notification access settings screen.
         */
        fun openNotificationAccessSettings(context: Context) {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }

    fun onListenerCreated() {
        listenerCreated = true
    }

    fun onListenerDestroyed() {
        listenerCreated = false
    }

    fun isListenerActive(): Boolean {
        return listenerCreated
    }
}