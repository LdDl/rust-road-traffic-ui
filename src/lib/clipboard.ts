/**
 * Copies a string and says whether it worked. The clipboard API is only available
 * in a secure context, and this interface is normally served over plain http on a
 * device address, so the textarea way is the one that usually runs
 */
export async function copyText(value: string): Promise<boolean> {
	try {
		if (window.isSecureContext && navigator.clipboard) {
			await navigator.clipboard.writeText(value);
			return true;
		}
	} catch {
		// Falls through to the fallback below
	}

	try {
		const area = document.createElement('textarea');
		area.value = value;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.top = '0';
		area.style.opacity = '0';
		document.body.appendChild(area);
		area.select();
		const copied = document.execCommand('copy');
		document.body.removeChild(area);
		return copied;
	} catch {
		return false;
	}
}
