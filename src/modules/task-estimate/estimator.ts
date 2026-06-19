import { z } from "zod";

type EstimateProvider = "gemini" | "openai" | "ollama";

export interface TaskEstimateInput {
	title: string;
	description: string;
	category?: string;
	dueDate?: string;
}

export interface TaskEstimateResult {
	estimatedHours: number;
	estimatedMinutes: number;
	confidence: "low" | "medium" | "high";
	reason: string;
	source: EstimateProvider | "local";
	model: string;
}

type EstimateEnv = Partial<Record<string, string | undefined>>;
type FetchLike = typeof fetch;

type ConfiguredProvider = EstimateProvider | "auto" | "local" | "none";

const estimateResponseSchema = z.object({
	estimatedMinutes: z.coerce.number().positive(),
	confidence: z.enum(["low", "medium", "high"]).default("medium"),
	reason: z.string().default("Estimated from task details."),
});

class ProviderFallbackError extends Error {
	readonly reason: string;

	constructor(message: string, reason: string) {
		super(message);
		this.name = "ProviderFallbackError";
		this.reason = reason;
	}
}

function normalizeMinutes(minutes: number): number {
	if (!Number.isFinite(minutes)) return 60;
	const rounded = Math.round(minutes / 30) * 30;
	return Math.min(720, Math.max(30, rounded));
}

function minutesToResult(
	minutes: number,
	extras: Omit<TaskEstimateResult, "estimatedHours" | "estimatedMinutes">,
): TaskEstimateResult {
	const estimatedMinutes = normalizeMinutes(minutes);
	return {
		estimatedHours: estimatedMinutes / 60,
		estimatedMinutes,
		...extras,
	};
}

export function heuristicEstimateMinutes(
	title: string,
	description: string,
): number {
	const combined = `${title} ${description}`.toLowerCase();
	const words = combined
		.split(/\s+/)
		.map((word) => word.trim())
		.filter(Boolean);

	const explicitHours = combined.match(
		/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/,
	);
	if (explicitHours) return normalizeMinutes(Number(explicitHours[1]) * 60);

	const explicitMinutes = combined.match(
		/(\d+)\s*(m|min|mins|minute|minutes)\b/,
	);
	if (explicitMinutes) return normalizeMinutes(Number(explicitMinutes[1]));

	let minutes = 60;

	if (words.length >= 8) minutes += 30;
	if (words.length >= 24) minutes += 30;
	if (words.length >= 45) minutes += 30;

	if (
		/\b(call|email|reply|check|confirm|submit|print|upload|turn in)\b/.test(
			combined,
		)
	) {
		minutes -= 30;
	}

	if (/\b(write|draft|plan|prepare|research|analyze|study)\b/.test(combined)) {
		minutes += 45;
	}

	if (
		/\b(build|implement|develop|project|presentation|essay|paper|debug|lab report)\b/.test(
			combined,
		)
	) {
		minutes += 75;
	}

	if (/\b(exam|midterm|final|test|quiz|practice test)\b/.test(combined)) {
		minutes += 60;
	}

	return normalizeMinutes(minutes);
}

export function getOllamaChatUrl(baseUrl: string): string {
	const trimmedUrl = baseUrl.replace(/\/+$/, "");

	if (trimmedUrl.endsWith("/api/chat")) {
		return trimmedUrl;
	}

	if (trimmedUrl.endsWith("/api")) {
		return `${trimmedUrl}/chat`;
	}

	return `${trimmedUrl}/api/chat`;
}

function getOpenAiChatUrl(baseUrl = "https://api.openai.com/v1"): string {
	const trimmedUrl = baseUrl.replace(/\/+$/, "");

	if (trimmedUrl.endsWith("/chat/completions")) {
		return trimmedUrl;
	}

	if (trimmedUrl.endsWith("/v1")) {
		return `${trimmedUrl}/chat/completions`;
	}

	return `${trimmedUrl}/v1/chat/completions`;
}

