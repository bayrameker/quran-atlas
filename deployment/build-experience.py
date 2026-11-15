#!/usr/bin/env python3
"""Build a reviewable static release without touching the running public tree."""
from pathlib import Path
import gzip
import hashlib
import json
import re
import shutil
import subprocess
from palette import PALETTE, COLORS, variables, legacy_css, legacy_script
from icons import icon, mask_rules
from workbench import enhance

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
STAGE = ROOT / 'deployment/stage'
ASSETS = STAGE / 'assets'
BASE = SRC / 'base.html'
VENDOR = SRC / 'vendor'
if not STAGE.exists():
    shutil.copytree(ROOT / 'public', STAGE)
ASSETS.mkdir(parents=True, exist_ok=True)
original = BASE.read_text()
html = re.sub(r'<style>([\s\S]*?)</style>',
              lambda m: '<style>' + legacy_css(m[1]) + '</style>', original)
html = re.sub(r'<script>([\s\S]*?)</script>',
              lambda m: '<script>' + legacy_script(m[1]) + '</script>', html)

def asset(name, data, suffix):
    digest = hashlib.sha256(data).hexdigest()[:12]
    filename = f'{name}.{digest}.{suffix}'
    (ASSETS / filename).write_bytes(data)
    return filename

mark = (SRC / 'atlas-mark.svg').read_text()
for token in ['ink', 'silver', 'on-dark', 'gold']:
    mark = mark.replace('__' + token.upper().replace('-', '_') + '__', COLORS[token])
mark_name = asset('atlas-mark', mark.encode(), 'svg')
html, mark_count = re.subn(r'<link rel="icon"[^>]*>',
                          f'<link rel="icon" type="image/svg+xml" href="assets/{mark_name}">', html, count=1)
assert mark_count == 1
html, emblem_count = re.subn(r'(<img class="emblem" src=")[^"]+("[^>]*>)',
                            lambda m: m[1] + 'assets/' + mark_name + m[2], html, count=1)
assert emblem_count == 1
html = html.replace('<meta name="color-scheme" content="light">',
                    '<meta name="color-scheme" content="light">\n'
                    f'<meta name="theme-color" content="{COLORS["space"]}">', 1)

font_names = {}
for weight in [400, 500, 700]:
    path = VENDOR / 'fonts' / f'satoshi-{weight}.woff2'
    assert path.read_bytes().startswith(b'wOF2'), path
    font_names[weight] = asset(f'satoshi-{weight}', path.read_bytes(), 'woff2')

ripples = VENDOR / 'pixelfx/ripples.png'
ripple_name = asset('atlas-selection-rings', ripples.read_bytes(), 'png')
css = (SRC / 'atlas-experience.css').read_text()
css = css.replace('__PALETTE_VARIABLES__', variables())
for weight, filename in font_names.items():
    css = css.replace(f'__FONT_{weight}__', filename)
css = css.replace('__RIPPLE__', ripple_name)
css_name = asset('atlas-experience', css.encode(), 'css')
js = (SRC / 'atlas-experience.js').read_text()
subprocess.run(['node', '--check', str(SRC / 'atlas-experience.js')], check=True)
js_name = asset('atlas-experience', js.encode(), 'js')
cosmos = (SRC / 'atlas-cosmos.js').read_text()
subprocess.run(['node', '--check', str(SRC / 'atlas-cosmos.js')], check=True)
cosmos_name = asset('atlas-cosmos', cosmos.encode(), 'js')
workbench_css = (SRC / 'atlas-workbench.css').read_text().replace('__ICON_RULES__', mask_rules())
workbench_css_name = asset('atlas-workbench', workbench_css.encode(), 'css')
subprocess.run(['node', '--check', str(SRC / 'atlas-workbench.js')], check=True)
workbench_js_name = asset('atlas-workbench', (SRC / 'atlas-workbench.js').read_bytes(), 'js')

pattern = r'<script type="application/json" id="localization-data">([\s\S]*?)</script>'
match = re.search(pattern, html)
copy = json.loads(match.group(1))
new_copy = json.loads((SRC / 'experience-copy.json').read_text())
new_copy.update(json.loads((SRC / 'workbench-copy.json').read_text()))
languages = ['tr', 'en', 'ar', 'fr', 'es', 'id']
for key, versions in new_copy.items():
    assert len(versions) == len(languages), key
    for language, text in zip(languages, versions):
        copy[language][key] = text
