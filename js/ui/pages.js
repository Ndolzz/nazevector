// js/ui/pages.js — Perutean lokal antar halaman (Studio, Preset, Tentang).

import { qsa } from '../dom.js';

export function initRouting(store) {
  const navButtons = qsa('[data-nav]');
  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      store.set({ page: button.dataset.nav });
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
