export {};

import {
  activeLanguage,
  applyLanguage,
  bindLanguageSwitch,
  preserveViewportAnchor,
} from './language';

const normalize = (value: string) => value.toLocaleLowerCase().trim().replace(/\s+/g, ' ');

const searchInput = document.querySelector<HTMLInputElement>('[data-catalog-search]');
const filters = Array.from(document.querySelectorAll<HTMLSelectElement>('[data-catalog-filter]'));
const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-catalog-card]'));
const count = document.querySelector<HTMLElement>('[data-catalog-count]');
const empty = document.querySelector<HTMLElement>('[data-catalog-empty]');
const clearButton = document.querySelector<HTMLButtonElement>('[data-catalog-clear]');

function currentLanguage() {
  return activeLanguage();
}

function catalogueAnchor() {
  const headerHeight = document.querySelector<HTMLElement>('.site-header')?.getBoundingClientRect().height ?? 0;
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('.catalog-intro, .catalog-controls, [data-catalog-card]:not([hidden])'),
  );
  return candidates.reduce<HTMLElement | undefined>((closest, candidate) => {
    if (!closest) return candidate;
    const candidateDistance = Math.abs(candidate.getBoundingClientRect().top - headerHeight);
    const closestDistance = Math.abs(closest.getBoundingClientRect().top - headerHeight);
    return candidateDistance < closestDistance ? candidate : closest;
  }, undefined);
}

function updateInterfaceLanguage() {
  const language = currentLanguage();
  if (searchInput) searchInput.placeholder = searchInput.dataset[language === 'en' ? 'placeholderEn' : 'placeholderZh'] ?? '';
  for (const option of document.querySelectorAll<HTMLOptionElement>('[data-label-zh]')) {
    option.textContent = option.dataset[language === 'en' ? 'labelEn' : 'labelZh'] ?? option.textContent;
  }
}

function updateCatalog() {
  const keywords = normalize(searchInput?.value ?? '').split(' ').filter(Boolean);
  const selected = Object.fromEntries(filters.map((filter) => [filter.dataset.catalogFilter, filter.value]));
  let visibleCount = 0;

  for (const card of cards) {
    const searchable = normalize(card.dataset.search ?? '');
    const matchesKeywords = keywords.every((keyword) => searchable.includes(keyword));
    const matchesFilters =
      (!selected.type || card.dataset.type === selected.type) &&
      (!selected.brand || card.dataset.brand === selected.brand) &&
      (!selected.class || card.dataset.class === selected.class);
    const visible = matchesKeywords && matchesFilters;
    card.hidden = !visible;
    if (visible) visibleCount += 1;
  }

  if (count) {
    count.dataset.count = String(visibleCount);
    count.dataset.textZh = `${visibleCount} 本手册`;
    count.dataset.textEn = `${visibleCount} manuals`;
    count.textContent = currentLanguage() === 'en' ? count.dataset.textEn : count.dataset.textZh;
  }
  if (empty) empty.hidden = visibleCount !== 0;
}

searchInput?.addEventListener('input', updateCatalog);
for (const filter of filters) filter.addEventListener('change', updateCatalog);
window.addEventListener('pageshow', updateCatalog);
clearButton?.addEventListener('click', () => {
  if (searchInput) searchInput.value = '';
  for (const filter of filters) filter.value = '';
  updateCatalog();
  searchInput?.focus();
});

bindLanguageSwitch((language) => {
  preserveViewportAnchor(catalogueAnchor(), () => {
    applyLanguage(language);
    updateInterfaceLanguage();
    updateCatalog();
  });
});

applyLanguage(currentLanguage(), false);
updateInterfaceLanguage();
updateCatalog();
