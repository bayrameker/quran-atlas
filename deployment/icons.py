"""Small native SVGs; readable labels remain the accessible names."""
PATHS = {
    'search': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    'calculator': '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h1m6 0h1m-8 4h1m6 0h1m-8 4h1m6 0h1"/>',
    'type': '<path d="M4 5h16M12 5v15m-4 0h8M4 5v3m16-3v3"/>',
    'play': '<path d="m8 4 12 8-12 8Z"/>',
    'pause': '<path d="M8 4v16M16 4v16"/>',
    'back-five': '<path d="M5 8H1V4m1 4a10 10 0 1 1 1 12M13 7h-4v5h3a3 3 0 0 1 0 6H9"/>',
    'forward-five': '<path d="M19 8h4V4m-1 4a10 10 0 1 0-1 12M13 7H9v5h3a3 3 0 0 1 0 6H9"/>',
    'download': '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    'compare': '<path d="M3 4h7v16H3zm11 0h7v16h-7zM6 8h1m-1 4h1m10-4h1m-1 4h1"/>',
    'close': '<path d="m6 6 12 12M18 6 6 18"/>',
    'next': '<path d="m9 4 8 8-8 8"/>',
    'previous': '<path d="m15 4-8 8 8 8"/>',
    'plus': '<path d="M12 4v16M4 12h16"/>',
    'minus': '<path d="M4 12h16"/>',
    'fit': '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M9 12h6m-3-3v6"/>',
    'layers': '<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
    'settings': '<path d="M3 5h18M3 12h18M3 19h18"/><circle cx="8" cy="5" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="19" r="2"/>',
    'rotate': '<path d="M20 7V2m0 5h-5m5 0a9 9 0 1 0 1 8"/>',
    'check': '<path d="m4 12 5 5L20 6"/>',
    'bookmark': '<path d="M6 3h12v18l-6-4-6 4Z"/>',
    'orbit': '<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="3"/><path d="m19 4 1 1m-16 14 1 1"/>',
    'network': '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="m7 7 3 3m4 4 3 3m0-10-3 3m-4 4-3 3"/>',
    'pen': '<path d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 15zM4 20l2-5 3 4M3 22h18"/>',
    'book': '<path d="M12 5C9 2 4 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-2-1-7-2-10 1v15"/><path d="M5 7h3m-3 4h3m8-4h3m-3 4h3"/>',
    'pages': '<path d="M7 3h13v15H7zM4 6H2v16h14v-2M10 7h7m-7 4h7m-7 3h4"/>',
    'source': '<path d="M9 4H4v16h16v-5M14 3h7v7m0-7L10 14"/>',
    'library': '<path d="M4 4h4v16H4zm6 0h4v16h-4zm7 0 4 1-1 15-4-1z"/>',
    'arrow': '<path d="M5 12h14m-6-6 6 6-6 6"/>',
}


def icon(name, extra=''):
    return f'<svg class="atlas-icon {extra}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{PATHS[name]}</svg>'


def mask_rules():
    from urllib.parse import quote
    variables, selectors = [], []
    for name, path in PATHS.items():
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{path}</svg>'
        variables.append(f'--ui-{name}:url("data:image/svg+xml,{quote(svg, safe="")}")')
        selectors.append(f'[data-icon="{name}"]{{--ui-icon:var(--ui-{name})}}')
    return ':root{' + ';'.join(variables) + '}' + '\n' + '\n'.join(selectors)
