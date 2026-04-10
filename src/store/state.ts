import { States } from '$lib/states';
import { derived, get, writable, type Writable } from 'svelte/store'
import type { FabricCanvasWrap } from '$lib/custom_canvas';

export const canvasState: Writable<FabricCanvasWrap | undefined> = writable()
export const state = writable(States.Waiting);

export const canvasReady = writable(false)
export const dataReady = writable(false)

function persisted<T>(key: string, fallback: T): Writable<T> {
    let initial = fallback;
    try {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
            initial = typeof fallback === 'number' ? Number(raw) as unknown as T : raw as unknown as T;
        }
    } catch {
        // SSR or private browsing
    }
    const store = writable<T>(initial);
    store.subscribe(value => {
        try { localStorage.setItem(key, String(value)); } catch { /* ignore */ }
    });
    return store;
}

const defaultSchema = 'http'
const defaultHost = 'localhost'
const defaultPort = 42001

const currentURL = window.location.href
const appURL = new URL(currentURL)
export const DEFAULT_API_SCHEMA = appURL.protocol.replace(/:/g,'') || defaultSchema
export const DEFAULT_API_HOST = appURL.hostname || defaultHost
export const DEFAULT_API_PORT = process.env.NODE_ENV === 'development'? defaultPort : parseInt(appURL.port) || ((DEFAULT_API_SCHEMA === 'https') ? 443 : 80) || defaultPort

class ApiSchema {
    constructor(
        public schema: Writable<string> = persisted('settings:api_schema', DEFAULT_API_SCHEMA),
        public host: Writable<string> = persisted('settings:api_host', DEFAULT_API_HOST),
        public port: Writable<number> = persisted('settings:api_port', DEFAULT_API_PORT)
    ) {}

    get apiURL() {
        return derived(
            [this.schema, this.host, this.port],
            ([$schema, $host, $port]) => {
                return `${$schema}://${$host}:${$port}`
            }
        )
    }
}

// Singleton
export const apiUrlStore = new ApiSchema();

// Initialize changeAPI from persisted values (not hardcoded defaults)
const persistedApiURL = get(apiUrlStore.apiURL)
export const changeAPI = writable(persistedApiURL)

export const DEFAULT_MAP_STYLE_URI = 'https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL';

class MapStyle {
    constructor(
        public uri: Writable<string> = persisted('settings:map_style_uri', DEFAULT_MAP_STYLE_URI),
        public accepted_uri: Writable<string> = persisted('settings:map_style_accepted_uri', DEFAULT_MAP_STYLE_URI)
    ) {}
}

export const mapStyleStore = new MapStyle();

export const changeStyle = writable(mapStyleStore.accepted_uri)