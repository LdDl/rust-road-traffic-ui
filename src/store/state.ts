import { derived, writable, type Writable } from 'svelte/store';
import { apiURL } from '../store/polygons'

export enum States {
    AddingPolygon = 1,
    Waiting,
    EditingPolygon,
    DeletingPolygon,
    PickPolygon
}

export const state = writable(States.Waiting);

export const mjpegReady = writable(false)
export const dataReady = writable(false)

export const changeAPI = writable(apiURL)

class ApiSchema {
    constructor(
        public schema: Writable<string> = writable('http'),
        public host: Writable<string> = writable('localhost'),
        public port: Writable<number> = writable(42001)
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

class MapStyle {
    constructor(
        public uri: Writable<string> = writable('https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'),
        public accepted_uri: Writable<string> = writable('https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL')
    ) {}
    set update_uri(new_uri: string) {
        console.log('here')
        this.uri = writable(new_uri)
        this.accepted_uri = writable(new_uri)
    }
}

export const mapStyleStore = new MapStyle();

export const changeStyle = writable(mapStyleStore.accepted_uri)

// Allow for multiple stores (good for contexts)
// export const apiUrlStore = () => new ApiSchema();