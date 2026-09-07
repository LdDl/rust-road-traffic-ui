/** Compact uptime, two units at most: "2d 4h", "3h 12m", "45s" */
export function formatUptime(seconds: number | null | undefined): string {
	if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
		return 'n/a';
	}
	const total = Math.floor(seconds);
	const days = Math.floor(total / 86400);
	const hours = Math.floor((total % 86400) / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const rest = total % 60;
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	if (minutes > 0) return `${minutes}m ${rest}s`;
	return `${rest}s`;
}

export function formatFps(value: number | null | undefined, digits = 1): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
	return value.toFixed(digits);
}

export function formatCount(value: number | null | undefined): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
	return value.toLocaleString('en-US').replace(/,/g, ' ');
}

export function formatMs(value: number | null | undefined): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
	return `${value.toFixed(1)} ms`;
}

/** Local time of an RFC 3339 stamp, date included only when it is not today */
export function formatTimestamp(value: string | null | undefined): string {
	if (!value) return 'n/a';
	const at = new Date(value);
	if (Number.isNaN(at.getTime())) return value;
	const now = new Date();
	const sameDay =
		at.getFullYear() === now.getFullYear() &&
		at.getMonth() === now.getMonth() &&
		at.getDate() === now.getDate();
	const time = at.toLocaleTimeString('en-GB', { hour12: false });
	return sameDay ? time : `${at.toLocaleDateString('en-GB')} ${time}`;
}

/**
 * Hides the password in a stream address. The API hands the address out in full,
 * so this only keeps it off a screen someone else may be looking at
 */
export function maskCredentials(url: string | null | undefined): string {
	if (!url) return '';
	return url.replace(/(:\/\/[^:@/]+):[^@/]*@/, '$1:***@');
}
