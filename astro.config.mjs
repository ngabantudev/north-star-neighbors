import { defineConfig } from 'astro/config';

export default defineConfig({
  // Fully static output. There is no server, no session, nothing to log.
  output: 'static',
  build: {
    // Inline small assets so a weak connection makes fewer round trips.
    inlineStylesheets: 'auto',
  },
  devToolbar: { enabled: false },
});
