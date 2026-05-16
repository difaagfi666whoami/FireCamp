'use client'
import { useEffect, useRef } from 'react'

const VERT = `attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos,0.0,1.0); }`

const FRAG = `precision highp float;
uniform vec2 uRes; uniform float uT; uniform vec2 uMouse; uniform float uPulse;

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));
  vec2 u=f*f*(3.-2.*f);
  return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;
}
float fbm(vec2 p){
  float v=0.,a=0.5;
  for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=0.5;}
  return v;
}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes.xy;
  vec2 p=uv*2.-1.; p.x*=uRes.x/uRes.y;
  vec2 m=(uMouse*2.-1.); m.x*=uRes.x/uRes.y;
  float md=length(p-m);
  float pulse=uPulse*exp(-md*1.8);

  vec2 q=p;
  q+=0.5*(m-p)*exp(-md*1.2)*(0.4+0.6*sin(uT*0.7));
  q.y+=0.15*sin(uT*0.3+p.x*1.5);

  float n1=fbm(q*1.2+vec2(uT*0.08,-uT*0.04));
  float n2=fbm(q*2.4+vec2(-uT*0.05,uT*0.12)+n1*1.4);
  float n3=fbm(q*0.6-vec2(uT*0.02,0.)+n2);

  float band=sin(p.y*2.2+n2*3.0+uT*0.4)*0.5+0.5;
  band=pow(band,1.6);
  float ribbon=smoothstep(0.2,0.95,band)*(0.6+0.6*n3);
  ribbon+=0.6*pulse;

  vec3 surface=vec3(0.961,0.953,0.937);
  vec3 mint=vec3(0.784,0.929,0.878);
  vec3 teal=vec3(0.059,0.431,0.337);
  vec3 gold=vec3(0.788,0.588,0.243);
  vec3 forest=vec3(0.059,0.137,0.094);

  vec3 col=surface;
  col=mix(col,mint,smoothstep(0.15,0.55,ribbon)*0.85);
  col=mix(col,teal,smoothstep(0.55,0.95,ribbon)*0.55);
  col=mix(col,forest,smoothstep(0.90,1.15,ribbon+pulse*0.5)*0.50);

  float goldMask=smoothstep(0.75,1.0,ribbon)*(0.5+0.5*sin(uT*0.5+n3*4.0));
  col=mix(col,gold,goldMask*0.18);

  col=mix(col,teal,exp(-md*4.0)*0.18);
  col+=vec3(0.15,0.32,0.26)*exp(-md*6.5)*0.08*(1.0+2.0*uPulse);

  vec3 paper=vec3(0.945,0.933,0.910);
  col=mix(col,paper,smoothstep(0.4,1.6,length(p))*0.25);

  col+=(hash(uv*uT+1.7)-0.5)*0.012;

  gl_FragColor=vec4(col,1.0);
}`

export function AuroraCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false })
    if (!gl) {
      canvas.style.background = 'linear-gradient(135deg,#F5F3EF,#C8EDE0 60%,#0F6E56)'
      return
    }

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!
      gl!.shaderSource(s, src)
      gl!.compileShader(s)
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS))
        throw new Error(gl!.getShaderInfoLog(s) ?? 'compile error')
      return s
    }

    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.bindAttribLocation(prog, 0, 'a_pos')
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog))
      return
    }

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'uRes')
    const uT = gl.getUniformLocation(prog, 'uT')
    const uMouse = gl.getUniformLocation(prog, 'uMouse')
    const uPulse = gl.getUniformLocation(prog, 'uPulse')

    const st = { mx: 0.7, my: 0.55, txm: 0.7, tmy: 0.55, pulse: 0, t0: performance.now(), lt: performance.now() }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.floor(window.innerWidth * dpr)
      const h = Math.floor(window.innerHeight * dpr)
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w; canvas!.height = h
        gl!.viewport(0, 0, w, h)
      }
    }

    const onMove = (e: PointerEvent) => {
      st.txm = e.clientX / window.innerWidth
      st.tmy = 1 - e.clientY / window.innerHeight
    }
    const onDown = () => { st.pulse = 1 }

    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown)
    resize()

    let raf: number
    function render(now: number) {
      const dt = Math.min(0.05, (now - st.lt) / 1000)
      st.lt = now
      const k = Math.min(1, dt * 8)
      st.mx += (st.txm - st.mx) * k
      st.my += (st.tmy - st.my) * k
      st.pulse *= Math.exp(-dt * 1.6)
      const t = (now - st.t0) / 1000
      resize()
      gl!.useProgram(prog)
      gl!.uniform2f(uRes, canvas!.width, canvas!.height)
      gl!.uniform1f(uT, t)
      gl!.uniform2f(uMouse, st.mx, st.my)
      gl!.uniform1f(uPulse, st.pulse)
      gl!.drawArrays(gl!.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [])

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
}
