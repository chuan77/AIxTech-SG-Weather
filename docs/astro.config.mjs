// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

export default defineConfig({
  integrations: [
    // Must come before Starlight so it claims ```mermaid fences before
    // Expressive Code turns them into plain code blocks.
    mermaid({
      theme: 'default',
      autoTheme: true, // follows Starlight's light/dark toggle
    }),
    starlight({
      title: 'Weather Starter',
      description:
        'Developer docs for the Weather Starter Singapore weather dashboard (Express + React/Vite + SQLite).',
      sidebar: [
        { label: 'Start here', items: ['getting-started', 'configuration'] },
        { label: 'Architecture', items: [{ autogenerate: { directory: 'architecture' } }] },
        { label: 'Backend', items: [{ autogenerate: { directory: 'backend' } }] },
        { label: 'Frontend', items: [{ autogenerate: { directory: 'frontend' } }] },
        { label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
      ],
    }),
  ],
});
