"""Colour-only adaptation of the preserved legacy presentation layer."""
import colorsys
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PALETTE = json.loads((ROOT / 'src/palette.json').read_text())
COLORS = PALETTE['colors']
HEX = re.compile(r'#[0-9a-fA-F]{3,8}\b')


def rgb(value):
    return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))


def variables():
    """Shared CSS colours also supply the Canvas renderer's palette."""
    declarations = []
    for name, value in COLORS.items():
        declarations += [f'--{name}:{value}', f'--{name}-rgb:{",".join(map(str, rgb(value)))}']
    # The preserved base stylesheet also uses these historic token names.
    aliases = {'pine': 'link', 'brass': 'accent', 'soft-brass': 'accent-soft',
               'navy': 'night', 'navy-border': 'night-border'}
    declarations += [f'--{old}:var(--{new})' for old, new in aliases.items()]
    return ';'.join(declarations) + ';'


def recolor_legacy(value):
    """Keep tonal hierarchy and alpha while adapting the legacy colours.

    Exact Canvas roles use the shared palette. Other legacy CSS declarations
    retain their lightness. Cosmic gold uses neutral greys with yellow accents;
    the earlier white-ink branch uses plum and slate.
    """
    raw = value.lower()[1:]
    if len(raw) in (3, 4):
        raw = ''.join(c * 2 for c in raw)
    if len(raw) not in (6, 8):
        return value
    alpha = raw[6:]
    role = PALETTE['canvasLegacy'].get(value.lower())
    if role:
        return COLORS[role] + alpha
    channels = tuple(int(raw[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hue, light, saturation = colorsys.rgb_to_hls(*channels)
    degrees = hue * 360
    if PALETTE['id'] == 'cosmic-gold':
        if light < .8 and saturation > .25 and (degrees < 75 or degrees > 310):
            target_hue, target_saturation = 45 / 360, min(.65, saturation)
        else:
            target_hue, target_saturation = 215 / 360, .025
    elif light > .8 or saturation < .13:
        target_hue, target_saturation = 230 / 360, .06
    elif degrees < 75 or degrees > 310:
        target_hue, target_saturation = 330 / 360, min(.23, saturation)
    else:
        target_hue, target_saturation = 228 / 360, min(.22, saturation)
    result = colorsys.hls_to_rgb(target_hue, light, target_saturation)
    return '#' + ''.join(f'{round(c * 255):02x}' for c in result) + alpha


def legacy_css(css):
    return HEX.sub(lambda match: recolor_legacy(match.group()), css)


def legacy_script(script):
    # A deliberately restricted transformation: quoted Canvas hex colours only.
    # Scripture, copy, expressions, flow and the application logic stay intact.
    return re.sub(r'(["\'])(#[0-9a-fA-F]{6,8})\1',
                  lambda m: m[1] + recolor_legacy(m[2]) + m[1], script)
