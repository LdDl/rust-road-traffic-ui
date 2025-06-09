# UI for Road traffic detector


## Table of Contents

- [About](#about)
- [Installation and usage](#installation-and-usage)

## About

It's just simple UI for toy utility for monitoring road traffic from video - https://github.com/LdDl/rust-road-traffic

W.I.P.

<video src='https://github.com/user-attachments/assets/49fcc355-c05f-4847-961f-13a4abb1b0a6' width="720px"></video>

Current state of UI: pretty ugly code since I'm not familiar with Svelte enough.

Current plans: eliminate vanilla JS from main repository and use build from this one.

Used tech:
1. Svelte / SvelteKit - https://kit.svelte.dev/
2. Maplibre - https://maplibre.org/
3. MapboxGL Draw - https://github.com/mapbox/mapbox-gl-draw
4. Fabric - http://fabricjs.com/
5. Materialize CSS - https://materializecss.com/

## Installation and usage

1. Install dependencies

```shell
npm i
```

2. Run in development mode

```shell
npm run dev
```

3. Build statically (e.g. for web-server). Thanks to [@sveltejs/adapter-static](https://www.npmjs.com/package/@sveltejs/adapter-static)

```shell
npm run build
# Final index.html and assets files will be placed in `build` directory
```
