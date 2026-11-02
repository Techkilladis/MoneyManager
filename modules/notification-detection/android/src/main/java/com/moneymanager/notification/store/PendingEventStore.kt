package com.moneymanager.notification.store

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.database.Cursor
import android.os.Bundle
import android.util.Log
import com.moneymanager.notification.parsers.ParsedUpiTransaction
import java.util.*

/**
 * Durable native-side storage for pending UPI events.
 * This survives even when React Native JavaScript runtime is not alive.
 * 
 * Schema:
 * - id (TEXT PRIMARY KEY): UUID
 * - amountPaise (INTEGER): Amount in paise
 * - merchant (TEXT): Merchant name
 * - sourceApp (TEXT): Source app identifier
 * - transactionTimestamp (INTEGER): Transaction timestamp (epoch ms)
 * - transactionReference (TEXT): Transaction reference ID
 * - parserName (TEXT): Name of parser that created this event
 * - parserVersion (TEXT): Parser version
 * - confidence (REAL): Parse confidence
 * - notificationId (TEXT): Original notification ID
 * - status (TEXT): PENDING, CONSUMED, DISMISSED, FAILED
 * - dedupeKey (TEXT): Deduplication key
 * - createdAt (INTEGER): Creation timestamp
 * - updatedAt (INTEGER): Last update timestamp
 */
class PendingEventStore private constructor(context: Context) {

    private val dbHelper: DatabaseHelper
    private val lock = Any()

