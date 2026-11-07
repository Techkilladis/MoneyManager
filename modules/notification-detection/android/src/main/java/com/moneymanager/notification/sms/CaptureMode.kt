package com.moneymanager.notification.sms

import android.content.Context
import android.content.SharedPreferences

/**
 * Simple SharedPreferences-backed capture mode toggle.
 *
 * 'auto'  — store SMS silently, show toast "CDC saved", never open quick-capture popup.
 * 'instant' (default) — open the review pop-up immediately when a payment SMS arrives.
 */
object CaptureMode {

    private const val PREFS_NAME = "moneymanager_capture"
    private const val KEY_MODE = "capture_mode"
    private const val DEFAULT = "instant"

    private var prefs: SharedPreferences? = null

    fun init(context: Context) {
        if (prefs == null) {
            prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }
    }

    fun set(mode: String) {
        prefs?.edit()?.putString(KEY_MODE, mode)?.apply()
    }

    /** Returns 'auto' or 'instant'. */
    fun get(context: Context? = null): String {
        if (prefs == null && context != null) {
            init(context)
        }
        return prefs?.getString(KEY_MODE, DEFAULT) ?: DEFAULT
    }

    fun isAutoMode(context: Context? = null): Boolean {
        return "auto" == get(context)
    }
}
