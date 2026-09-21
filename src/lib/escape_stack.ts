import { browser } from '$app/environment';

/**
 * Escape belongs to whatever opened last: a hint on top of the details panel, and
 * the drawing mode underneath both. Without one owner every window listener fires
 * at once, so closing a hint would also throw away a zone being drawn
 */
type Layer = { close: () => void };

const layers: Layer[] = [];
let listening = false;

function onKeyDown(event: KeyboardEvent) {
	if (event.key !== 'Escape') return;
	const layer = layers[layers.length - 1];
	if (!layer) return;
	event.preventDefault();
	layer.close();
}

/** Registers a layer for as long as it is open. Returns the function that removes it */
export function registerEscapeLayer(close: () => void): () => void {
	const layer: Layer = { close };
	layers.push(layer);
	if (!listening && browser) {
		window.addEventListener('keydown', onKeyDown);
		listening = true;
	}
	return () => {
		const at = layers.indexOf(layer);
		if (at !== -1) layers.splice(at, 1);
	};
}
