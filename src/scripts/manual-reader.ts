import {
  applyLanguage,
  bindLanguageSwitch,
  preserveViewportAnchor,
  type SiteLanguage,
} from './language';

const root = document.documentElement;
const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-manual-section]'));
const tocLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-section-link]'));
const tocDialog = document.querySelector<HTMLDialogElement>('[data-toc-dialog]');
const openTocButton = document.querySelector<HTMLButtonElement>('[data-open-toc]');
const closeTocButton = document.querySelector<HTMLButtonElement>('[data-close-toc]');
const readerChrome = document.querySelector<HTMLElement>('.reader-chrome');

let activeSectionId = window.location.hash.slice(1) || sections[0]?.id;
let navigationSequence = 0;
let navigationTargetId: string | undefined;
let navigationLockUntil = 0;
let scrollFrame = 0;

function keepActiveTocLinkVisible(link: HTMLAnchorElement) {
  const sidebar = link.closest<HTMLElement>('.reader-sidebar');
  if (!sidebar) return;

  const sidebarRect = sidebar.getBoundingClientRect();
  const linkRect = link.getBoundingClientRect();
  const contextMargin = Math.min(80, sidebarRect.height * 0.2);
  const visibleTop = sidebarRect.top + contextMargin;
  const visibleBottom = sidebarRect.bottom - contextMargin;

  if (linkRect.top >= visibleTop && linkRect.bottom <= visibleBottom) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const linkCenter = linkRect.top + linkRect.height / 2;
  const sidebarCenter = sidebarRect.top + sidebarRect.height / 2;
  sidebar.scrollTo({
    top: sidebar.scrollTop + linkCenter - sidebarCenter,
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });
}

function updateActiveSection(sectionId: string | undefined) {
  if (!sectionId) return;
  const sectionChanged = activeSectionId !== sectionId;
  activeSectionId = sectionId;

  for (const link of tocLinks) {
    const isActive = link.dataset.sectionLink === sectionId;
    link.classList.toggle('is-active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'location');
      if (sectionChanged) keepActiveTocLinkVisible(link);
    }
    else link.removeAttribute('aria-current');
  }
}

function stickyOffset(): number {
  const chromeHeight =
    document.querySelector<HTMLElement>('.reader-chrome')?.getBoundingClientRect().height ?? 0;
  return chromeHeight + 24;
}

function sectionHeading(section: HTMLElement): HTMLElement {
  return section.querySelector<HTMLElement>('h2, h3') ?? section;
}

function sectionAtReadingLine(): HTMLElement | undefined {
  const readingLine = stickyOffset() + 2;
  let current = sections[0];

  for (const section of sections) {
    if (sectionHeading(section).getBoundingClientRect().top <= readingLine) current = section;
    else break;
  }

  return current;
}

function sectionClosestToReadingLine(): HTMLElement | undefined {
  const readingLine = stickyOffset();
  return sections.reduce<HTMLElement | undefined>((closest, section) => {
    if (!closest) return section;
    const sectionDistance = Math.abs(sectionHeading(section).getBoundingClientRect().top - readingLine);
    const closestDistance = Math.abs(sectionHeading(closest).getBoundingClientRect().top - readingLine);
    return sectionDistance < closestDistance ? section : closest;
  }, undefined);
}

function alignSection(section: HTMLElement, behavior: ScrollBehavior) {
  const heading = sectionHeading(section);
  const documentTop = heading.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: documentTop - stickyOffset(), behavior });
}

function cancelNavigationCorrection() {
  if (!navigationTargetId && Date.now() >= navigationLockUntil) return;

  navigationSequence += 1;
  navigationTargetId = undefined;
  navigationLockUntil = 0;

  const previousScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo({ top: window.scrollY, behavior: 'auto' });
  root.style.scrollBehavior = previousScrollBehavior;
  syncActiveSectionFromScroll();
}

function syncActiveSectionFromScroll() {
  if (Date.now() < navigationLockUntil) return;
  updateActiveSection(sectionAtReadingLine()?.id);
}

