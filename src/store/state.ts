import { derived, writable, type Writable } from 'svelte/store';
// import { apiURL } from '../store/polygons'

export enum States {
    AddingZoneCanvas = 1,
    AddingZoneMap,
    Waiting,
    EditingZone,
    DeletingZoneCanvas,
    DeletingZoneMap,
    PickPolygon
}

export const state = writable(States.Waiting);

export const mjpegReady = writable(false)
export const dataReady = writable(false)

const defaultSchema = 'http'
const defaultHost = 'localhost'
const defaultPort = 42001

const currentURL = window.location.href
const appURL = new URL(currentURL)
const appSchema = appURL.protocol.replace(/:/g,'') || defaultSchema
const appHost = appURL.hostname || defaultHost
const appPort = process.env.NODE_ENV === 'development'? defaultPort : parseInt(appURL.port) || ((appSchema === 'https:') ? 443 : 80) || defaultPort

class ApiSchema {
    constructor(
        public schema: Writable<string> = writable(appSchema),
        public host: Writable<string> = writable(appHost),
        public port: Writable<number> = writable(appPort)
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
export const changeAPI = writable(`${appSchema}://${appHost}:${appPort}`)

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