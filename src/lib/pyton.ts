// Data for Pyton-utstillingen (/pyton/).
//
// Bladet beskrives i src/data/pyton/utgave.json. Hver historie er en egen fil i
// src/data/pyton/historier/. Ny historie = ny JSON-fil, ingen kodeendring.
// Historier med "published": false vises ikke og får ingen URL.
import nodePath from 'node:path';
import sharp from 'sharp';
import issueData from '../data/pyton/utgave.json';

interface PanelData {
  src: string; // rot-relativ sti, f.eks. /images/wunder/a1.webp
  alt?: string;
}

interface StoryData {
  id: string; // brukes i URL-en: /pyton/<id>/
  order: number; // rekkefølge i innholdsfortegnelsen
  published: boolean;
  title: string;
  description?: string;
  thumbnail: string;
  panels: PanelData[];
}

export interface Img {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface Story {
  id: string;
  title: string;
  description: string;
  thumbnail: Img;
  panels: Img[];
}

const files = import.meta.glob<StoryData>('../data/pyton/historier/*.json', {
  eager: true,
  import: 'default',
});

// Bildestørrelse leses fra kilden i images/ ved bygging, slik at <img> får
// riktig width/height og siden ikke hopper mens bildene lastes.
const sizeCache = new Map<string, { width: number; height: number }>();

async function imageSize(src: string, context: string) {
  const cached = sizeCache.get(src);
  if (cached) return cached;
  const file = nodePath.join(process.cwd(), 'images', src.replace(/^\/images\//, ''));
  try {
    const { width = 0, height = 0 } = await sharp(file).metadata();
    const size = { width, height };
    sizeCache.set(src, size);
    return size;
  } catch {
    throw new Error(`[pyton] Fant ikke bildet ${src} (${context}). Ligger det i images/?`);
  }
}

async function img(src: string, alt: string, context: string): Promise<Img> {
  return { src, alt, ...(await imageSize(src, context)) };
}

export async function getIssue() {
  return {
    ...issueData,
    cover: await img(issueData.cover.src, issueData.cover.alt, 'forsiden'),
  };
}

export async function getPublishedStories(): Promise<Story[]> {
  const stories = Object.values(files)
    .filter((s) => s.published)
    .sort((a, b) => a.order - b.order);

  return Promise.all(
    stories.map(async (s) => {
      const total = s.panels.length;
      return {
        id: s.id,
        title: s.title,
        description: (s.description ?? '').trim(),
        thumbnail: await img(s.thumbnail, '', s.id),
        panels: await Promise.all(
          s.panels.map((p, i) =>
            img(p.src, p.alt?.trim() || `${s.title}, rute ${i + 1} av ${total}`, s.id),
          ),
        ),
      };
    }),
  );
}
