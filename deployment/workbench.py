"""Ergonomic markup using the original application IDs and event handlers."""
import re


def enhance(html, copy):
    tr = copy['tr']
    def text(key):
        return f'<span data-i18n="{key}">{tr[key]}</span>'
    def article(section_id):
        match = re.search(r'<article\b[^>]*id="' + section_id + r'"[^>]*>[\s\S]*?</article>', html)
        assert match, section_id
        return match.group()

    tabs = f'''<div class="study-tabs" role="tablist" data-aria="studyJourney">
      <button id="study-tab-word" type="button" role="tab" aria-selected="true" aria-controls="lafiz-labi" data-icon="search">{text('uxWordTab')}</button>
      <button id="study-tab-abjad" type="button" role="tab" aria-selected="false" aria-controls="ebced-labi" tabindex="-1" data-icon="calculator">{text('uxAbjadTab')}</button>
    </div>'''
    target = '<article class="study-workbench" id="lafiz-labi"'
    assert html.count(target) == 1
    html = html.replace(target, tabs + '\n' + target, 1)
    html = html.replace('<p data-i18n="studyJourneyLead"></p>',
        f'<p data-i18n="uxWorkbenchLead">{tr["uxWorkbenchLead"]}</p><details class="study-context-links"><summary>{text("uxRelatedSections")}</summary><p data-i18n="studyJourneyLead"></p>', 1)
    html, count = re.subn(r'(<nav class="study-route"[\s\S]*?</nav>)', r'\1</details>', html, count=1)
    assert count == 1

    for name, old_title, new_title, lead in [('lafiz-labi', 'wordTitle', 'uxWordTitle', 'wordLead'), ('ebced-labi', 'abjadTitle', 'uxAbjadTitle', 'abjadLead')]:
        old = article(name)
        new = old.replace('data-i18n="' + old_title + '"', 'data-i18n="' + new_title + '"', 1)
        new = new.replace('aria-labelledby=', 'role="tabpanel" aria-labelledby=', 1)
        new = new.replace('aria-labelledby="' + ('word-workbench-title' if name == 'lafiz-labi' else 'abjad-workbench-title') + '"',
                          'aria-labelledby="study-tab-' + ('word' if name == 'lafiz-labi' else 'abjad') + '"', 1)
        if name == 'ebced-labi':
            new = new.replace('role="tabpanel"', 'role="tabpanel" hidden', 1)
        new = new.replace('<p data-i18n="' + lead + '"></p>', '', 1)
        source = re.search(r'<p class="route-cite">[\s\S]*?</p>', new)
        assert source, name
        method = f'<details class="study-method"><summary>{text("uxMethod")}</summary><p data-i18n="{lead}"></p>' + source.group() + '</details>'
        new = new[:source.start()] + method + new[source.end():]
        if name == 'lafiz-labi':
            new = new.replace('<div class="study-options"', f'<p class="study-label">{text("uxChooseTerm")}</p><div class="study-options"', 1)
            rules = re.search(r'<div id="word-rules"[\s\S]*?<p id="word-rule-note"[^>]*></p>', new)
            assert rules
            new = new[:rules.start()] + f'<details class="study-rule-options"><summary>{text("uxCountOptions")}<small id="study-current-rule"></small></summary><div>' + rules.group() + '</div></details>' + new[rules.end():]
        else:
            form = re.search(r'<form id="abjad-form"[\s\S]*?</form>', new)
            assert form
            new = new.replace(form.group(), '', 1)
            new = new.replace('<div class="study-scope">', form.group() + '\n<div class="study-scope">', 1)
            new = new.replace('<div class="study-options"', f'<p class="study-label">{text("uxChooseExpression")}</p><div class="study-options"', 1)
        new = re.sub(r'(?m)^[\t ]+$', '', new)
        html = html.replace(old, new, 1)

    # Keep the reader and its one audio element intact; group tasks into two tabs.
    match = re.search(r'<aside class="reader"[\s\S]*?</aside>', html)
    assert match
    reader = match.group()
    start = reader.index('<div class="verse-selectors">')
    audio = reader.index('<div id="audio-wrap"')
    save = reader.index('<div class="reader-save">')
    related = reader.index('<div class="relation-head">')
    count = '<span id="relation-count"></span>'
    assert count in reader
    reader_tabs = f'''<div class="reader-tabs" role="tablist" data-aria="reader">
      <button id="reader-tab-verse" type="button" role="tab" aria-selected="true" aria-controls="reader-pane" data-icon="book">{text('uxVersePanel')}</button>
      <button id="reader-tab-links" type="button" role="tab" aria-selected="false" aria-controls="reader-connections" tabindex="-1" data-icon="network">{text('connections')}{count}</button>
    </div>'''
    new_reader = reader[:start] + reader_tabs + reader[audio:save]
    new_reader += '<div id="reader-pane" role="tabpanel" aria-labelledby="reader-tab-verse">' + reader[start:audio] + reader[save:related] + '</div>'
    new_reader += '<div id="reader-connections" role="tabpanel" aria-labelledby="reader-tab-links" hidden>' + reader[related:reader.rindex('</aside>')].replace(count, '', 1) + '</div></aside>'
    html = html[:match.start()] + new_reader + html[match.end():]

    camera = f'''<div class="atlas-view-tools" role="group" data-aria="uxCamera">
      <button id="atlas-depth" type="button" aria-pressed="true" data-icon="layers" data-i18n="depthView">{tr['depthView']}</button>
      <button id="atlas-camera-toggle" type="button" aria-expanded="false" aria-controls="atlas-camera-panel" data-icon="settings">{text('uxCamera')}</button>
      <button id="atlas-expand" type="button" aria-pressed="false" data-icon="fit" data-i18n="openFocus">{tr['openFocus']}</button>
    </div>
    <section class="atlas-camera-panel" id="atlas-camera-panel" data-aria="uxCamera" hidden>
      <label>{text('uxAzimuth')}<output id="camera-yaw-value">−28°</output><input id="camera-yaw" type="range" min="-180" max="180" value="-28"></label>
      <label>{text('uxTilt')}<output id="camera-tilt-value">47°</output><input id="camera-tilt" type="range" min="20" max="70" value="47"></label>
      <label>{text('uxDepth')}<output id="camera-depth-value">40%</output><input id="camera-depth" type="range" min="0" max="100" value="40"></label>
      <div><p data-i18n="uxCameraHelp">{tr['uxCameraHelp']}</p><button id="camera-reset" type="button" data-icon="rotate">{text('uxResetView')}</button></div>
    </section>'''
    html, count = re.subn(r'<div class="atlas-actions">[\s\S]*?</div>', '', html, count=1)
    assert count == 1
    marker = '<div class="map-viz" id="map-viz"'
    assert html.count(marker) == 1
    html = html.replace(marker, camera + '\n' + marker, 1)

    # The verse card remains the existing detail route and export source.
    listen = f'''<section class="card-listening" data-aria="recitation">
      <label>{text('reciter')}<select id="card-reciter"></select></label>
      <label>{text('listenSpeed')}<select id="card-speed"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option></select></label>
      <audio id="card-recitation" controls preload="none" data-aria="recitation"></audio>
      <p id="card-audio-error" role="status" hidden>{text('audioError')} <a id="card-audio-source" target="_blank" rel="noopener">{text('audioLink')}</a></p>
    </section>'''
    html = html.replace('<div id="verse-plate-body"></div>', listen + '<div id="verse-plate-body"></div>', 1)
    html = html.replace('<button id="verse-plate-word-abjad"', f'<button id="verse-plate-open-map" type="button" data-icon="network">{text("uxOpenInAtlas")}</button><button id="verse-plate-word-abjad"', 1)
    return html