function navigateToSection(
  sectionId: string,
  { smooth = true, updateHash = true, duration = 1600 } = {},
) {
  const section = document.getElementById(sectionId);
  if (!(section instanceof HTMLElement)) return;

  const sequence = ++navigationSequence;
  navigationTargetId = sectionId;
  navigationLockUntil = Date.now() + duration;
  updateActiveSection(sectionId);

  if (updateHash && window.location.hash !== `#${sectionId}`) {
    history.pushState(null, '', `#${sectionId}`);
  }

  alignSection(section, smooth ? 'smooth' : 'auto');

  const correctionTimes = [250, 750, duration];
  for (const delay of correctionTimes) {
    window.setTimeout(() => {
      if (sequence !== navigationSequence) return;
      alignSection(section, 'auto');
      if (delay === duration) {
        navigationTargetId = undefined;
        navigationLockUntil = 0;
        syncActiveSectionFromScroll();
      }
    }, delay);
  }
}

function setLanguage(language: SiteLanguage, preservePosition = true) {
  if (language === 'en' && root.dataset.hasEnglish !== 'true') return;

  const currentSection =
    sectionClosestToReadingLine() ?? document.getElementById(activeSectionId);
  const currentHeading =
    currentSection instanceof HTMLElement ? sectionHeading(currentSection) : undefined;
  preserveViewportAnchor(preservePosition ? currentHeading : undefined, () => {
    applyLanguage(language, preservePosition);
    updateActiveSection(currentSection instanceof HTMLElement ? currentSection.id : undefined);
  });
}

bindLanguageSwitch(setLanguage);

setLanguage(root.dataset.language === 'en' ? 'en' : 'zh', false);

for (const link of tocLinks) {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    tocDialog?.close();
    const sectionId = link.dataset.sectionLink;
    if (sectionId) navigateToSection(sectionId);
  });
}

window.addEventListener(
  'scroll',
  () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      syncActiveSectionFromScroll();
    });
  },
  { passive: true },
);

window.addEventListener('wheel', cancelNavigationCorrection, { passive: true });
window.addEventListener('touchstart', cancelNavigationCorrection, { passive: true });
window.addEventListener('keydown', (event) => {
  if (
    ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)
  ) {
    cancelNavigationCorrection();
  }
});

window.addEventListener('hashchange', () => {
  const sectionId = window.location.hash.slice(1);
  if (sectionId) navigateToSection(sectionId, { smooth: false, updateHash: false });
});

for (const image of document.querySelectorAll<HTMLImageElement>('.manual-prose img')) {
  if (image.complete) continue;
  image.addEventListener(
    'load',
    () => {
      if (!navigationTargetId || Date.now() >= navigationLockUntil) return;
      const target = document.getElementById(navigationTargetId);
      if (target instanceof HTMLElement) alignSection(target, 'auto');
    },
    { once: true },
  );
}

const initialSectionId = window.location.hash.slice(1);
if (initialSectionId) {
  navigateToSection(initialSectionId, {
    smooth: false,
    updateHash: false,
    duration: 2400,
  });
} else {
  syncActiveSectionFromScroll();
}

if (readerChrome) {
  new ResizeObserver(() => {
    if (!navigationTargetId || Date.now() >= navigationLockUntil) return;

    const section = document.getElementById(navigationTargetId);
    if (section instanceof HTMLElement) alignSection(section, 'auto');
  }).observe(readerChrome);
}

openTocButton?.addEventListener('click', () => {
  if (!tocDialog) return;
  tocDialog.showModal();
  openTocButton.setAttribute('aria-expanded', 'true');
  closeTocButton?.focus();
});

closeTocButton?.addEventListener('click', () => tocDialog?.close());

tocDialog?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    tocDialog.close();
  }
});

tocDialog?.addEventListener('close', () => {
  openTocButton?.setAttribute('aria-expanded', 'false');
  openTocButton?.focus();
});
