import { useEffect } from 'react';

export default function useGoogleFonts(headlineFont: string, bodyFont: string) {
  useEffect(() => {
    if (!headlineFont && !bodyFont) return;

    const head = document.head;
    const existingLink = document.getElementById('google-fonts-dynamic');

    const fonts = new Set<string>();
    if (headlineFont) fonts.add(headlineFont.replace(/\s+/g, '+') + ':wght@400;700;900');
    if (bodyFont) fonts.add(bodyFont.replace(/\s+/g, '+') + ':wght@400;500;700;900');

    if (fonts.size === 0) return;

    const familyString = Array.from(fonts).join('&family=');
    const href = `https://fonts.googleapis.com/css2?family=${familyString}&display=swap`;

    if (existingLink) {
      if (existingLink.getAttribute('href') !== href) {
        existingLink.setAttribute('href', href);
      }
    } else {
      const link = document.createElement('link');
      link.id = 'google-fonts-dynamic';
      link.rel = 'stylesheet';
      link.href = href;
      head.appendChild(link);
    }
  }, [headlineFont, bodyFont]);
}
