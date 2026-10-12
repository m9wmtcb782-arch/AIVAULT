#include <jni.h>
#include <EGL/egl.h>
#include <GLES3/gl3.h>
#include <string>

namespace aivault {
struct Proof { bool verified; uint32_t checksum; std::string error; };
Proof probe(int elements,int iterations);
}
extern "C" JNIEXPORT jstring JNICALL
Java_ai_aivault_compute_NativeGpu_probe(JNIEnv* env,jobject /*self*/,jint elements,jint iterations) {
  if(elements<1||elements>4096||iterations<1||iterations>16)
    return env->NewStringUTF("ERROR:invalid workload");
  EGLDisplay display=eglGetDisplay(EGL_DEFAULT_DISPLAY);
  if(display==EGL_NO_DISPLAY||!eglInitialize(display,nullptr,nullptr))
    return env->NewStringUTF("ERROR:EGL initialize failed");
  EGLint configAttrs[]={EGL_SURFACE_TYPE,EGL_PBUFFER_BIT,EGL_RENDERABLE_TYPE,EGL_OPENGL_ES3_BIT,EGL_NONE};
  EGLConfig config=nullptr;EGLint num=0;
  if(!eglChooseConfig(display,configAttrs,&config,1,&num)||num<1){
    eglTerminate(display);return env->NewStringUTF("ERROR:ES3 EGL config unavailable");
  }
  EGLint surfaceAttrs[]={EGL_WIDTH,64,EGL_HEIGHT,64,EGL_NONE};
  EGLSurface surface=eglCreatePbufferSurface(display,config,surfaceAttrs);
  EGLint contextAttrs[]={EGL_CONTEXT_CLIENT_VERSION,3,EGL_NONE};
  EGLContext context=eglCreateContext(display,config,EGL_NO_CONTEXT,contextAttrs);
  if(surface==EGL_NO_SURFACE||context==EGL_NO_CONTEXT||!eglMakeCurrent(display,surface,surface,context)){
    if(context!=EGL_NO_CONTEXT)eglDestroyContext(display,context);
    if(surface!=EGL_NO_SURFACE)eglDestroySurface(display,surface);
    eglTerminate(display);return env->NewStringUTF("ERROR:ES3 context unavailable");
  }
  aivault::Proof result=aivault::probe(elements,iterations);
  eglMakeCurrent(display,EGL_NO_SURFACE,EGL_NO_SURFACE,EGL_NO_CONTEXT);
  eglDestroyContext(display,context);eglDestroySurface(display,surface);eglTerminate(display);
  std::string output=result.verified?("VERIFIED:"+std::to_string(result.checksum)):("ERROR:"+result.error);
  return env->NewStringUTF(output.c_str());
}
