"use client";

import { useEffect, useRef, type RefObject } from "react";

export type RipplePointer = {
	x: number;
	y: number;
	active: boolean;
	version: number;
};

type WaterRippleCanvasProps = {
	pointerRef: RefObject<RipplePointer>;
	disabled?: boolean;
};

const simulationSize = 512;

const vertexShaderSource = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const simulationShaderSource = `
precision highp float;

uniform sampler2D u_previous;
uniform vec2 u_pointer;
uniform vec2 u_texel;
uniform float u_addDrop;
uniform float u_dropRadius;

varying vec2 v_uv;

void main() {
  float center = texture2D(u_previous, v_uv).r - 0.5;
  float left = texture2D(u_previous, v_uv - vec2(u_texel.x, 0.0)).r - 0.5;
  float right = texture2D(u_previous, v_uv + vec2(u_texel.x, 0.0)).r - 0.5;
  float up = texture2D(u_previous, v_uv + vec2(0.0, u_texel.y)).r - 0.5;
  float down = texture2D(u_previous, v_uv - vec2(0.0, u_texel.y)).r - 0.5;
  float velocity = texture2D(u_previous, v_uv).g - 0.5;
  float neighborAverage = (left + right + up + down) * 0.25;
  float nextVelocity = (velocity + (neighborAverage - center) * 0.45) * 0.985;
  float nextHeight = center + nextVelocity;
  float distanceToPointer = distance(v_uv, u_pointer);
  float drop = (1.0 - smoothstep(0.0, u_dropRadius, distanceToPointer)) * u_addDrop;
  nextHeight = clamp(nextHeight + drop, -0.49, 0.49);

  gl_FragColor = vec4(nextHeight + 0.5, nextVelocity + 0.5, 0.0, 1.0);
}
`;

