/// <reference types="astro/client" />

declare global {
  interface Window {
    /**
     * Inlined by index.astro: the minimal {id, name, categories, lat, lon}
     * records the map needs, so it doesn't refetch the directory.
     */
    __ANCHORS__: Array<{
      id: string;
      name: string;
      categories: string[];
      lat: number;
      lon: number;
    }>;
  }
}

export {};