payload = json.dumps(copy, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
html = html[:match.start(1)] + payload + html[match.end(1):]

hero = '''  <section class="cosmic-hero" aria-labelledby="title"><div class="wrap hero">
    <div class="hero-text" data-reveal>
      <p class="overline" data-i18n="experienceOverline">Tilavet · Tefekkür · Tedkik</p>
      <h1 id="title"><span data-i18n="heroOne">Kur’an-ı Kerim’in</span><br><span data-i18n="heroTwo">âyetler arası irtibat haritası</span></h1>
      <p data-i18n="heroLead">Kur’an-ı Kerim’in âyetleri arasındaki lafız ve mâna irtibatlarını, tefsir kaynaklarını ve i‘câzına dair açıklamaları inceleyin.</p>
      <dl class="hero-stats">
        <div><dd id="stat-surahs">114</dd><dt data-i18n="surahs">sûre</dt></div>
        <div><dd id="stat-verses">6.236</dd><dt data-i18n="verses">âyet</dt></div>
        <div><dd id="stat-pairs">9.319</dd><dt data-i18n="pairs">âyet çifti</dt></div>
      </dl>
      <div class="hero-actions">
        <a class="hero-explore" href="#harita"><span data-i18n="exploreMap">Âyet haritasını inceleyin</span><span aria-hidden="true">↗</span></a>
        <a class="hero-route" href="#icaz" data-i18n="routeLink">İ‘câz okumalarına geçin</a>
      </div>
      <button type="button" id="resume-reading" class="hero-route resume-reading" hidden></button>
    </div>
    <div class="hero-instrument" data-reveal>
      <div class="instrument-label"><span data-i18n="instrumentLabel">İrtibat atlası</span><span><i aria-hidden="true"></i><span data-i18n="realData">Kaynak verileriyle</span></span></div>
      <div class="folio">
        <span class="hero-note" data-i18n="instrumentNote">114 sûre · bir bütün</span>
        <canvas id="hero-atlas" aria-hidden="true"></canvas>
        <div class="instrument-reference"><small data-i18n="focusMode">Seçili âyet</small><strong id="instrument-selected">Hûd 11:44</strong><p id="instrument-count"></p></div>
      </div>
      <div class="instrument-examples" role="group" data-aria="instrumentLabel">
        <button type="button" data-hero-ref="11:44" aria-pressed="true">Hûd 11:44</button>
        <button type="button" data-hero-ref="55:13" aria-pressed="false">Rahmân 55:13</button>
        <button type="button" data-hero-ref="96:1" aria-pressed="false">Alak 96:1</button>
        <button type="button" data-hero-ref="33:41" aria-pressed="false">Ahzâb 33:41</button>
      </div>
      <p class="instrument-footnote" data-i18n="instrumentHelp">Bir sûre noktasını seçebilir, ardından âyet haritasını açabilirsiniz.</p>
    </div>
  </div></section>
  <nav class="wrap journey-index" data-aria="mainNav">
    <a href="#harita"><b aria-hidden="true">01</b><span><strong data-i18n="map">Harita</strong><small data-i18n="mapIndexLead">Âyetler arasındaki irtibatlar</small></span></a>
    <a href="#sayim"><b aria-hidden="true">02</b><span><strong data-i18n="studyNav">Lafız ve ebced</strong><small data-i18n="wordIndexLead">Lafızdan harfe, harften hesaba</small></span></a>
    <a href="#icaz"><b aria-hidden="true">03</b><span><strong data-i18n="ijaz">İ‘câz</strong><small data-i18n="ijazIndexLead">12 kaynaklı okuma rotası</small></span></a>
    <a href="#husrev"><b aria-hidden="true">04</b><span><strong data-i18n="husrevJump">Hüsrev hattı</strong><small data-i18n="husrevIndexLead">Mushaf sayfalarında yan yana</small></span></a>
  </nav>
'''
hero = hero.replace('<span aria-hidden="true">↗</span>', icon('arrow'))
hero = hero.replace('<div class="instrument-label"><span', '<div class="instrument-label">'+icon('orbit')+'<span', 1)
for target, name in [('harita', 'network'), ('sayim', 'pen'), ('icaz', 'book'), ('husrev', 'pages')]:
    hero = hero.replace(f'<a href="#{target}"><b', f'<a href="#{target}">'+icon(name)+'<b', 1)
html, count = re.subn(r'  <section class="wrap hero"[\s\S]*?  </section>\n', lambda _: hero, html, count=1)
assert count == 1
html = html.replace('</header>\n<main>', '<div class="experience-progress" aria-hidden="true"></div>\n</header>\n<main>', 1)

chapters = [('harita', 'workspaceLabel'), ('sayim', 'studyNav'), ('icaz', 'ijaz'), ('tevafuk', 'countingNav'), ('kaynaklar', 'sources'), ('kutuphane', 'library')]
for index, (section_id, key) in enumerate(chapters, 1):
    name = {'harita':'network', 'sayim':'pen', 'icaz':'book', 'tevafuk':'pages', 'kaynaklar':'source', 'kutuphane':'library'}[section_id]
    marker = f'<div class="chapter-stamp">{icon(name)}<span aria-hidden="true">{index:02d}</span><span data-i18n="{key}">{copy["tr"][key]}</span></div>'
    if section_id == 'kaynaklar':
        marker = marker.replace('class="chapter-stamp"', 'class="chapter-stamp wrap"')
    if section_id == 'icaz':
        html = html.replace('<section id="icaz" class="essay">\n    <div class="wrap">', '<section id="icaz" class="essay">\n    <div class="wrap">'+marker, 1)
    else:
        expression = r'(<section\b[^>]*\bid="' + section_id + r'"[^>]*>)'
        html, count = re.subn(expression, lambda m: m.group(1)+marker, html, count=1)
        assert count == 1, section_id

reading_tools = '''        <div class="reader-save">
          <button type="button" id="save-verse" aria-pressed="false" data-i18n="saveVerse">Âyeti işaretle</button>
          <div class="reader-size-controls"><span data-i18n="fontSize">Yazı</span><button type="button" id="reader-font-smaller" data-aria="fontSmaller">A−</button><button type="button" id="reader-font-larger" data-aria="fontLarger">A+</button></div>
        </div>
'''
assert html.count('        <div class="relation-head">') == 1
html = html.replace('        <div class="relation-head">', reading_tools+'        <div class="relation-head">', 1)
atlas_controls = '''    <div class="atlas-status-strip"><span data-i18n="atlasHint">Sûreyi seçin · Yakınlaşın · Âyeti okuyun</span><div class="atlas-actions"><button type="button" id="atlas-depth" aria-pressed="true" data-i18n="depthView">Derinlik</button><button type="button" id="atlas-expand" aria-pressed="false" data-i18n="openFocus">Geniş görünüm</button></div></div>
'''
html = html.replace('    <noscript><p>Ayetleri ve bağlantı haritasını', atlas_controls+'    <noscript><p>Ayetleri ve bağlantı haritasını', 1)
html, workspace_count = re.subn(r'(<section\b[^>]*\bid="harita"[^>]*>)', r'<div class="cosmic-workspace">\1', html, count=1)
html, workspace_end_count = re.subn(r'(</noscript>\s*</section>)', r'\1</div>', html, count=1)
assert workspace_count == workspace_end_count == 1

chrome = '''
<nav class="chapter-rail" data-aria="mainNav">
 <a href="#harita"><span>01</span><span data-i18n="map">Harita</span></a><a href="#sayim"><span>02</span><span data-i18n="studyNav">Lafız ve ebced</span></a><a href="#icaz"><span>03</span><span data-i18n="ijaz">İ‘câz</span></a><a href="#tevafuk"><span>04</span><span data-i18n="countingNav">Sayım ve tevafuk</span></a><a href="#kaynaklar"><span>05</span><span data-i18n="sources">Kaynaklar</span></a>
</nav>
<div class="experience-dock" role="group" data-aria="viewPreferences">
 <button type="button" id="dock-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="m12 12 5 5"/></svg><span data-i18n="find">Ara</span><kbd>/</kbd></button>
 <button type="button" data-experience-dialog="experience-saved"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h10v14l-5-3-5 3z"/></svg><span data-i18n="savedVerses">İşaretli âyetler</span></button>
 <button type="button" data-experience-dialog="experience-settings"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14"/><circle cx="7" cy="5" r="2" fill="currentColor"/><circle cx="13" cy="10" r="2" fill="currentColor"/><circle cx="7" cy="15" r="2" fill="currentColor"/></svg><span data-i18n="viewSettings">Görünüm</span></button>
</div>
<button type="button" id="immersive-close" class="immersive-close" data-aria="closeFocus" hidden>×</button>
<dialog id="experience-settings" class="experience-dialog" aria-labelledby="experience-settings-title">
 <header><h2 id="experience-settings-title" data-i18n="viewPreferences">Okuma görünümü</h2><button type="button" data-close-experience data-aria="close">×</button></header>
 <div class="experience-dialog-content">
  <fieldset><legend data-i18n="surfaceLabel">Zemin dokusu</legend><div class="surface-options">
   <button type="button" data-surface-choice="paper" aria-pressed="true"><span class="surface-swatch" aria-hidden="true"></span><span data-i18n="surfacePaper">Kâğıt</span></button>
   <button type="button" data-surface-choice="etched" aria-pressed="false"><span class="surface-swatch" aria-hidden="true"></span><span data-i18n="surfaceEtched">Gravür</span></button>
   <button type="button" data-surface-choice="plain" aria-pressed="false"><span class="surface-swatch" aria-hidden="true"></span><span data-i18n="surfacePlain">Sade</span></button>
  </div></fieldset>
  <div class="preference-row"><label for="texture-strength" data-i18n="textureStrength">Doku yoğunluğu</label><input id="texture-strength" type="range" min="0" max="100" value="45"></div>
  <div class="preference-row"><span id="motion-preference-label" data-i18n="motionLabel">Arayüz hareketleri</span><button type="button" id="motion-preference" aria-labelledby="motion-preference-label" aria-pressed="true">Açık</button></div>
  <p data-i18n="motionHint">Sisteminizdeki azaltılmış hareket tercihi gözetilir. Doku ve hareketler âyet metinlerini değiştirmez.</p>
 </div>
</dialog>
<dialog id="experience-saved" class="experience-dialog" aria-labelledby="experience-saved-title">
 <header><h2 id="experience-saved-title" data-i18n="savedVerses">İşaretli âyetler</h2><button type="button" data-close-experience data-aria="close">×</button></header>
 <div class="experience-dialog-content"><p data-i18n="savedInfo">İşaretleriniz bu tarayıcıda saklanır.</p><p id="saved-empty" data-i18n="savedEmpty">Henüz bir âyet işaretlemediniz.</p><ol id="saved-verses" class="saved-verses"></ol></div>
</dialog>
<div id="experience-toast" class="experience-toast" role="status" hidden></div>
'''
position = html.index('<script type="application/json" id="atlas-data">')
html = html[:position]+chrome+html[position:]
html = enhance(html, copy)
html = html.replace('</head>', f'<link rel="preload" href="assets/{font_names[400]}" as="font" type="font/woff2" crossorigin>\n<link rel="stylesheet" href="assets/{css_name}">\n<link rel="stylesheet" href="assets/{workbench_css_name}">\n</head>', 1)
html = html.replace('</body>', f'<script src="assets/{cosmos_name}"></script>\n<script src="assets/{js_name}"></script>\n<script src="assets/{workbench_js_name}"></script>\n</body>', 1)
font_credit = '<p class="route-cite">Satoshi © 2017–2021 Indian Type Foundry · <a href="https://www.fontshare.com/fonts/satoshi" target="_blank" rel="noopener">Fontshare</a> · <a href="licenses/SATOSHI-NOTICE.txt" target="_blank" rel="noopener">ITF</a></p>'
html, credit_count = re.subn(r'(<p><span data-i18n="creditsTranslations">[\s\S]*?</p>)', lambda match: match.group(1)+font_credit, html, count=1)
assert credit_count == 1, 'Font ownership credit must appear with design/production credits'

embedded = lambda value: dict(re.findall(r'<script type="application/json" id="([^"]+)">([\s\S]*?)</script>', value))
before, after = embedded(original), embedded(html)
assert before.keys() == after.keys()
for name in before:
    if name != 'localization-data':
        assert before[name] == after[name], name
assert [legacy_script(script) for script in re.findall(r'<script>([\s\S]*?)</script>', original)] == re.findall(r'<script>([\s\S]*?)</script>', html)
assert 'id="gorsel-okuma"' not in html
assert 'const showArtwork = art === "blue-quran" || art.startsWith("hayrat-");' in html
(STAGE / 'index.html').write_text(html)
license_dir = STAGE / 'licenses'
shutil.copy2(VENDOR / 'pixelfx/LICENSE', license_dir / 'pixelfx-LICENSE.txt')
(license_dir / 'SATOSHI-NOTICE.txt').write_text('''Satoshi
Copyright 2017-2021 Indian Type Foundry. All rights reserved.

Font metadata license notice:
This Font Software is protected under domestic and international trademark and
copyright law. You agree to identify the ITF fonts by name and credit the ITF's
ownership of the trademarks and copyrights in any design or production credits.

Source: https://www.fontshare.com/fonts/satoshi
Terms: https://fontshare.com/terms
ITF Free Font License: https://www.fontshare.com/licenses/itf-free-font-license
''')
(license_dir / 'DESIGN-SOURCES.txt').write_text('''Quran Atlas experience — implementation and reference notes

Satoshi UI font: Fontshare / Indian Type Foundry.
Source: https://www.fontshare.com/fonts/satoshi
License: https://www.fontshare.com/licenses/itf-free-font-license
Fonts are self-hosted; Arabic scripture retains the existing Amiri Quran font.

Selection ripple sprite: pixelfx water/ripples, recolored to yellow light and graphite.
https://github.com/patch-gg/pixelfx/blob/main/src/fx/water/ripples.js
Copyright 2026 Patch / Hugo Duprez. MIT; see pixelfx-LICENSE.txt.

Design studies (independent layout/geometry implementation, no copied paid assets):
https://iamtechartist.github.io/every-joule-lesson1/
https://learn-arduino-red.vercel.app/
https://reactbits.dev/tools/texture-lab
https://easings.net/
https://github.com/yihui-dev/awesome-opus5-5-videos
https://scrollshaders.com/
https://recent.design/
https://60fps.design/
https://scrolltide.co/
https://motionvideo.xyz/

Reading workbench studies (November 2026): Mobbin task/result grouping;
60fps transport controls and feedback; Spline/Three.js camera orientation;
React Bits Texture Lab Stardust/Letterpress surface and separate controls;
Scroll Shaders cached/offscreen motion and Easings state transitions.
Native DOM, SVG masks and Canvas implement the interface; no paid code,
third-party runtime or imagery was copied from these galleries.
https://mobbin.com/
https://spline.design/
https://threejs-journey.com/
https://lottiefiles.com/
https://3dicons.co/
https://coolors.co/
https://motionsites.ai/
https://landdding.com/
https://fontinlogo.com/
Land-book was requested; its public page returned HTTP 403 during review.
https://land-book.com/

All pre-existing text/translation/data licenses continue to apply.
''')
for path in STAGE.rglob('*'):
    if path.is_file() and path.suffix in {'.html', '.js', '.css', '.json', '.txt'}:
        packed = Path(str(path)+'.gz')
        packed.write_bytes(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0))
        import os
        os.utime(packed, (path.stat().st_atime, path.stat().st_mtime))
manifest = {'palette':PALETTE['id'],'mark':mark_name,'css':css_name,'js':js_name,'cosmos':cosmos_name,'workbench_css':workbench_css_name,'workbench_js':workbench_js_name,'fonts':font_names,'ripple':ripple_name,'html_sha256':hashlib.sha256(html.encode()).hexdigest()}
(ROOT / 'deployment/palette-preview-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print('Built stage:', STAGE)
print('Scripture/source datasets preserved byte-for-byte; core JavaScript differs only in Canvas colours.')
print('Assets:', json.dumps(manifest))