const displayShaderSource = `
precision highp float;

uniform sampler2D u_image;
uniform sampler2D u_ripple;
uniform vec2 u_resolution;
uniform vec2 u_imageResolution;
uniform vec2 u_rippleResolution;
uniform float u_perturbance;

varying vec2 v_uv;

vec2 coverUv(vec2 uv) {
  float canvasAspect = u_resolution.x / u_resolution.y;
  float imageAspect = u_imageResolution.x / u_imageResolution.y;
  vec2 crop = vec2(1.0);

  if (canvasAspect > imageAspect) {
    crop.y = imageAspect / canvasAspect;
  } else {
    crop.x = canvasAspect / imageAspect;
  }

  return clamp((uv - 0.5) * crop + 0.5, 0.0, 1.0);
}

void main() {
  vec2 rippleTexel = 1.0 / u_rippleResolution;
  float rippleLeft = texture2D(u_ripple, v_uv - vec2(rippleTexel.x, 0.0)).r;
  float rippleRight = texture2D(u_ripple, v_uv + vec2(rippleTexel.x, 0.0)).r;
  float rippleUp = texture2D(u_ripple, v_uv + vec2(0.0, rippleTexel.y)).r;
  float rippleDown = texture2D(u_ripple, v_uv - vec2(0.0, rippleTexel.y)).r;
  vec2 slope = vec2(rippleLeft - rippleRight, rippleDown - rippleUp);
  vec2 distortedUv = coverUv(v_uv + slope * u_perturbance);

  gl_FragColor = texture2D(u_image, distortedUv);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("Unable to create ripple shader.");

	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error.";
		gl.deleteShader(shader);
		throw new Error(message);
	}

	return shader;
}

function createProgram(
	gl: WebGLRenderingContext,
	vertexSource: string,
	fragmentSource: string,
) {
	const program = gl.createProgram();
	if (!program) throw new Error("Unable to create ripple program.");

	const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
	const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program) ?? "Unknown program error.";
		gl.deleteProgram(program);
		throw new Error(message);
	}

	return program;
}

function createRippleTexture(gl: WebGLRenderingContext) {
	const texture = gl.createTexture();
	if (!texture) throw new Error("Unable to create ripple texture.");

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		simulationSize,
		simulationSize,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		createRippleState(),
	);

	return texture;
}

function createRippleState() {
	const state = new Uint8Array(simulationSize * simulationSize * 4);
	for (let index = 0; index < state.length; index += 4) {
		state[index] = 128;
		state[index + 1] = 128;
		state[index + 3] = 255;
	}
	return state;
}

function createFramebuffer(
	gl: WebGLRenderingContext,
	texture: WebGLTexture,
) {
	const framebuffer = gl.createFramebuffer();
	if (!framebuffer) throw new Error("Unable to create ripple framebuffer.");

	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(
		gl.FRAMEBUFFER,
		gl.COLOR_ATTACHMENT0,
		gl.TEXTURE_2D,
		texture,
		0,
	);

	return framebuffer;
}

function createImageTexture(gl: WebGLRenderingContext, image: HTMLImageElement) {
	const texture = gl.createTexture();
	if (!texture) throw new Error("Unable to create water image texture.");

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

	return texture;
}

export function WaterRippleCanvas({
	pointerRef,
	disabled = false,
}: WaterRippleCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (disabled || !canvasRef.current) return;

		const canvas = canvasRef.current;
		const gl = canvas.getContext("webgl", {
			alpha: true,
			antialias: false,
			premultipliedAlpha: false,
		});
		if (!gl) return;

		let animationFrame = 0;
		let disposed = false;
		let lastPointerVersion = pointerRef.current.version;
		let textureIndex = 0;
		let imageTexture: WebGLTexture | null = null;

		try {
			const simulationProgram = createProgram(
				gl,
				vertexShaderSource,
				simulationShaderSource,
			);
			const displayProgram = createProgram(
				gl,
				vertexShaderSource,
				displayShaderSource,
			);
			const positionBuffer = gl.createBuffer();
			if (!positionBuffer) throw new Error("Unable to create ripple buffer.");

			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.bufferData(
				gl.ARRAY_BUFFER,
				new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
				gl.STATIC_DRAW,
			);

			const rippleTextures = [createRippleTexture(gl), createRippleTexture(gl)];
			const rippleFramebuffers = rippleTextures.map((texture) =>
				createFramebuffer(gl, texture),
			);
			const image = new Image();
			image.src = "/octomind_water_background.png";

			const resize = () => {
				const dpr = Math.min(window.devicePixelRatio || 1, 2);
				const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
				const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
				if (canvas.width === width && canvas.height === height) return;
				canvas.width = width;
				canvas.height = height;
				gl.viewport(0, 0, width, height);
			};

			const draw = () => {
				if (disposed) return;
				resize();
				if (!imageTexture) {
					if (image.complete && image.naturalWidth > 0) {
						imageTexture = createImageTexture(gl, image);
					} else {
						animationFrame = requestAnimationFrame(draw);
						return;
					}
				}

				const pointer = pointerRef.current;
				const pointerChanged = pointer.version !== lastPointerVersion;
				lastPointerVersion = pointer.version;

				gl.useProgram(simulationProgram);
				gl.bindFramebuffer(gl.FRAMEBUFFER, rippleFramebuffers[1 - textureIndex]);
				gl.viewport(0, 0, simulationSize, simulationSize);
				const simulationPosition = gl.getAttribLocation(
					simulationProgram,
					"a_position",
				);
				gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
				gl.enableVertexAttribArray(simulationPosition);
				gl.vertexAttribPointer(simulationPosition, 2, gl.FLOAT, false, 0, 0);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, rippleTextures[textureIndex]);
				gl.uniform1i(gl.getUniformLocation(simulationProgram, "u_previous"), 0);
				gl.uniform2f(
					gl.getUniformLocation(simulationProgram, "u_pointer"),
					pointer.x,
					pointer.y,
				);
				gl.uniform2f(
					gl.getUniformLocation(simulationProgram, "u_texel"),
					1 / simulationSize,
					1 / simulationSize,
				);
				gl.uniform1f(
					gl.getUniformLocation(simulationProgram, "u_addDrop"),
					pointer.active && pointerChanged ? 0.7 : 0,
				);
				gl.uniform1f(
					gl.getUniformLocation(simulationProgram, "u_dropRadius"),
					30 / simulationSize,
				);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
				textureIndex = 1 - textureIndex;

				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				gl.viewport(0, 0, canvas.width, canvas.height);
				gl.useProgram(displayProgram);
				const displayPosition = gl.getAttribLocation(displayProgram, "a_position");
				gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
				gl.enableVertexAttribArray(displayPosition);
				gl.vertexAttribPointer(displayPosition, 2, gl.FLOAT, false, 0, 0);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, imageTexture);
				gl.uniform1i(gl.getUniformLocation(displayProgram, "u_image"), 0);
				gl.activeTexture(gl.TEXTURE1);
				gl.bindTexture(gl.TEXTURE_2D, rippleTextures[textureIndex]);
				gl.uniform1i(gl.getUniformLocation(displayProgram, "u_ripple"), 1);
				gl.uniform2f(
					gl.getUniformLocation(displayProgram, "u_resolution"),
					canvas.width,
					canvas.height,
				);
				gl.uniform2f(
					gl.getUniformLocation(displayProgram, "u_imageResolution"),
					image.naturalWidth,
					image.naturalHeight,
				);
				gl.uniform2f(
					gl.getUniformLocation(displayProgram, "u_rippleResolution"),
					simulationSize,
					simulationSize,
				);
				gl.uniform1f(
					gl.getUniformLocation(displayProgram, "u_perturbance"),
					0.5,
				);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
				animationFrame = requestAnimationFrame(draw);
			};

			const resizeObserver = new ResizeObserver(resize);
			resizeObserver.observe(canvas);
			image.addEventListener("load", resize);
			draw();

			return () => {
				disposed = true;
				cancelAnimationFrame(animationFrame);
				resizeObserver.disconnect();
				image.removeEventListener("load", resize);
				gl.deleteTexture(imageTexture);
				rippleTextures.forEach((texture) => gl.deleteTexture(texture));
				rippleFramebuffers.forEach((framebuffer) => gl.deleteFramebuffer(framebuffer));
				gl.deleteBuffer(positionBuffer);
				gl.deleteProgram(simulationProgram);
				gl.deleteProgram(displayProgram);
			};
		} catch (error) {
			console.warn(
				"Water ripple effect unavailable; using the static water background.",
				error,
			);
			return undefined;
		}
	}, [disabled, pointerRef]);

	return <canvas ref={canvasRef} className="landing-water-canvas" aria-hidden="true" />;
}