    companion object {
        @Volatile
        private var INSTANCE: PendingEventStore? = null

        fun getInstance(context: Context): PendingEventStore {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: PendingEventStore(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    init {
        dbHelper = DatabaseHelper(context)
    }

    /**
     * Creates a new pending UPI event.
     */
    fun createEvent(
        parsed: ParsedUpiTransaction,
        notificationId: String,
        dedupeKey: String
    ): PendingUpiEvent {
        val id = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()
        val status = "PENDING"

        synchronized(lock) {
            val db = dbHelper.writableDatabase
            try {
                db.execSQL(
                    """INSERT INTO pending_upi_events 
                       (id, amountPaise, merchant, sourceApp, transactionTimestamp, 
                        transactionReference, parserName, parserVersion, confidence,
                        notificationId, status, dedupeKey, createdAt, updatedAt, direction)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    arrayOf(
                        id,
                        parsed.amountPaise,
                        parsed.merchant,
                        parsed.sourceApp,
                        parsed.transactionTimestamp,
                        parsed.transactionReference,
                        parsed.parserName,
                        parsed.parserVersion,
                        parsed.confidence,
                        notificationId,
                        status,
                        dedupeKey,
                        now,
                        now,
                        parsed.direction
                    )
                )
            } finally {
                db.close()
            }
        }

        return PendingUpiEvent(
            id = id,
            amountPaise = parsed.amountPaise,
            merchant = parsed.merchant ?: "",
            sourceApp = parsed.sourceApp,
            transactionTimestamp = parsed.transactionTimestamp,
            transactionReference = parsed.transactionReference,
            parserName = parsed.parserName,
            parserVersion = parsed.parserVersion,
            confidence = parsed.confidence,
            notificationId = notificationId,
            status = PendingUpiEvent.Status.PENDING,
            createdAt = now,
            dedupeKey = dedupeKey,
            direction = parsed.direction
        )
    }

    /**
     * True when this SMS (or the same UPI payment, matched by reference, amount
     * and direction) already produced an event, whatever its status now.
     */
    fun isKnownSms(dedupeKey: String, reference: String?, amountPaise: Long, direction: String): Boolean {
        synchronized(lock) {
            val db = dbHelper.readableDatabase
            try {
                val sql = "SELECT 1 FROM pending_upi_events WHERE dedupeKey = ?" +
                    if (reference != null) " OR (transactionReference = ? AND amountPaise = ? AND direction = ?)" else ""
                val args = if (reference != null) arrayOf(dedupeKey, reference, amountPaise.toString(), direction) else arrayOf(dedupeKey)
                db.rawQuery("$sql LIMIT 1", args).use { return it.moveToFirst() }
            } finally {
                db.close()
            }
        }
    }

    /**
     * Gets all pending events, optionally filtered by status.
     */
    fun getPendingEvents(status: String? = null): List<PendingUpiEvent> {
        synchronized(lock) {
            val db = dbHelper.readableDatabase
            try {
                val selection = if (status != null) "status = ?" else null
                val selectionArgs = if (status != null) arrayOf(status) else null
                
                val cursor = db.query(
                    "pending_upi_events",
                    null,
                    selection,
                    selectionArgs,
                    null,
                    null,
                    "createdAt DESC"
                )
                
                return cursorToEvents(cursor)
            } finally {
                db.close()
            }
        }
    }

    /** Number of events still awaiting review. */
    fun countPending(): Int {
        synchronized(lock) {
            val db = dbHelper.readableDatabase
            try {
                db.rawQuery("SELECT COUNT(*) FROM pending_upi_events WHERE status = 'PENDING'", null).use { c ->
                    return if (c.moveToFirst()) c.getInt(0) else 0
                }
            } finally {
                db.close()
            }
        }
    }

    /**
     * Gets a single event by ID.
     */
    fun getEventById(id: String): PendingUpiEvent? {
        synchronized(lock) {
            val db = dbHelper.readableDatabase
            try {
                val cursor = db.query(
                    "pending_upi_events",
                    null,
                    "id = ?",
                    arrayOf(id),
                    null,
                    null,
                    null
                )
                return if (cursor.moveToFirst()) cursorToEvent(cursor) else null
            } finally {
                db.close()
            }
        }
    }

    /**
     * Marks an event as consumed (processed by Quick Capture).
     */
    fun consumeEvent(id: String) {
        updateStatus(id, "CONSUMED")
    }

    /**
     * Marks an event as dismissed (user dismissed).
     */
    fun dismissEvent(id: String) {
        updateStatus(id, "DISMISSED")
    }

    /**
     * Marks an event as failed.
     */
    fun failEvent(id: String) {
        updateStatus(id, "FAILED")
    }

    private fun updateStatus(id: String, status: String) {
        synchronized(lock) {
            val db = dbHelper.writableDatabase
            try {
                val now = System.currentTimeMillis()
                db.execSQL(
                    "UPDATE pending_upi_events SET status = ?, updatedAt = ? WHERE id = ?",
                    arrayOf(status, now, id)
                )
            } finally {
                db.close()
            }
        }
    }

    /**
     * Deletes old consumed/dismissed/failed events (cleanup).
     */
    fun cleanupOldEvents(olderThanMs: Long = 30L * 24 * 60 * 60 * 1000) { // 30 days
        synchronized(lock) {
            val db = dbHelper.writableDatabase
            try {
                val cutoff = System.currentTimeMillis() - olderThanMs
                db.execSQL(
                    "DELETE FROM pending_upi_events WHERE status IN ('CONSUMED', 'DISMISSED', 'FAILED') AND updatedAt < ?",
                    arrayOf(cutoff)
                )
            } finally {
                db.close()
            }
        }
    }

    /**
     * Gets statistics about pending events.
     */
    fun getStats(): Map<String, Any> {
        synchronized(lock) {
            val db = dbHelper.readableDatabase
            try {
                val totalCursor = db.rawQuery("SELECT COUNT(*) FROM pending_upi_events", null)
                val total = if (totalCursor.moveToFirst()) totalCursor.getLong(0) else 0L
                totalCursor.close()

                val byStatusCursor = db.rawQuery("SELECT status, COUNT(*) FROM pending_upi_events GROUP BY status", null)
                val byStatus = mutableMapOf<String, Long>()
                while (byStatusCursor.moveToNext()) {
                    byStatus[byStatusCursor.getString(0)] = byStatusCursor.getLong(1)
                }
                byStatusCursor.close()

                val bySourceCursor = db.rawQuery("SELECT sourceApp, COUNT(*) FROM pending_upi_events GROUP BY sourceApp", null)
                val bySource = mutableMapOf<String, Long>()
                while (bySourceCursor.moveToNext()) {
                    bySource[bySourceCursor.getString(0)] = bySourceCursor.getLong(1)
                }
                bySourceCursor.close()

                val byParserCursor = db.rawQuery("SELECT parserName, COUNT(*) FROM pending_upi_events GROUP BY parserName", null)
                val byParser = mutableMapOf<String, Long>()
                while (byParserCursor.moveToNext()) {
                    byParser[byParserCursor.getString(0)] = byParserCursor.getLong(1)
                }
                byParserCursor.close()

                return mapOf(
                    "total" to total,
                    "byStatus" to byStatus,
                    "bySource" to bySource,
                    "byParser" to byParser
                )
            } finally {
                db.close()
            }
        }
    }

    /**
     * Clears all events (for testing).
     */
    fun clearAll() {
        synchronized(lock) {
            val db = dbHelper.writableDatabase
            try {
                db.execSQL("DELETE FROM pending_upi_events")
            } finally {
                db.close()
            }
        }
    }

    private fun cursorToEvents(cursor: Cursor): List<PendingUpiEvent> {
        val events = mutableListOf<PendingUpiEvent>()
        while (cursor.moveToNext()) {
            events.add(cursorToEvent(cursor))
        }
        cursor.close()
        return events
    }

    private fun cursorToEvent(cursor: Cursor): PendingUpiEvent {
        return PendingUpiEvent(
            id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
            amountPaise = cursor.getLong(cursor.getColumnIndexOrThrow("amountPaise")),
            merchant = cursor.getString(cursor.getColumnIndexOrThrow("merchant")),
            sourceApp = cursor.getString(cursor.getColumnIndexOrThrow("sourceApp")),
            transactionTimestamp = cursor.getLong(cursor.getColumnIndexOrThrow("transactionTimestamp")),
            transactionReference = cursor.getString(cursor.getColumnIndexOrThrow("transactionReference")),
            parserName = cursor.getString(cursor.getColumnIndexOrThrow("parserName")),
            parserVersion = cursor.getString(cursor.getColumnIndexOrThrow("parserVersion")),
            confidence = cursor.getDouble(cursor.getColumnIndexOrThrow("confidence")),
            notificationId = cursor.getString(cursor.getColumnIndexOrThrow("notificationId")),
            status = PendingUpiEvent.Status.valueOf(cursor.getString(cursor.getColumnIndexOrThrow("status"))),
            createdAt = cursor.getLong(cursor.getColumnIndexOrThrow("createdAt")),
            dedupeKey = cursor.getString(cursor.getColumnIndexOrThrow("dedupeKey")),
            direction = cursor.getColumnIndex("direction").let { if (it >= 0) cursor.getString(it) ?: "DEBIT" else "DEBIT" }
        )
    }

    inner class DatabaseHelper(context: Context) : SQLiteOpenHelper(
        context,
        "moneymanager_notifications.db",
        null,
        2
    ) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL("""
                CREATE TABLE pending_upi_events (
                    id TEXT PRIMARY KEY,
                    amountPaise INTEGER NOT NULL,
                    merchant TEXT,
                    sourceApp TEXT NOT NULL,
                    transactionTimestamp INTEGER NOT NULL,
                    transactionReference TEXT,
                    parserName TEXT NOT NULL,
                    parserVersion TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    notificationId TEXT NOT NULL,
                    status TEXT NOT NULL,
                    dedupeKey TEXT NOT NULL,
                    createdAt INTEGER NOT NULL,
                    updatedAt INTEGER NOT NULL,
                    direction TEXT NOT NULL DEFAULT 'DEBIT'
                )
            """)
            
            db.execSQL("CREATE INDEX idx_pending_status ON pending_upi_events(status)")
            db.execSQL("CREATE INDEX idx_pending_dedupe ON pending_upi_events(dedupeKey)")
            db.execSQL("CREATE INDEX idx_pending_created ON pending_upi_events(createdAt)")
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            Log.w("PendingEventStore", "Upgrading database from $oldVersion to $newVersion")
            if (oldVersion < 2) {
                // v2: money-in events (CREDIT) are captured alongside payments.
                db.execSQL("ALTER TABLE pending_upi_events ADD COLUMN direction TEXT NOT NULL DEFAULT 'DEBIT'")
            }
        }
    }
}

data class PendingUpiEvent(
    val id: String,
    val amountPaise: Long,
    val merchant: String,
    val sourceApp: String,
    val transactionTimestamp: Long,
    val transactionReference: String?,
    val parserName: String,
    val parserVersion: String,
    val confidence: Double,
    val notificationId: String,
    val status: Status,
    val createdAt: Long,
    val dedupeKey: String,
    val direction: String = "DEBIT"
) {
    enum class Status {
        PENDING,
        CONSUMED,
        DISMISSED,
        FAILED
    }

    fun toBundle(): Bundle {
        val bundle = Bundle()
        bundle.putString("id", id)
        bundle.putLong("amountPaise", amountPaise)
        bundle.putString("merchant", merchant)
        bundle.putString("sourceApp", sourceApp)
        bundle.putLong("transactionTimestamp", transactionTimestamp)
        bundle.putString("transactionReference", transactionReference)
        bundle.putString("parserName", parserName)
        bundle.putString("parserVersion", parserVersion)
        bundle.putDouble("confidence", confidence)
        bundle.putString("notificationId", notificationId)
        bundle.putString("status", status.name)
        bundle.putLong("createdAt", createdAt)
        bundle.putString("dedupeKey", dedupeKey)
        bundle.putString("direction", direction)
        return bundle
    }
}