How to build static HTML

1. Install adapter
```
npm i -D @sveltejs/adapter-static
```

2. Make folloding changes in [svelte.config.js](svelte.config.js)
```
// import adapter from '@sveltejs/adapter-auto';
import adapter from '@sveltejs/adapter-static';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),

	kit: {
		// adapter: adapter(),
		adapter: adapter({
			// default options are shown. On some platforms
			// these options are set automatically — see below
			pages: 'build',
			assets: 'build',
			fallback: null,
			precompress: false,
			strict: true
		})
	}
};

export default config;
```

3. Create [+layout.js](src/routes/+layout.js) file with contents
```
touch src/routes/+layout.js

// This can be false if you're using a fallback (i.e. SPA mode)
export const prerender = true;
```