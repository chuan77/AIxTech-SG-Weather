import { Sidebar } from './Sidebar';
import { Hero } from './Hero';
import { ThemeSelector } from './ThemeSelector';

export function Layout() {
  return (
    <div className="flex h-full min-h-screen w-full flex-col md:flex-row">
      <Sidebar />
      <Hero />
      <ThemeSelector />
    </div>
  );
}
