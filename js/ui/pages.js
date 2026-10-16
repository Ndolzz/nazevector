// js/ui/pages.js — Perutean lokal antar halaman (Studio, Preset, Tentang).
// NB-1: tombol dengan data-nav-scroll (mis. "Buka Studio") menggulir ke area
// tujuan setelah halaman aktif, sehingga tidak pernah menjadi no-op.

import { qs, qsa } from '../dom.js';

export function initRouting(store) {
  const navButtons = qsa('[data-nav]');

  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetPage = button.dataset.nav;
      const pageChanged = store.get().page !== targetPage;
      store.set({ page: targetPage });

      const scrollTarget = button.dataset.navScroll
        ? qs('#' + button.dataset.navScroll)
        : null;
      if (scrollTarget) {
        scrollToTarget(scrollTarget);
        return;
      }
      if (pageChanged) {
        window.scrollTo({ top: 0, behavior: scrollBehavior() });
      }
    });
  });

  store.subscribe(render);
  render(store.get());

  function render(state) {
    navButtons.forEach((button) => {
      const isNavLink = button.classList.contains('nav-link');
      const isActive = isNavLink && button.dataset.nav === state.page;
      button.classList.toggle('active', isActive);
      if (isNavLink) {
        button.setAttribute('aria-current', isActive ? 'page' : 'false');
      }
    });
    qsa('.page').forEach((section) => {
      section.classList.toggle('page-hidden', section.id !== 'page-' + state.page);
    });
  }
}

function scrollBehavior() {
  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduceMotion ? 'auto' : 'smooth';
}

function scrollToTarget(element) {
  if (!element) return;
  element.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}