function getGeminiGenerateContentUrl(
	baseUrl = "https://generativelanguage.googleapis.com/v1beta",
	model: string,
): string {
	const trimmedUrl = baseUrl.replace(/\/+$/, "");
	const normalizedModel = model.startsWith("models/")
		? model.slice("models/".length)
		: model;

	return `${trimmedUrl}/models/${normalizedModel}:generateContent`;
}

export function extractJsonObject(value: unknown): unknown {
	if (typeof value === "object" && value !== null) return value;
	if (typeof value !== "string") {
		throw new Error("Model response did not contain text or JSON.");
	}

	try {
		return JSON.parse(value);
	} catch {
		const fencedJson = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
		if (fencedJson) {
			return JSON.parse(fencedJson[1].trim());
		}

		const firstBrace = value.indexOf("{");
		const lastBrace = value.lastIndexOf("}");
		if (firstBrace >= 0 && lastBrace > firstBrace) {
			return JSON.parse(value.slice(firstBrace, lastBrace + 1));
		}

		throw new Error("Model response did not contain a JSON object.");
	}
}

function getConfiguredProvider(env: EstimateEnv): ConfiguredProvider | null {
	const configuredProvider = env.TASK_ESTIMATE_PROVIDER?.trim().toLowerCase();

	if (!configuredProvider) return "auto";

	if (
		configuredProvider === "auto" ||
		configuredProvider === "gemini" ||
		configuredProvider === "openai" ||
		configuredProvider === "ollama" ||
		configuredProvider === "local" ||
		configuredProvider === "none"
	) {
		return configuredProvider;
	}

	return null;
}

export function getEstimateProviderOrder(env: EstimateEnv): EstimateProvider[] {
	const configuredProvider = getConfiguredProvider(env);

	if (configuredProvider === "gemini") return ["gemini"];
	if (configuredProvider === "openai") return ["openai"];
	if (configuredProvider === "ollama") return ["ollama"];
	if (configuredProvider === "local" || configuredProvider === "none")
		return [];

	if (getGeminiApiKey(env)) {
		return ["gemini", "openai", "ollama"];
	}

	if (env.OPENAI_API_KEY || env.OPENAI_BASE_URL) {
		return ["openai", "ollama"];
	}

	return ["ollama"];
}

function getProviderLabel(provider: EstimateProvider): string {
	if (provider === "gemini") return "Gemini";
	return provider === "openai" ? "OpenAI-compatible provider" : "Ollama";
}

function getProviderModel(
	provider: EstimateProvider,
	env: EstimateEnv,
): string {
	if (provider === "gemini") {
		return (
			env.GEMINI_ESTIMATE_MODEL ??
			env.TASK_ESTIMATE_MODEL ??
			"gemini-3.1-flash-lite"
		);
	}

	if (provider === "openai") {
		return (
			env.OPENAI_ESTIMATE_MODEL ?? env.TASK_ESTIMATE_MODEL ?? "gpt-4o-mini"
		);
	}

	return env.OLLAMA_ESTIMATE_MODEL ?? env.TASK_ESTIMATE_MODEL ?? "llama3.2";
}

function getProviderUrl(provider: EstimateProvider, env: EstimateEnv): string {
	if (provider === "gemini") {
		return getGeminiGenerateContentUrl(
			env.GEMINI_BASE_URL,
			getProviderModel("gemini", env),
		);
	}

	if (provider === "openai") {
		return getOpenAiChatUrl(env.OPENAI_BASE_URL);
	}

	return getOllamaChatUrl(env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434");
}

function getGeminiApiKey(env: EstimateEnv): string | undefined {
	return env.GEMINI_API_KEY ?? env.GOOGLE_GEMINI_API_KEY ?? env.GOOGLE_API_KEY;
}

function getTimeoutMs(env: EstimateEnv): number {
	const timeoutMs = Number(env.TASK_ESTIMATE_TIMEOUT_MS ?? 12000);

	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
		return 12000;
	}

	return Math.min(120000, Math.round(timeoutMs));
}

