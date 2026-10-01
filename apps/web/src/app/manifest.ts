import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EastPark',
    short_name: 'EastPark',
    description: 'Compound services, local commerce, and community management in one trusted app.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d0c0b',
    theme_color: '#0d0c0b',
    lang: 'ar',
    dir: 'rtl',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
