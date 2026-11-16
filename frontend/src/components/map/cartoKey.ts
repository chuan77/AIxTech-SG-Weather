/**
 * The CARTO basemap key. In production the server puts it in index.html as
 * <meta name="carto-api-key"> at runtime (backend/src/indexHtml.ts); in local dev Vite inlines
 * VITE_CARTO_API_KEY from frontend/.env.local at build time. Undefined means keyless tiles.
 */
export function pickCartoApiKey(
  runtimeKey: string | null | undefined,
  buildTimeKey: string | undefined,
): string | undefined {
  return runtimeKey?.trim() || buildTimeKey?.trim() || undefined;
}

export function readCartoApiKey(): string | undefined {
  const meta =
    typeof document === 'undefined'
      ? null
      : document.querySelector<HTMLMetaElement>('meta[name="carto-api-key"]');
  return pickCartoApiKey(
    meta?.content,
    import.meta.env.VITE_CARTO_API_KEY as string | undefined,
  );
}