function fallbackReasonFor(
	error: unknown,
	provider: EstimateProvider,
	timeoutMs: number,
	url: string,
): string {
	const label = getProviderLabel(provider);

	if (error instanceof ProviderFallbackError) {
		return error.reason;
	}

	if (error instanceof DOMException && error.name === "AbortError") {
		return `${label} timed out after ${timeoutMs}ms, so a local estimate was used.`;
	}

	if (error instanceof TypeError) {
		return `Could not reach ${label} at ${url}, so a local estimate was used.`;
	}

	if (error instanceof SyntaxError || error instanceof z.ZodError) {
		return `${label} response could not be parsed as a task estimate, so a local estimate was used.`;
	}

	if (error instanceof Error) {
		return `${label} estimate failed: ${error.message}`;
	}

	return `${label} was unavailable, so a local estimate was used.`;
}

function buildPrompt(input: TaskEstimateInput) {
	return [
		{
			role: "system",
			content:
				'You estimate student task duration. Return one JSON object and no other text. Shape: {"estimatedMinutes": number, "confidence": "low" | "medium" | "high", "reason": string}. estimatedMinutes must be one of the 30-minute intervals from 30 to 720 minutes. Prefer realistic focused work time, not calendar time.',
		},
		{
			role: "user",
			content: JSON.stringify({
				title: input.title,
				description: input.description,
				category: input.category ?? "Other",
				dueDate: input.dueDate,
			}),
		},
	];
}

function parseEstimate(
	rawEstimate: unknown,
	source: EstimateProvider,
	model: string,
): TaskEstimateResult {
	const estimate = estimateResponseSchema.parse(extractJsonObject(rawEstimate));

	return minutesToResult(estimate.estimatedMinutes, {
		confidence: estimate.confidence,
		reason: estimate.reason,
		source,
		model,
	});
}

function extractProviderEstimatePayload(data: unknown): unknown {
	if (!data || typeof data !== "object") return data;

	const responseData = data as {
		candidates?: Array<{
			content?: { parts?: Array<{ text?: unknown }> };
		}>;
		message?: { content?: unknown };
		response?: unknown;
		choices?: Array<{ message?: { content?: unknown }; text?: unknown }>;
		output_text?: unknown;
	};

	return (
		responseData.message?.content ??
		responseData.response ??
		responseData.choices?.[0]?.message?.content ??
		responseData.choices?.[0]?.text ??
		responseData.output_text ??
		responseData.candidates?.[0]?.content?.parts?.find(
			(part) => typeof part.text === "string",
		)?.text ??
		data
	);
}

async function withTimeout<T>(
	timeoutMs: number,
	run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await run(controller.signal);
	} finally {
		clearTimeout(timeout);
	}
}

async function estimateWithOpenAi(
	input: TaskEstimateInput,
	env: EstimateEnv,
	fetchImpl: FetchLike,
	timeoutMs: number,
): Promise<TaskEstimateResult> {
	const apiKey = env.OPENAI_API_KEY;
	const baseUrl = env.OPENAI_BASE_URL;
	if (!apiKey) {
		throw new ProviderFallbackError(
			"OPENAI_API_KEY is required for OpenAI estimates.",
			"OpenAI-compatible provider is selected, but OPENAI_API_KEY is not configured, so a local estimate was used.",
		);
	}

	const model = getProviderModel("openai", env);
	const response = await withTimeout(timeoutMs, (signal) =>
		fetchImpl(getOpenAiChatUrl(baseUrl), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
			},
			signal,
			body: JSON.stringify({
				model,
				temperature: 0.1,
				response_format: { type: "json_object" },
				messages: buildPrompt(input),
			}),
		}),
	);

	if (!response.ok) {
		throw new ProviderFallbackError(
			`OpenAI-compatible provider responded ${response.status}`,
			`OpenAI-compatible provider responded ${response.status}, so a local estimate was used.`,
		);
	}

	const data = await response.json();

	return parseEstimate(extractProviderEstimatePayload(data), "openai", model);
}

