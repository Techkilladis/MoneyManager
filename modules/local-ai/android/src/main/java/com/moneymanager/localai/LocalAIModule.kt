// LocalAIModule.kt
package com.moneymanager.localai

import android.content.Context
import android.content.res.AssetManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.module.annotations.ReactModule
import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

@ReactModule(name = MoneyManagerLocalAIModule.NAME)
class MoneyManagerLocalAIModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        const val NAME = "MoneyManagerLocalAI"
        const val DEFAULT_CONTEXT_SIZE = 4096
    }

    private var llamaContext: Long = 0
    private var isModelLoaded = false
    private val modelLock = Any()
    
    override fun getName(): String = NAME

    @ReactMethod
    fun initializeModel(modelAssetPath: String, contextSize: Int, promise: Promise) {
        Thread.start {
            synchronized(modelLock) {
                try {
                    if (isModelLoaded) {
                        promise.resolve(mapOf("success" to true))
                        return
                    }

                    val context = reactApplicationContext
                    val assets: AssetManager = context.assets
                    
                    // Copy model from assets to internal storage
                    val modelFile = copyModelFromAssets(assets, modelAssetPath)
                    if (modelFile == null) {
                        promise.resolve(mapOf("success" to false, "error" to "Failed to copy model from assets"))
                        return
                    }

                    // Initialize llama.cpp context
                    val result = nativeInit(modelFile.absolutePath, contextSize)
                    if (result >= 0) {
                        llamaContext = result.toLong()
                        isModelLoaded = true
                        promise.resolve(mapOf("success" to true))
                    } else {
                        promise.resolve(mapOf("success" to false, "error" to "Failed to initialize llama.cpp context: $result"))
                    }
                } catch (e: Exception) {
                    promise.resolve(mapOf("success" to false, "error" to e.message ?: "Unknown error"))
                }
            }
        }
    }

    private fun copyModelFromAssets(assets: AssetManager, assetPath: String): File? {
        try {
            val inputStream: InputStream = assets.open(assetPath)
            val outputFile = File(reactApplicationContext.filesDir, "model.gguf")
            val outputStream = FileOutputStream(outputFile)
            
            val buffer = ByteArray(8192)
            var length: Int
            while (inputStream.read(buffer).also { length = it } != -1) {
                outputStream.write(buffer, 0, length)
            }
            
            inputStream.close()
            outputStream.close()
            
            return outputFile
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }

    @ReactMethod
    fun isModelReady(promise: Promise) {
        promise.resolve(isModelLoaded)
    }

    @ReactMethod
    fun getModelInfo(promise: Promise) {
        if (!isModelLoaded) {
            promise.resolve(null)
            return
        }
        
        try {
            val info = nativeGetModelInfo(llamaContext)
            promise.resolve(info)
        } catch (e: Exception) {
            promise.reject("MODEL_INFO_ERROR", e.message ?: "Unknown error")
        }
    }

    @ReactMethod
    fun classify(input: ReadableMap, promise: Promise) {
        if (!isModelLoaded || llamaContext == 0L) {
            promise.resolve(null)
            return
        }

        Thread.start {
            synchronized(modelLock) {
                try {
                    // Extract input parameters
                    val merchantName = input.getString("merchantName")
                    val normalizedMerchant = input.getString("normalizedMerchant")
                    val canonicalMerchant = input.getString("canonicalMerchant")
                    val amountPaise = if (input.hasKey("amountPaise") && !input.isNull("amountPaise")) input.getInt("amountPaise") else -1
                    val sourceApp = if (input.hasKey("sourceApp") && !input.isNull("sourceApp")) input.getString("sourceApp") else ""
                    val transactionTime = if (input.hasKey("transactionTime") && !input.isNull("transactionTime")) input.getLong("transactionTime") else -1L
                    
                    val availableCategories = parseCategoryArray(input.getArray("availableCategories"))
                    val availableMembers = parseMemberArray(input.getArray("availableMembers"))
                    val relevantMemory = if (input.hasKey("relevantMemory")) parseMemoryArray(input.getArray("relevantMemory")) else emptyList()

                    // Build prompt
                    val prompt = buildClassificationPrompt(
                        merchantName, normalizedMerchant, canonicalMerchant,
                        amountPaise, sourceApp, transactionTime,
                        availableCategories, availableMembers, relevantMemory
                    )

                    // Run inference
                    val output = nativeInfer(llamaContext, prompt)
                    
                    // Parse output
                    val result = parseClassificationOutput(output, availableCategories, availableMembers)
                    
                    promise.resolve(result)
                } catch (e: Exception) {
                    e.printStackTrace()
                    promise.resolve(null)
                }
            }
        }
    }

    private fun parseCategoryArray(array: com.facebook.react.bridge.ReadableArray?): List<Map<String, String>> {
        val list = mutableListOf<Map<String, String>>()
        array?.let {
            for (i in 0 until it.size()) {
                val obj = it.getMap(i)
                if (obj.hasKey("id") && obj.hasKey("name")) {
                    list.add(mapOf("id" to obj.getString("id"), "name" to obj.getString("name")))
                }
            }
        }
        return list
    }

    private fun parseMemberArray(array: com.facebook.react.bridge.ReadableArray?): List<Map<String, String>> {
        val list = mutableListOf<Map<String, String>>()
        array?.let {
            for (i in 0 until it.size()) {
                val obj = it.getMap(i)
                if (obj.hasKey("id") && obj.hasKey("name")) {
                    list.add(mapOf("id" to obj.getString("id"), "name" to obj.getString("name")))
                }
            }
        }
        return list
    }

    private fun parseMemoryArray(array: com.facebook.react.bridge.ReadableArray?): List<Map<String, Any?>> {
        val list = mutableListOf<Map<String, Any?>>()
        array?.let {
            for (i in 0 until it.size()) {
                val obj = it.getMap(i)
                val item = mutableMapOf<String, Any?>()
                if (obj.hasKey("categoryId") && !obj.isNull("categoryId")) item["categoryId"] = obj.getString("categoryId")
                if (obj.hasKey("categoryName") && !obj.isNull("categoryName")) item["categoryName"] = obj.getString("categoryName")
                if (obj.hasKey("memberId") && !obj.isNull("memberId")) item["memberId"] = obj.getString("memberId")
                if (obj.hasKey("memberName") && !obj.isNull("memberName")) item["memberName"] = obj.getString("memberName")
                if (obj.hasKey("source") && !obj.isNull("source")) item["source"] = obj.getString("source")
                if (obj.hasKey("confidence") && !obj.isNull("confidence")) item["confidence"] = obj.getString("confidence")
                if (obj.hasKey("usageCount") && !obj.isNull("usageCount")) item["usageCount"] = obj.getInt("usageCount")
                list.add(item)
            }
        }
        return list
    }

    private fun buildClassificationPrompt(
        merchantName: String,
        normalizedMerchant: String,
        canonicalMerchant: String,
        amountPaise: Int,
        sourceApp: String,
        transactionTime: Long,
        availableCategories: List<Map<String, String>>,
        availableMembers: List<Map<String, String>>,
        relevantMemory: List<Map<String, Any?>>
    ): String {
        val categoryNames = availableCategories.map { it["name"] }.joinToString(", ")
        val memberNames = availableMembers.map { it["name"] }.joinToString(", ")
        
        val memoryText = if (relevantMemory.isNotEmpty()) {
            relevantMemory.map { mem ->
                val cat = mem["categoryName"] ?: "none"
                val memName = mem["memberName"] ?: "none"
                val conf = mem["confidence"] ?: "LOW"
                val count = mem["usageCount"] as? Int ?: 0
                "  - $merchantName -> $cat / $memName (confidence: $conf, used $count times)"
            }.joinToString("\n")
        } else {
            "  (no previous memory)"
        }

        return """
            You are a financial transaction classifier for Indian UPI payments.
            
            Task: Classify the merchant into a category and member.
            
            Available categories: $categoryNames
            Available members: $memberNames
            
            Merchant information:
            - Raw: $merchantName
            - Normalized: $normalizedMerchant
            - Canonical: $canonicalMerchant
            - Amount: ${if (amountPaise > 0) "₹${amountPaise / 100}" else "unknown"}
            - Source app: ${if (sourceApp.isNotBlank()) sourceApp else "unknown"}
            
            Relevant merchant memory:
            $memoryText
            
            Rules:
            1. Choose ONLY from the available categories and members
            2. Use null for category or member if uncertain
            3. Return ONLY a JSON object
            4. Do not invent new category or member names
            5. Do not output any text outside the JSON
            
            Output format:
            {
              "categoryId": "<category_id_or_null>",
              "memberId": "<member_id_or_null>",
              "confidence": "HIGH|MEDIUM|LOW",
              "reasoning": "<brief reasoning>"
            }
        """.trimIndent()
    }

    private fun parseClassificationOutput(
        output: String,
        availableCategories: List<Map<String, String>>,
        availableMembers: List<Map<String, String>>
    ): WritableMap {
        val result = Arguments.createMap()
        
        try {
            val json = JSONObject(output)
            
            // Parse categoryId
            var categoryId: String? = null
            if (json.has("categoryId") && !json.isNull("categoryId")) {
                val catId = json.getString("categoryId")
                val validCategory = availableCategories.find { it["id"] == catId }
                if (validCategory != null) {
                    categoryId = catId
                }
            }
            result.putString("categoryId", categoryId ?: "")
            
            // Parse memberId
            var memberId: String? = null
            if (json.has("memberId") && !json.isNull("memberId")) {
                val memId = json.getString("memberId")
                val validMember = availableMembers.find { it["id"] == memId }
                if (validMember != null) {
                    memberId = memId
                }
            }
            result.putString("memberId", memberId ?: "")
            
            // Parse confidence
            var confidence = "LOW"
            if (json.has("confidence") && !json.isNull("confidence")) {
                val conf = json.getString("confidence").uppercase()
                if (conf in setOf("HIGH", "MEDIUM", "LOW")) {
                    confidence = conf
                }
            }
            result.putString("confidence", confidence)
            
            // Parse reasoning
            var reasoning: String? = null
            if (json.has("reasoning") && !json.isNull("reasoning")) {
                reasoning = json.getString("reasoning")
                result.putString("reasoning", reasoning)
            }
            
        } catch (e: Exception) {
            e.printStackTrace()
            // Return empty result on parse error
            result.putString("categoryId", "")
            result.putString("memberId", "")
            result.putString("confidence", "LOW")
        }
        
        return result
    }

    @ReactMethod
    fun disposeModel(promise: Promise) {
        Thread.start {
            synchronized(modelLock) {
                if (isModelLoaded && llamaContext != 0L) {
                    nativeDispose(llamaContext)
                    llamaContext = 0
                    isModelLoaded = false
                }
                promise.resolve(Unit)
            }
        }
    }

    // Native methods (implemented in JNI)
    external fun nativeInit(modelPath: String, contextSize: Int): Int
    external fun nativeInfer(context: Long, prompt: String): String
    external fun nativeGetModelInfo(context: Long): WritableMap
    external fun nativeDispose(context: Long)

    companion object {
        init {
            System.loadLibrary("local_ai")
        }
    }
}