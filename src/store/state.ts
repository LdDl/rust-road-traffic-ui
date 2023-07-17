import { derived, writable, type Writable } from 'svelte/store';
// import { apiURL } from '../store/polygons'

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

const defaultSchema = 'http'
const defaultHost = 'localhost'
const defaultPort = 42001

class ApiSchema {
    constructor(
        public schema: Writable<string> = writable(defaultSchema),
        public host: Writable<string> = writable(defaultHost),
        public port: Writable<number> = writable(defaultPort)
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
export const changeAPI = writable(`${defaultSchema}://${defaultHost}:${defaultPort}`)

class MapStyle {
    constructor(
        public uri: Writable<string> = writable('https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'),
        public accepted_uri: Writable<string> = writable('https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL')
    ) {}
}

export const mapStyleStore = new MapStyle();

export const changeStyle = writable(mapStyleStore.accepted_uri)

// Allow for multiple stores (good for contexts)
// export const apiUrlStore = () => new ApiSchema();