async function estimateWithGemini(
	input: TaskEstimateInput,
	env: EstimateEnv,
	fetchImpl: FetchLike,
	timeoutMs: number,
): Promise<TaskEstimateResult> {
	const apiKey = getGeminiApiKey(env);
	if (!apiKey) {
		throw new ProviderFallbackError(
			"GEMINI_API_KEY is required for Gemini estimates.",
			"Gemini is selected, but GEMINI_API_KEY is not configured, so a local estimate was used.",
		);
	}

	const model = getProviderModel("gemini", env);
	const geminiUrl = getProviderUrl("gemini", env);
	const [systemPrompt, userPrompt] = buildPrompt(input);
	const response = await withTimeout(timeoutMs, (signal) =>
		fetchImpl(geminiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": apiKey,
			},
			signal,
			body: JSON.stringify({
				systemInstruction: {
					parts: [{ text: systemPrompt.content }],
				},
				contents: [
					{
						role: "user",
						parts: [{ text: userPrompt.content }],
					},
				],
				generationConfig: {
					temperature: 0.1,
					responseMimeType: "application/json",
					maxOutputTokens: 256,
				},
			}),
		}),
	);

	if (!response.ok) {
		throw new ProviderFallbackError(
			`Gemini responded ${response.status}`,
			`Gemini responded ${response.status}, so a local estimate was used.`,
		);
	}

	const data = await response.json();

	return parseEstimate(extractProviderEstimatePayload(data), "gemini", model);
}

async function estimateWithOllama(
	input: TaskEstimateInput,
	env: EstimateEnv,
	fetchImpl: FetchLike,
	timeoutMs: number,
): Promise<TaskEstimateResult> {
	const model = getProviderModel("ollama", env);
	const ollamaUrl = getProviderUrl("ollama", env);

	const response = await withTimeout(timeoutMs, (signal) =>
		fetchImpl(ollamaUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			signal,
			body: JSON.stringify({
				model,
				stream: false,
				format: "json",
				keep_alive: "10m",
				messages: buildPrompt(input),
			}),
		}),
	);

	if (!response.ok) {
		throw new ProviderFallbackError(
			`Ollama responded ${response.status}`,
			`Ollama responded ${response.status}, so a local estimate was used.`,
		);
	}

	const data = await response.json();

	return parseEstimate(extractProviderEstimatePayload(data), "ollama", model);
}

export async function estimateTaskDuration(
	input: TaskEstimateInput,
	env: EstimateEnv = process.env,
	fetchImpl: FetchLike = fetch,
): Promise<TaskEstimateResult> {
	const fallbackMinutes = heuristicEstimateMinutes(
		input.title,
		input.description,
	);
	const timeoutMs = getTimeoutMs(env);
	const configuredProvider = getConfiguredProvider(env);
	const attempts: Array<{
		error: unknown;
		model: string;
		provider: EstimateProvider;
		url: string;
	}> = [];

	if (configuredProvider === null) {
		return minutesToResult(fallbackMinutes, {
			confidence: "low",
			reason: `Unsupported task estimate provider "${env.TASK_ESTIMATE_PROVIDER}", so a local estimate was used.`,
			source: "local",
			model: "local",
		});
	}

	for (const provider of getEstimateProviderOrder(env)) {
		try {
			if (provider === "gemini") {
				return await estimateWithGemini(input, env, fetchImpl, timeoutMs);
			}

			if (provider === "openai") {
				return await estimateWithOpenAi(input, env, fetchImpl, timeoutMs);
			}

			return await estimateWithOllama(input, env, fetchImpl, timeoutMs);
		} catch (error) {
			attempts.push({
				error,
				model: getProviderModel(provider, env),
				provider,
				url: getProviderUrl(provider, env),
			});
		}
	}

	const lastAttempt = attempts.at(-1);

	return minutesToResult(fallbackMinutes, {
		confidence: "low",
		reason: lastAttempt
			? fallbackReasonFor(
					lastAttempt.error,
					lastAttempt.provider,
					timeoutMs,
					lastAttempt.url,
				)
			: "No LLM provider is configured, so a local estimate was used.",
		source: "local",
		model: lastAttempt?.model ?? "local",
	});
}
