const callbackMessages: Record<string, string> = {
	connected: "Google Classroom is connected.",
	disconnected: "Google Classroom was disconnected.",
	access_denied:
		"Google Classroom connection was cancelled. You can try again when you are ready.",
	denied:
		"Google Classroom connection was cancelled. You can try again when you are ready.",
	test_user_restricted:
		"This Google account is not an approved test user for the Classroom beta.",
	test_user:
		"This Google account is not an approved test user for the Classroom beta.",
	unverified_app:
		"Google has not verified this Classroom beta for your account yet.",
	admin_policy:
		"Your Google Workspace administrator does not allow this Classroom connection.",
	admin_restricted:
		"Your Google Workspace administrator does not allow this Classroom connection.",
	admin_policy_enforced:
		"Your Google Workspace administrator does not allow this Classroom connection.",
	token_expired:
		"Google Classroom access expired. Reconnect to continue importing assignments.",
	token_revoked:
		"Google Classroom access was revoked. Reconnect to continue importing assignments.",
	invalid_grant:
		"Google Classroom access expired or was revoked. Reconnect to continue.",
	state_invalid:
		"This Google Classroom connection attempt expired. Please start again.",
	configuration:
		"Google Classroom is temporarily unavailable. You can keep using manual tasks.",
	oauth_failed:
		"Google Classroom could not connect. Please try again or keep using manual tasks.",
	unauthorized:
		"Your session expired. Sign in again before connecting Classroom.",
};

export function callbackMessageFor(code: string | null) {
	if (!code) return null;
	return (
		callbackMessages[code] ??
		"Google Classroom could not connect. Please try again or keep using manual tasks."
	);
}

export function isSuccessfulCallback(code: string | null) {
	return code === "connected" || code === "disconnected";
}
