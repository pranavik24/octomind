import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const rippleSource = readFileSync(
	new URL("./water-ripple-canvas.tsx", import.meta.url),
	"utf8",
);

describe("water ripple rendering", () => {
	it("uses a velocity field so ripples oscillate instead of only diffusing", () => {
		assert.match(
			rippleSource,
			/float velocity = texture2D\(u_previous, v_uv\)\.g - 0\.5;/,
		);
		assert.match(
			rippleSource,
			/float nextVelocity = \(velocity \+ \(neighborAverage - center\) \* 0\.45\) \* 0\.985;/,
		);
	});

	it("maps the image using the visible fraction for cover scaling", () => {
		assert.match(rippleSource, /crop\.y = imageAspect \/ canvasAspect;/);
		assert.match(rippleSource, /crop\.x = canvasAspect \/ imageAspect;/);
	});

	it("uses a broad and high-amplitude pointer drop", () => {
		assert.match(
			rippleSource,
			/pointer\.active && pointerChanged \? 0\.7 : 0/,
		);
		assert.match(rippleSource, /30 \/ simulationSize/);
		assert.match(
			rippleSource,
			/getUniformLocation\(displayProgram, "u_perturbance"\)[\s\S]*?0\.5/,
		);
	});
});
