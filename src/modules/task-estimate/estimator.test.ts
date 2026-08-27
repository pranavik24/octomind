import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	estimateTaskDuration,
	extractJsonObject,
	getEstimateProviderOrder,
} from "./estimator.ts";

describe("task duration estimator", () => {
	it("prefers OpenAI when an API key is configured", () => {
		assert.deepEqual(
			getEstimateProviderOrder({
				OPENAI_API_KEY: "test-key",
			}),
			["openai", "ollama"],
		);
	});

	it("parses JSON even when the model wraps it in markdown", () => {
		assert.deepEqual(
			extractJsonObject(
				'```json\n{"estimatedMinutes": 90, "confidence": "high", "reason": "Essay drafting."}\n```',
			),
			{
				estimatedMinutes: 90,
				confidence: "high",
				reason: "Essay drafting.",
			},
		);
	});

	it("uses an OpenAI-compatible response instead of falling back locally", async () => {
		const calls: Array<{ url: string; body: unknown }> = [];
		const fetchImpl: typeof fetch = async (url, init) => {
			calls.push({
				url: String(url),
				body: JSON.parse(String(init?.body)),
			});

			return Response.json({
				choices: [
					{
						message: {
							content:
								'{"estimatedMinutes": 120, "confidence": "high", "reason": "Longer study block."}',
						},
					},
				],
			});
		};

		const estimate = await estimateTaskDuration(
			{
				title: "Study biology chapter quiz",
				description: "Review flashcards and practice questions.",
				category: "Studying",
			},
			{
				OPENAI_API_KEY: "test-key",
				TASK_ESTIMATE_PROVIDER: "openai",
			},
			fetchImpl,
		);

		assert.equal(estimate.source, "openai");
		assert.equal(estimate.estimatedMinutes, 120);
		assert.equal(estimate.estimatedHours, 2);
		assert.equal(calls.length, 1);
		assert.equal(calls[0].url, "https://api.openai.com/v1/chat/completions");
	});

	it("does not call OpenAI when credentials are missing", async () => {
		let fetchCalled = false;
		const fetchImpl: typeof fetch = async () => {
			fetchCalled = true;
			throw new TypeError("fetch should not run without credentials");
		};

		const estimate = await estimateTaskDuration(
			{
				title: "Email teacher",
				description: "Ask a quick clarification question.",
				category: "School",
			},
			{
				TASK_ESTIMATE_PROVIDER: "openai",
				OPENAI_ESTIMATE_MODEL: "gpt-estimator",
			},
			fetchImpl,
		);

		assert.equal(fetchCalled, false);
		assert.equal(estimate.source, "local");
		assert.equal(estimate.model, "gpt-estimator");
		assert.match(estimate.reason, /OPENAI_API_KEY/);
	});

	it("parses OpenAI-compatible output_text responses", async () => {
		const estimate = await estimateTaskDuration(
			{
				title: "Draft essay",
				description: "Create an outline and first draft.",
				category: "Writing",
			},
			{
				OPENAI_API_KEY: "test-key",
				TASK_ESTIMATE_PROVIDER: "openai",
			},
			async () =>
				Response.json({
					output_text:
						'{"estimatedMinutes": 150, "confidence": "medium", "reason": "Parsed output text."}',
				}),
		);

		assert.equal(estimate.source, "openai");
		assert.equal(estimate.estimatedMinutes, 150);
		assert.equal(estimate.reason, "Parsed output text.");
	});

	it("parses Ollama response fields beyond message.content", async () => {
		const estimate = await estimateTaskDuration(
			{
				title: "Build science fair prototype",
				description: "Assemble and test the first model.",
				category: "Projects",
			},
			{
				TASK_ESTIMATE_PROVIDER: "ollama",
				OLLAMA_BASE_URL: "http://ollama.example.test",
				OLLAMA_ESTIMATE_MODEL: "qwen-estimator",
			},
			async (url) => {
				assert.equal(String(url), "http://ollama.example.test/api/chat");

				return Response.json({
					response:
						'{"estimatedMinutes": 120, "confidence": "medium", "reason": "Parsed Ollama response field."}',
				});
			},
		);

		assert.equal(estimate.source, "ollama");
		assert.equal(estimate.model, "qwen-estimator");
		assert.equal(estimate.estimatedMinutes, 120);
		assert.equal(estimate.estimatedHours, 2);
		assert.equal(estimate.confidence, "medium");
		assert.equal(estimate.reason, "Parsed Ollama response field.");
	});

	it("honors configured provider timeouts and explains timeout fallbacks", async () => {
		const estimate = await estimateTaskDuration(
			{
				title: "Review chapters",
				description: "Study before quiz.",
				category: "Studying",
			},
			{
				TASK_ESTIMATE_PROVIDER: "ollama",
				TASK_ESTIMATE_TIMEOUT_MS: "5",
			},
			async (_url, init) =>
				new Promise<Response>((_, reject) => {
					const signal = init?.signal;
					if (!signal) {
						reject(new Error("Expected timeout signal."));
						return;
					}

					signal.addEventListener(
						"abort",
						() => reject(new DOMException("Aborted", "AbortError")),
						{ once: true },
					);
				}),
		);

		assert.equal(estimate.source, "local");
		assert.match(estimate.reason, /timed out after 5ms/);
	});

	it("prefers Gemini when a Gemini API key is configured", () => {
		assert.deepEqual(
			getEstimateProviderOrder({
				GEMINI_API_KEY: "test-key",
			}),
			["gemini", "openai", "ollama"],
		);
	});

	it("uses Gemini 3.1 Flash Lite and normalizes to 30-minute intervals up to 12 hours", async () => {
		const calls: Array<{
			url: string;
			headers: Headers;
			body: { generationConfig?: { responseMimeType?: unknown } };
		}> = [];
		const fetchImpl: typeof fetch = async (url, init) => {
			calls.push({
				url: String(url),
				headers: new Headers(init?.headers),
				body: JSON.parse(String(init?.body)),
			});

			return Response.json({
				candidates: [
					{
						content: {
							parts: [
								{
									text: JSON.stringify({
										estimatedMinutes: 775,
										confidence: "high",
										reason: "Large project estimate.",
									}),
								},
							],
						},
					},
				],
			});
		};

		const estimate = await estimateTaskDuration(
			{
				title: "Build capstone project",
				description: "Research, prototype, write report, and prepare slides.",
				category: "Projects",
			},
			{
				GEMINI_API_KEY: "test-key",
			},
			fetchImpl,
		);

		assert.equal(estimate.source, "gemini");
		assert.equal(estimate.model, "gemini-3.1-flash-lite");
		assert.equal(estimate.estimatedMinutes, 720);
		assert.equal(estimate.estimatedHours, 12);
		assert.equal(calls.length, 1);
		const [call] = calls;
		assert.ok(call);
		assert.equal(
			call.url,
			"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
		);
		assert.equal(call.headers.get("x-goog-api-key"), "test-key");
		assert.equal(call.body.generationConfig?.responseMimeType, "application/json");
	});
});
