import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export default function globalSetup() {
  // Reset dsn/index.json before E2E suite so initCarousel() finds no prior designs.
  // This prevents test pollution: designs generated in one spec would appear as
  // "previous designs" in the next spec, showing the old-carousel widget instead
  // of generating fresh ones.
  const dsnDir = join(process.cwd(), 'landing_page', 'dsn');
  mkdirSync(dsnDir, { recursive: true });
  writeFileSync(join(dsnDir, 'index.json'), '[]');
}
