package com.moneymanager.notification.registry

import android.content.Context
import android.content.pm.PackageManager

/**
 * Centralized registry for supported UPI applications.
 * Maps package names to source app identifiers.
 */
class UpiAppRegistry private constructor(context: Context) {

    private val packageManager: PackageManager = context.packageManager
    
    // Map of supported UPI app package names to source identifiers
    private val supportedApps: Map<String, String> = mapOf(
        "com.google.android.apps.nbu.paisa.user" to "GOOGLE_PAY",       // Google Pay
        "com.phonepe.app" to "PHONEPE",                                   // PhonePe
        "net.one97.paytm" to "PAYTM",                                     // Paytm
        "in.org.npci.upiapp" to "BHIM",                                   // BHIM
        "com.amazon.mShop.android.shopping" to "AMAZON_PAY",             // Amazon Pay
        "com.whatsapp" to "WHATSAPP_PAY",                                 // WhatsApp Pay
        "com.mobikwik_new" to "MOBIKWIK",                                 // Mobikwik
        "com.freecharge.android" to "FREECHARGE",                        // Freecharge
        "com.airtelpaymentsbank" to "AIRTEL_PAYMENTS_BANK",              // Airtel Payments Bank
        "com.fino.payments.bank" to "FINO_PAYMENTS_BANK",                // Fino Payments Bank
        "com.payu.upi" to "PAYU",                                         // PayU
        "com.razorpay.upi" to "RAZORPAY",                                 // Razorpay
        "com.cashfree.upi" to "CASHFREE"                                  // Cashfree
    )

    companion object {
        @Volatile
        private var INSTANCE: UpiAppRegistry? = null

        fun getInstance(context: Context): UpiAppRegistry {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: UpiAppRegistry(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    /**
     * Checks if a package name belongs to a supported UPI application.
     */
    fun isSupportedUpiApp(packageName: String): Boolean {
        return supportedApps.containsKey(packageName)
    }

    /**
     * Gets the source app identifier for a package name.
     */
    fun getSourceApp(packageName: String): String? {
        return supportedApps[packageName]
    }

    /**
     * Gets all supported UPI app package names.
     */
    fun getSupportedPackages(): Set<String> {
        return supportedApps.keys
    }

    /**
     * Checks if the app is installed on the device.
     */
    fun isAppInstalled(packageName: String): Boolean {
        return try {
            packageManager.getPackageInfo(packageName, 0)
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Gets the app label for a package name.
     */
    fun getAppLabel(packageName: String): String? {
        return try {
            packageManager.getApplicationLabel(packageManager.getApplicationInfo(packageName, 0))
        } catch (e: Exception) {
            null
        }
    }
}