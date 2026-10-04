// local_ai.cpp - JNI wrapper for llama.cpp
#include <jni.h>
#include <string>
#include <vector>
#include <android/log.h>
#include <llama.h>

#define LOG_TAG "MoneyManagerLocalAI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static JavaVM* g_jvm = nullptr;

// Global llama context pointer (single model for now)
static struct llama_context* g_llama_ctx = nullptr;
static struct llama_model* g_llama_model = nullptr;

// JNI function signatures
extern "C" JNIEXPORT jint JNICALL
Java_com_moneymanager_localai_LocalAIModule_nativeInit(
    JNIEnv* env, jobject thiz, jstring modelPath, jint contextSize) {
    
    const char* path = env->GetStringUTFChars(modelPath, nullptr);
    if (!path) {
        LOGE("Failed to get model path");
        return -1;
    }
    
    LOGI("Initializing llama.cpp with model: %s, context: %d", path, contextSize);
    
    // Initialize llama backend
    llama_backend_init();
    
    // Model parameters
    llama_model_params model_params = llama_model_default_params();
    model_params.n_gpu_layers = 0; // CPU only for now
    
    // Load model
    g_llama_model = llama_load_model_from_file(path, model_params);
    if (!g_llama_model) {
        LOGE("Failed to load model from %s", path);
        env->ReleaseStringUTFChars(modelPath, path);
        return -1;
    }
    
    // Context parameters
    llama_context_params ctx_params = llama_context_default_params();
    ctx_params.n_ctx = contextSize;
    ctx_params.n_batch = 512;
    ctx_params.n_threads = 4;
    ctx_params.n_threads_batch = 4;
    
    // Create context
    g_llama_ctx = llama_new_context_with_model(g_llama_model, ctx_params);
    if (!g_llama_ctx) {
        LOGE("Failed to create llama context");
        llama_free_model(g_llama_model);
        g_llama_model = nullptr;
        env->ReleaseStringUTFChars(modelPath, path);
        return -1;
    }
    
    LOGI("llama.cpp initialized successfully");
    env->ReleaseStringUTFChars(modelPath, path);
    return 0;
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_moneymanager_localai_LocalAIModule_nativeInfer(
    JNIEnv* env, jobject thiz, jlong context, jstring prompt) {
    
    if (!g_llama_ctx) {
        LOGE("Llama context not initialized");
        return env->NewStringUTF("");
    }
    
    const char* prompt_cstr = env->GetStringUTFChars(prompt, nullptr);
    if (!prompt_cstr) {
        return env->NewStringUTF("");
    }
    
    LOGI("Running inference with prompt length: %zu", strlen(prompt_cstr));
    
    // Tokenize the prompt
    std::vector<llama_token> tokens(llama_n_ctx(g_llama_ctx));
    int n_tokens = llama_tokenize(g_llama_ctx, prompt_cstr, strlen(prompt_cstr), tokens.data(), tokens.size(), true, true);
    
    if (n_tokens < 0) {
        LOGE("Failed to tokenize prompt");
        env->ReleaseStringUTFChars(prompt, prompt_cstr);
        return env->NewStringUTF("");
    }
    
    tokens.resize(n_tokens);
    
    // Create batch
    llama_batch batch = llama_batch_get_one(tokens.data(), n_tokens);
    
    // Run inference
    if (llama_decode(g_llama_ctx, batch) != 0) {
        LOGE("llama_decode failed");
        env->ReleaseStringUTFChars(prompt, prompt_cstr);
        return env->NewStringUTF("");
    }
    
    // Get logits for the last token
    const float* logits = llama_get_logits_ith(g_llama_ctx, n_tokens - 1);
    if (!logits) {
        LOGE("Failed to get logits");
        env->ReleaseStringUTFChars(prompt, prompt_cstr);
        return env->NewStringUTF("");
    }
    
    // Sample next token (greedy for deterministic output)
    int n_vocab = llama_n_vocab(llama_get_model(g_llama_ctx));
    llama_token next_token = 0;
    float max_logit = -INFINITY;
    
    for (int i = 0; i < n_vocab; i++) {
        if (logits[i] > max_logit) {
            max_logit = logits[i];
            next_token = i;
        }
    }
    
    // Convert token to string
    char token_buf[128];
    int token_len = llama_token_to_piece(g_llama_ctx, next_token, token_buf, sizeof(token_buf), 0, true);
    
    if (token_len < 0) {
        LOGE("Failed to convert token to piece");
        env->ReleaseStringUTFChars(prompt, prompt_cstr);
        return env->NewStringUTF("");
    }
    
    std::string result(token_buf, token_len);
    
    // For JSON output, we need to generate more tokens until we have a complete JSON
    // This is a simplified version - in production you'd want proper JSON parsing
    // and multi-token generation
    
    // Generate more tokens to complete the JSON
    std::string full_output = result;
    int max_new_tokens = 256;
    
    for (int i = 0; i < max_new_tokens; i++) {
        // Add the generated token to the sequence
        tokens.push_back(next_token);
        
        // Recreate batch with new sequence
        batch = llama_batch_get_one(&tokens[tokens.size() - 1], 1);
        
        if (llama_decode(g_llama_ctx, batch) != 0) {
            break;
        }
        
        logits = llama_get_logits_ith(g_llama_ctx, tokens.size() - 1);
        if (!logits) break;
        
        max_logit = -INFINITY;
        next_token = 0;
        for (int j = 0; j < n_vocab; j++) {
            if (logits[j] > max_logit) {
                max_logit = logits[j];
                next_token = j;
            }
        }
        
        token_len = llama_token_to_piece(g_llama_ctx, next_token, token_buf, sizeof(token_buf), 0, true);
        if (token_len < 0) break;
        
        std::string piece(token_buf, token_len);
        full_output += piece;
        
        // Stop if we have a complete JSON (contains closing brace)
        if (full_output.find("}") != std::string::npos) {
            break;
        }
    }
    
    LOGI("Inference complete, output length: %zu", full_output.length());
    env->ReleaseStringUTFChars(prompt, prompt_cstr);
    
    return env->NewStringUTF(full_output.c_str());
}

extern "C" JNIEXPORT jobject JNICALL
Java_com_moneymanager_localai_LocalAIModule_nativeGetModelInfo(
    JNIEnv* env, jobject thiz, jlong context) {
    
    if (!g_llama_model) {
        return nullptr;
    }
    
    jclass mapClass = env->FindClass("java/util/HashMap");
    jmethodID mapInit = env->GetMethodID(mapClass, "<init>", "()V");
    jmethodID mapPut = env->GetMethodID(mapClass, "put", "(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;");
    
    jobject result = env->NewObject(mapClass, mapInit);
    
    // Model ID
    env->CallObjectMethod(result, mapPut, 
        env->NewStringUTF("modelId"), 
        env->NewStringUTF("Phi-3-mini-4k-instruct-q4"));
    
    // Model version
    env->CallObjectMethod(result, mapPut, 
        env->NewStringUTF("modelVersion"), 
        env->NewStringUTF("1.0.0"));
    
    // Model path
    env->CallObjectMethod(result, mapPut, 
        env->NewStringUTF("modelPath"), 
        env->NewStringUTF("internal"));
    
    // Context size
    env->CallObjectMethod(result, mapPut, 
        env->NewStringUTF("contextSize"), 
        env->NewStringUTF(std::to_string(llama_n_ctx(g_llama_ctx)).c_str()));
    
    // Parameter count (approximate for Phi-3-mini)
    env->CallObjectMethod(result, mapPut, 
        env->NewStringUTF("parameterCount"), 
        env->NewStringUTF("3.8B"));
    
    // Quantization
    env->CallObjectMethod(result, mapPut, 
        env->NewStringUTF("quantization"), 
        env->NewStringUTF("Q4_K_M"));
    
    return result;
}

extern "C" JNIEXPORT void JNICALL
Java_com_moneymanager_localai_LocalAIModule_nativeDispose(
    JNIEnv* env, jobject thiz, jlong context) {
    
    if (g_llama_ctx) {
        llama_free(g_llama_ctx);
        g_llama_ctx = nullptr;
    }
    
    if (g_llama_model) {
        llama_free_model(g_llama_model);
        g_llama_model = nullptr;
    }
    
    llama_backend_free();
    LOGI("llama.cpp disposed");
}

// JNI_OnLoad
JNIEXPORT jint JNI_OnLoad(JavaVM* vm, void* reserved) {
    g_jvm = vm;
    return JNI_VERSION_1_6;
}