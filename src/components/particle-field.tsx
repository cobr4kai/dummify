"use client";

import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 260;
const MOUSE_RADIUS = 134;
const DRAG = 0.997;
const ATTRACT_STRENGTH = 0.018;
const SPEED_MIN = 0.06;
const SPEED_MAX = 0.21;
const SIZE_MIN = 1.5;
const SIZE_MAX = 5.5;
const ALPHA_MIN = 0.18;
const ALPHA_MAX = 0.4;
const LIFE_MIN = 540;
const LIFE_MAX = 1280;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  driftX: number;
  driftY: number;
  size: number;
  alphaPeak: number;
  age: number;
  life: number;
};

type Viewport = {
  width: number;
  height: number;
  dpr: number;
};

type MouseState = {
  active: boolean;
  x: number;
  y: number;
};

const vertexShaderSource = `
attribute vec2 a_position;
attribute float a_size;
attribute float a_alpha;
uniform vec2 u_resolution;
varying float v_alpha;

void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
  gl_PointSize = a_size;
  v_alpha = a_alpha;
}
`;

const fragmentShaderSource = `
precision mediump float;
varying float v_alpha;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float distanceFromCenter = length(centered);

  if (distanceFromCenter > 0.5) {
    discard;
  }

  float softenedEdge = smoothstep(0.12, 0.25, 0.5 - distanceFromCenter);
  gl_FragColor = vec4(0.82, 0.65, 0.08, v_alpha * softenedEdge);
}
`;

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      return;
    }

    const canvasNode = canvasRef.current;
    if (!canvasNode) {
      return;
    }

    const canvas: HTMLCanvasElement = canvasNode;

    const glContext = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    });

    if (!glContext) {
      canvas.style.display = "none";
      return;
    }

    const gl: WebGLRenderingContext = glContext;

    let vertexShader: WebGLShader;
    let fragmentShader: WebGLShader;
    let program: WebGLProgram;

    try {
      vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      program = createProgram(gl, vertexShader, fragmentShader);
    } catch {
      canvas.style.display = "none";
      return;
    }

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const sizeLocation = gl.getAttribLocation(program, "a_size");
    const alphaLocation = gl.getAttribLocation(program, "a_alpha");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    if (
      positionLocation === -1 ||
      sizeLocation === -1 ||
      alphaLocation === -1 ||
      !resolutionLocation
    ) {
      canvas.style.display = "none";
      return;
    }

    const positionBuffer = gl.createBuffer();
    const sizeBuffer = gl.createBuffer();
    const alphaBuffer = gl.createBuffer();

    if (!positionBuffer || !sizeBuffer || !alphaBuffer) {
      canvas.style.display = "none";
      return;
    }

    const positions = new Float32Array(PARTICLE_COUNT * 2);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const alphas = new Float32Array(PARTICLE_COUNT);
    const particles = new Array<Particle>(PARTICLE_COUNT);
    const viewport: Viewport = { width: 0, height: 0, dpr: 1 };
    const mouse: MouseState = { active: false, x: 0, y: 0 };

    let rafId = 0;
    let stopped = false;

    function resizeCanvas() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const width = window.innerWidth;
      const height = window.innerHeight;

      viewport.width = width;
      viewport.height = height;
      viewport.dpr = dpr;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function resetParticle(index: number, randomizeAge = false) {
      const direction = Math.random() * Math.PI * 2;
      const speed = randomInRange(SPEED_MIN, SPEED_MAX);
      const life = randomInRange(LIFE_MIN, LIFE_MAX);

      particles[index] = {
        x: Math.random() * Math.max(viewport.width, 1),
        y: Math.random() * Math.max(viewport.height, 1),
        vx: Math.cos(direction) * speed,
        vy: Math.sin(direction) * speed,
        driftX: Math.cos(direction) * speed,
        driftY: Math.sin(direction) * speed,
        size: randomInRange(SIZE_MIN, SIZE_MAX),
        alphaPeak: randomInRange(ALPHA_MIN, ALPHA_MAX),
        age: randomizeAge ? Math.random() * life : 0,
        life,
      };
    }

    function seedParticles() {
      for (let index = 0; index < PARTICLE_COUNT; index += 1) {
        resetParticle(index, true);
      }
    }

    function updateParticles() {
      const radiusSquared = MOUSE_RADIUS * MOUSE_RADIUS;

      for (let index = 0; index < PARTICLE_COUNT; index += 1) {
        const particle = particles[index];
        particle.age += 1;

        if (particle.age >= particle.life) {
          resetParticle(index);
        }

        const current = particles[index];
        current.vx += (current.driftX - current.vx) * 0.004;
        current.vy += (current.driftY - current.vy) * 0.004;

        if (mouse.active) {
          const dx = mouse.x - current.x;
          const dy = mouse.y - current.y;
          const distanceSquared = dx * dx + dy * dy;

          if (distanceSquared <= radiusSquared) {
            const distance = Math.max(Math.sqrt(distanceSquared), 0.0001);
            const pull = (1 - distance / MOUSE_RADIUS) * ATTRACT_STRENGTH;
            current.vx += (dx / distance) * pull;
            current.vy += (dy / distance) * pull;
          }
        }

        current.vx *= DRAG;
        current.vy *= DRAG;
        current.x += current.vx;
        current.y += current.vy;

        if (current.x < 0) {
          current.x += viewport.width;
        } else if (current.x > viewport.width) {
          current.x -= viewport.width;
        }

        if (current.y < 0) {
          current.y += viewport.height;
        } else if (current.y > viewport.height) {
          current.y -= viewport.height;
        }

        const fadeProgress = getFadeProgress(current.age / current.life);
        positions[index * 2] = current.x * viewport.dpr;
        positions[(index * 2) + 1] = current.y * viewport.dpr;
        sizes[index] = current.size * viewport.dpr;
        alphas[index] = current.alphaPeak * fadeProgress;
      }
    }

    function drawFrame() {
      if (stopped) {
        return;
      }

      updateParticles();

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(sizeLocation);
      gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, alphas, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(alphaLocation);
      gl.vertexAttribPointer(alphaLocation, 1, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);
      rafId = window.requestAnimationFrame(drawFrame);
    }

    function handlePointerMove(event: PointerEvent) {
      mouse.active = true;
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    }

    function handlePointerExit() {
      mouse.active = false;
    }

    function handleContextLost(event: Event) {
      event.preventDefault();
      stopped = true;
      canvas.style.display = "none";
      window.cancelAnimationFrame(rafId);
    }

    resizeCanvas();
    seedParticles();

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", handlePointerExit);
    window.addEventListener("blur", handlePointerExit);
    canvas.addEventListener("webglcontextlost", handleContextLost, false);

    rafId = window.requestAnimationFrame(drawFrame);

    return () => {
      stopped = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerMove);
      document.documentElement.removeEventListener("mouseleave", handlePointerExit);
      window.removeEventListener("blur", handlePointerExit);
      canvas.removeEventListener("webglcontextlost", handleContextLost, false);

      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(sizeBuffer);
      gl.deleteBuffer(alphaBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="particle-field" />;
}

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error("Could not allocate WebGL shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info || "Could not compile WebGL shader.");
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
) {
  const program = gl.createProgram();

  if (!program) {
    throw new Error("Could not allocate WebGL program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(info || "Could not link WebGL program.");
  }

  return program;
}

function randomInRange(min: number, max: number) {
  return min + ((max - min) * Math.random());
}

function getFadeProgress(progress: number) {
  if (progress <= 0.12) {
    return progress / 0.12;
  }

  if (progress >= 0.78) {
    return Math.max(0, (1 - progress) / 0.22);
  }

  return 1;
}
