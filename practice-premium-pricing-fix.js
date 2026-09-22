/* AxomPrep Practice – Premium pricing fix
   Loaded after practice.js. Replaces the old hard-coded ₹249/month upgrade text.
*/
(function () {
  'use strict';

  const OLD_TEXTS = [
    'Upgrade for ₹249/month →',
    'Upgrade for ₹249/month →',
    'Upgrade for ₹249/month',
    '₹249/month'
  ];

  const PREMIUM_URL = '/premium.html';

  function replaceInTextNode(node) {
    const text = node.nodeValue || '';
    if (!OLD_TEXTS.some(t => text.includes(t))) return false;

    const parent = node.parentElement;
    if (!parent) return false;

    const html = text
      .replace(/Upgrade for ₹249\/month\s*→?/g,
        '<a href="/premium.html" class="practice-upgrade-link">Upgrade: ₹49 / 1 Month or ₹129 / 3 Months →</a>')
      .replace(/₹249\/month/g,
        '<a href="/premium.html" class="practice-upgrade-link">₹49 / 1 Month or ₹129 / 3 Months</a>');

    if (html === text) return false;
    const wrapper = document.createElement('span');
    wrapper.innerHTML = html;

    const frag = document.createDocumentFragment();
    Array.from(wrapper.childNodes).forEach(n => frag.appendChild(n));
    node.parentNode.replaceChild(frag, node);
    return true;
  }

  function fix() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(replaceInTextNode);

    // Ensure the resulting link remains visually consistent with existing AxomPrep pricing links.
    if (!document.getElementById('practice-premium-pricing-fix-css')) {
      const style = document.createElement('style');
      style.id = 'practice-premium-pricing-fix-css';
      style.textContent = `
        .practice-upgrade-link {
          color: inherit;
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 2px;
          white-space: normal;
        }
        .practice-upgrade-link:hover { opacity: .85; }
      `;
      document.head.appendChild(style);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fix, { once: true });
  } else {
    fix();
  }
})();
