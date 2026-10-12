// AIVAULT Android native GPU probe (OpenGL ES 3.0 fragment shader).
// Requires an EGL context created by the caller on the worker thread.
// This is an isolated proof primitive, NOT a complete Android service/APK.
#include <GLES3/gl3.h>
#include <cstdint>
#include <vector>
#include <string>

namespace aivault {
struct Proof { bool verified = false; uint32_t checksum = 0; std::string error; };
static uint32_t oracle(int count, int iterations) {
  uint32_t sum=0;
  for(int i=0;i<count;i++){
    uint32_t x=static_cast<uint32_t>(i+1);
    for(int j=0;j<iterations;j++){x=x*1664525u+1013904223u;x^=x>>13u;x*=2246822519u;x^=x>>16u;}
    sum+=x;
  }
  return sum;
}
static GLuint compile(GLenum type, const char* source) {
  GLuint s=glCreateShader(type);glShaderSource(s,1,&source,nullptr);glCompileShader(s);
  GLint ok=GL_FALSE;glGetShaderiv(s,GL_COMPILE_STATUS,&ok);
  if(!ok){glDeleteShader(s);return 0;}return s;
}
Proof probe(int elements=256,int iterations=1) {
  Proof p;
  if(elements<1||elements>4096||iterations<1||iterations>16){p.error="invalid bounded workload";return p;}
  const char* vs=R"(#version 300 es
  void main(){vec2 q=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(q*2.0-1.0,0.0,1.0);})";
  const char* fs=R"(#version 300 es
  precision highp float;precision highp int;
  uniform uint u_width;uniform uint u_elements;uniform uint u_iterations;
  layout(location=0) out uvec4 outputValue;
  void main(){
    uint idx=uint(gl_FragCoord.y)*u_width+uint(gl_FragCoord.x);
    if(idx>=u_elements){outputValue=uvec4(0u);return;}
    uint x=idx+1u;
    for(uint j=0u;j<u_iterations;j++){x=x*1664525u+1013904223u;x^=x>>13u;x*=2246822519u;x^=x>>16u;}
    outputValue=uvec4(x,0u,0u,1u);
  })";
  GLuint v=compile(GL_VERTEX_SHADER,vs),f=compile(GL_FRAGMENT_SHADER,fs);
  if(!v||!f){p.error="shader compilation failed";if(v)glDeleteShader(v);if(f)glDeleteShader(f);return p;}
  GLuint program=glCreateProgram();glAttachShader(program,v);glAttachShader(program,f);glLinkProgram(program);
  glDeleteShader(v);glDeleteShader(f);
  GLint linked=GL_FALSE;glGetProgramiv(program,GL_LINK_STATUS,&linked);
  if(!linked){p.error="shader linking failed";glDeleteProgram(program);return p;}
  int side=1;while(side*side<elements)++side;
  GLuint texture=0,framebuffer=0,vao=0;
  glGenTextures(1,&texture);glGenFramebuffers(1,&framebuffer);glGenVertexArrays(1,&vao);
  glBindTexture(GL_TEXTURE_2D,texture);
  glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);
  glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);
  glTexStorage2D(GL_TEXTURE_2D,1,GL_RGBA32UI,side,side);
  glBindFramebuffer(GL_FRAMEBUFFER,framebuffer);
  glFramebufferTexture2D(GL_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,GL_TEXTURE_2D,texture,0);
  if(glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE){p.error="integer framebuffer unsupported";goto cleanup;}
  while(glGetError()!=GL_NO_ERROR) {} // discard stale GL errors before measured draw
  glUseProgram(program);glBindVertexArray(vao);
  glUniform1ui(glGetUniformLocation(program,"u_width"),static_cast<GLuint>(side));
  glUniform1ui(glGetUniformLocation(program,"u_elements"),static_cast<GLuint>(elements));
  glUniform1ui(glGetUniformLocation(program,"u_iterations"),static_cast<GLuint>(iterations));
  glViewport(0,0,side,side);glDisable(GL_BLEND);glDisable(GL_DITHER);
  glDrawArrays(GL_TRIANGLES,0,3);
  {
    std::vector<uint32_t> pixels(static_cast<size_t>(side)*side*4);
    glReadPixels(0,0,side,side,GL_RGBA_INTEGER,GL_UNSIGNED_INT,pixels.data());
    if(glGetError()!=GL_NO_ERROR){p.error="GPU draw/readback failed";goto cleanup;}
    uint32_t sum=0;
    for(int i=0;i<elements;i++)sum+=pixels[static_cast<size_t>(i)*4];
    p.checksum=sum;p.verified=(sum==oracle(elements,iterations));
    if(!p.verified)p.error="GPU checksum mismatch";
  }
cleanup:
  glBindFramebuffer(GL_FRAMEBUFFER,0);
  glDeleteVertexArrays(1,&vao);glDeleteFramebuffers(1,&framebuffer);
  glDeleteTextures(1,&texture);glDeleteProgram(program);
  return p;
}
} // namespace aivault
