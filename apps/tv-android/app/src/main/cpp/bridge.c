#include <jni.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "quickjs.h"
typedef struct { JSRuntime *runtime; JSContext *context; JNIEnv *env; jobject owner; time_t deadline; } Engine;
static int interrupt(JSRuntime *rt, void *opaque) { Engine *e=opaque; return time(NULL)>e->deadline; }
static JSValue host(JSContext *ctx, JSValueConst self, int argc, JSValueConst *argv) {
    Engine *e=JS_GetContextOpaque(ctx);
    const char *operation=JS_ToCString(ctx, argv[0]), *payload=JS_ToCString(ctx,argv[1]);
    jclass klass=(*e->env)->GetObjectClass(e->env,e->owner);
    jmethodID method=(*e->env)->GetMethodID(e->env,klass,"host","(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;");
    jstring op=(*e->env)->NewStringUTF(e->env,operation), data=(*e->env)->NewStringUTF(e->env,payload);
    jstring result=(*e->env)->CallObjectMethod(e->env,e->owner,method,op,data);
    JS_FreeCString(ctx,operation); JS_FreeCString(ctx,payload);
    (*e->env)->DeleteLocalRef(e->env,op); (*e->env)->DeleteLocalRef(e->env,data); (*e->env)->DeleteLocalRef(e->env,klass);
    if ((*e->env)->ExceptionCheck(e->env)) { (*e->env)->ExceptionClear(e->env); return JS_ThrowInternalError(ctx,"Native adapter failed"); }
    const char *text=(*e->env)->GetStringUTFChars(e->env,result,NULL);
    JSValue out=JS_NewString(ctx,text); (*e->env)->ReleaseStringUTFChars(e->env,result,text); (*e->env)->DeleteLocalRef(e->env,result); return out;
}
JNIEXPORT jlong JNICALL Java_com_hongguotv_tv_StandaloneEngine_create(JNIEnv *env,jobject owner) {
    Engine *e=calloc(1,sizeof(Engine)); e->runtime=JS_NewRuntime(); JS_SetMemoryLimit(e->runtime,192*1024*1024); JS_SetMaxStackSize(e->runtime,512*1024);
    e->context=JS_NewContext(e->runtime); JS_SetContextOpaque(e->context,e); JS_SetInterruptHandler(e->runtime,interrupt,e);
    JSValue global=JS_GetGlobalObject(e->context); JS_SetPropertyStr(e->context,global,"nativeBridge",JS_NewCFunction(e->context,host,"nativeBridge",2)); JS_FreeValue(e->context,global); return (jlong)e;
}
JNIEXPORT jstring JNICALL Java_com_hongguotv_tv_StandaloneEngine_run(JNIEnv *env,jobject owner,jlong ptr,jstring input) {
    Engine *e=(Engine*)ptr; e->env=env;e->owner=owner;e->deadline=time(NULL)+120;JS_UpdateStackTop(e->runtime);
    const char *script=(*env)->GetStringUTFChars(env,input,NULL); JSValue result=JS_Eval(e->context,script,strlen(script),"hongguo",JS_EVAL_TYPE_GLOBAL); (*env)->ReleaseStringUTFChars(env,input,script);
    if (!JS_IsException(result)) { JSContext *ctx; int ret; while((ret=JS_ExecutePendingJob(e->runtime,&ctx))>0) {} if(ret<0) { JS_FreeValue(e->context,result); result=JS_EXCEPTION; } }
    if (JS_IsException(result)) {
        JSValue error=JS_GetException(e->context); const char *message=JS_ToCString(e->context,error); (*env)->ThrowNew(env,(*env)->FindClass(env,"java/lang/IllegalStateException"),message?message:"QuickJS failed"); JS_FreeCString(e->context,message); JS_FreeValue(e->context,error); return NULL;
    }
    const char *text=JS_ToCString(e->context,result); jstring output=(*env)->NewStringUTF(env,text?text:""); JS_FreeCString(e->context,text); JS_FreeValue(e->context,result); return output;
}
JNIEXPORT void JNICALL Java_com_hongguotv_tv_StandaloneEngine_destroy(JNIEnv *env,jobject owner,jlong ptr) { Engine *e=(Engine*)ptr; JS_FreeContext(e->context); JS_FreeRuntime(e->runtime); free(e); }
