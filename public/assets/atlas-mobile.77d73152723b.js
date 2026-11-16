/* Phone/tablet task views around the unchanged reading engine. */
(() => {
  'use strict';
  const get=id=>document.getElementById(id);
  const compact=matchMedia('(max-width:1024px), (pointer:coarse) and (hover:none)');
  const main=document.querySelector('main');
  const screens={atlas:document.querySelector('.cosmic-workspace'),study:get('sayim'),guide:get('icaz'),pages:get('tevafuk'),sources:get('kaynaklar'),library:get('kutuphane')};
  const titles={read:'mReadTitle',map:'instrumentLabel',study:'mStudyTitle',guide:'studyRoute',pages:'husrevTitle',sources:'sources',library:'library'};
  const hashes={read:()=> '#ayet-'+verses[state.id][0].replace(':','-'),map:()=> '#harita',study:()=> '#sayim',guide:()=> '#icaz',pages:()=> '#husrev',sources:()=> '#kaynaklar',library:()=> '#kutuphane'};
  const movements=new Map(),groups=new Map(),initialOpen=new Map();
  const scrollPositions=new Map();
  const mobileDialogs=[get('mobile-menu'),get('mobile-search'),get('mobile-tools')];
  const allDialogs=Array.from(document.querySelectorAll('dialog'));
  let enabled=false,view='read',searchView='read',selectionTarget=null,syncFrame=0;
  let scrollLock=null,previousScrollRestoration='auto';
  let viewportFrame=0,viewportTimer=0,viewportMetrics=null,anchorTimer=0;
  let readingAnchor=null,pendingAnchor=null,inputVersion=0,activatedBefore=false;
  const viewportElements=new Set(),viewportHeights=new Map();
  const text=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
  const attr=(node,key,value)=>{if(node&&node.getAttribute(key)!==String(value))node.setAttribute(key,String(value));};
  const iconButton=(label,icon,fn)=>{const b=action(label,fn);b.dataset.icon=icon;return b;};
  function move(node,parent,before=null) {
    if(!node||!parent)return;
    if(!movements.has(node)){const marker=document.createComment('compact-origin');node.before(marker);movements.set(node,marker);}
    if(node.parentNode!==parent||before)parent.insertBefore(node,before);
  }
  function restore(node) {
    const marker=movements.get(node);if(!marker)return;
    if(marker.isConnected)marker.replaceWith(node);
    movements.delete(node);
  }
  function disclosure(nodes,key,name,parent,className='') {
    nodes=nodes.filter(Boolean);if(!nodes.length)return;
    for(const [d,g]of groups)if(!d.isConnected){for(const n of g.nodes)movements.delete(n);groups.delete(d);}
    if(nodes.every(n=>n.closest('.mobile-generated-details')))return;
    const existing=[...groups.keys()].find(d=>d.dataset.mobileGroup===name&&d.isConnected);
    if(existing)return;
    const d=document.createElement('details');d.className='mobile-disclosure mobile-generated-details '+className;d.dataset.mobileGroup=name;
    const summary=document.createElement('summary');summary.dataset.i18n=key;summary.textContent=t(key);
    const content=document.createElement('div');d.append(summary,content);parent.append(d);
    nodes.forEach(n=>move(n,content));groups.set(d,{nodes});
  }
  function closeInitially(node) {
    if(!node||initialOpen.has(node))return;
    initialOpen.set(node,node.open);node.open=false;
  }
  function rememberView(write=false,hash=null) {
    const next=hash||hashes[view]();
    const data={...(history.state||{}),atlasMobile:view};
    if(write&&location.hash!==next)history.pushState(data,'',next);
    else history.replaceState(data,'',location.href);
  }
  function screenForHash(hash) {
    if(/^#(?:ayet|gorsel)-\d+-\d+$/.test(hash))return 'read';
    if(['#harita','#gorsel-okuma'].includes(hash))return 'map';
    if(['#sayim','#lafiz-labi','#ebced-labi'].includes(hash))return 'study';
    if(hash==='#icaz')return 'guide';
    if(['#husrev','#tevafuk','#page-lab','#ayet-sayimi'].includes(hash))return 'pages';
    if(hash==='#kaynaklar')return 'sources';
    if(hash==='#kutuphane')return 'library';
    if(hash==='#ust'||!hash)return 'read';
    return null;
  }
  function currentScroll(){return scrollLock?.y??window.scrollY;}
  function scrollToPosition(y){
    if(scrollLock){scrollLock.y=y;document.body.style.setProperty('--mobile-scroll-offset',-y+'px');}
    else window.scrollTo({top:y,behavior:'instant'});
  }
  function syncScrollLock(){
    const lock=enabled&&(allDialogs.some(d=>d.open)||expanded());
    if(lock&&!scrollLock){
      scrollLock={y:window.scrollY,x:window.scrollX};
      document.body.style.setProperty('--mobile-scroll-offset',-scrollLock.y+'px');
      document.body.classList.add('mobile-scroll-locked');
    }else if(!lock&&scrollLock){
      const position=scrollLock;scrollLock=null;
      document.body.classList.remove('mobile-scroll-locked');document.body.style.removeProperty('--mobile-scroll-offset');
      window.scrollTo({top:position.y,left:position.x,behavior:'instant'});
    }
    syncDialogViewport();
  }
  function textEntry(){return document.activeElement?.matches('textarea,input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit])');}
  function headerBottom(){return Math.max(0,document.querySelector('.site-header').getBoundingClientRect().bottom);}
  function captureAnchor(){
    if(!enabled||expanded()||allDialogs.some(d=>d.open)||textEntry())return;
    const x=innerWidth/2,y=headerBottom()+24;
    const hit=document.elementFromPoint(x,y);
    const node=hit?.closest('.word-result,.arabic,.translation-text,.guide-quote,.library-card,.study-results,.reader');
    if(!node)return;
    // Keep a text position through reflow, including inside a long Arabic verse.
    let range=document.caretRangeFromPoint?.(x,y);
    if(!range&&document.caretPositionFromPoint){const caret=document.caretPositionFromPoint(x,y);if(caret){range=document.createRange();range.setStart(caret.offsetNode,caret.offset);range.collapse(true);}}
    if(range?.startContainer.nodeType===Node.TEXT_NODE&&node.contains(range.startContainer)){
      range.setEnd(range.startContainer,Math.min(range.startOffset+1,range.startContainer.length));
    }else range=null;
    const rect=range?.getBoundingClientRect()||node.getBoundingClientRect();
    readingAnchor={node,range,offset:rect.top-headerBottom(),view,width:innerWidth};
  }
  function restoreWidthAnchor(){
    const anchor=pendingAnchor;pendingAnchor=null;
    if(!anchor||!enabled||anchor.view!==view||anchor.inputVersion!==inputVersion||!anchor.node.isConnected||expanded()||textEntry())return;
    if(!anchor.node.getClientRects().length)return;
    const rect=anchor.range?.getBoundingClientRect()||anchor.node.getBoundingClientRect();
    scrollToPosition(Math.max(0,currentScroll()+rect.top-headerBottom()-anchor.offset));
    captureAnchor();
  }
  addEventListener('scroll',()=>{
    if(!enabled||scrollLock)return;
    clearTimeout(anchorTimer);anchorTimer=setTimeout(captureAnchor,120);
  },{passive:true});
  for(const type of ['pointerdown','wheel'])document.addEventListener(type,()=>{inputVersion++;},{capture:true,passive:true});
  function clearViewportElement(node){
    node.classList.remove('mobile-viewport-fit','mobile-keyboard-fit');
    for(const key of ['height','top','bottom'])node.style.removeProperty('--mobile-view-'+key);
    viewportElements.delete(node);
  }
  function syncDialogViewport(settled=true){
    if(!enabled){
      for(const node of [...viewportElements])clearViewportElement(node);
      document.body.classList.remove('mobile-keyboard','mobile-viewport-short');
      get('mobile-nav').style.removeProperty('--mobile-nav-offset');return;
    }
    const viewport=window.visualViewport;
    // Page pinch zoom belongs to the browser; never reinterpret it as a keyboard.
    if(viewport&&Math.abs(viewport.scale-1)>.05)return;
    const width=innerWidth,height=Math.max(1,Math.round(viewport?.height||innerHeight));
    const top=Math.max(0,Math.round(viewport?.offsetTop||0));
    const bottom=Math.max(0,innerHeight-height-top),typing=textEntry();
    const maximum=Math.max(viewportHeights.get(width)||innerHeight,typing?innerHeight:height);
    viewportHeights.set(width,maximum);
    const keyboard=Boolean(typing&&(innerHeight-height>120||maximum-height>Math.max(140,maximum*.2)));
    const widthChanged=viewportMetrics&&Math.abs(viewportMetrics.width-width)>1;
    if(widthChanged){
      if(readingAnchor?.width!==width)pendingAnchor=readingAnchor?{...readingAnchor,inputVersion}:null;
      clearMapTouches();
    }
    const interacting=mapTouches.size>0;
    if(document.body.classList.contains('mobile-keyboard')!==keyboard)document.body.classList.toggle('mobile-keyboard',keyboard);
    if(document.body.classList.contains('mobile-viewport-short')!==(height<500))document.body.classList.toggle('mobile-viewport-short',height<500);
    const offset=-bottom+'px',nav=get('mobile-nav');
    if(nav.style.getPropertyValue('--mobile-nav-offset')!==offset)nav.style.setProperty('--mobile-nav-offset',offset);
    const overlays=allDialogs.filter(d=>d.open);
    if(expanded())overlays.push(document.querySelector('.atlas-grid'));
    for(const node of [...viewportElements])if(!overlays.includes(node))clearViewportElement(node);
    for(const node of overlays){
      if(!node.classList.contains('mobile-viewport-fit'))node.classList.add('mobile-viewport-fit');
      node.classList.toggle('mobile-keyboard-fit',keyboard);
      for(const [key,value]of [['height',height+'px'],['top',top+'px'],['bottom',bottom+'px']]){
        if(node.style.getPropertyValue('--mobile-view-'+key)!==value)node.style.setProperty('--mobile-view-'+key,value);
      }
      viewportElements.add(node);
    }
    const footer=get('comparison').querySelector('.dialog-footer'),scroll=get('comparison-scroll');
    if(height<500&&get('comparison').open){if(footer.parentNode!==scroll)move(footer,scroll,scroll.firstChild);}
    else restore(footer);
    viewportMetrics={width,height,top,keyboard};
    if(settled&&!interacting)restoreWidthAnchor();
  }
  function scheduleViewport(){
    if(!enabled)return;
    if(!viewportFrame)viewportFrame=requestAnimationFrame(()=>{viewportFrame=0;syncDialogViewport(false);});
    clearTimeout(viewportTimer);viewportTimer=setTimeout(()=>{viewportTimer=0;syncDialogViewport(true);},120);
  }
  window.visualViewport?.addEventListener('resize',scheduleViewport,{passive:true});
  window.visualViewport?.addEventListener('scroll',()=>{if(scrollLock||textEntry())scheduleViewport();},{passive:true});
  addEventListener('resize',scheduleViewport,{passive:true});
  addEventListener('pageshow',()=>{if(enabled){syncScrollLock();scheduleViewport();}});
  document.addEventListener('focusin',scheduleViewport);document.addEventListener('focusout',scheduleViewport);
  const lockWatcher=new MutationObserver(syncScrollLock);
  allDialogs.forEach(d=>lockWatcher.observe(d,{attributes:true,attributeFilter:['open']}));
  lockWatcher.observe(document.querySelector('.atlas-grid'),{attributes:true,attributeFilter:['class']});
  function navigate(next,{write=true,hash=null,scroll=true,reset=false}={}) {
    if(!enabled)return;
    const changing=next!==view;
    if(changing)scrollPositions.set(view,currentScroll());
    for(const d of mobileDialogs)if(d.open)d.close();
    if(document.querySelector('.atlas-immersive')&&next!=='map')get('immersive-close').click();
    view=next;document.body.dataset.mobileView=view;
    text(get('mobile-page-title'),t(titles[view]));
    text(get('mobile-page-hint'),view==='read'?t('mReadHint'):'');get('mobile-page-hint').hidden=view!=='read';
    document.querySelectorAll('[data-mobile-nav]').forEach(b=>{
      if(b.dataset.mobileNav===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    });
    if(['read','map','study'].includes(view))get('mobile-menu-open').removeAttribute('aria-current');
    else get('mobile-menu-open').setAttribute('aria-current','page');
    if(hash==='#ebced-labi')get('study-tab-abjad').click();
    if(hash==='#lafiz-labi')get('study-tab-word').click();
    if(hash==='#page-lab'||hash==='#ayet-sayimi'){
      const group=[...groups.keys()].find(d=>d.dataset.mobileGroup==='other-counts');if(group)group.open=true;
    }
    rememberView(write,hash);
    if(scroll&&(changing||reset))scrollToPosition(reset?0:(scrollPositions.get(view)||0));
    requestAnimationFrame(()=>{if(!enabled)return;if(view==='map'){limitAtlasPan();updateMap();}captureAnchor();});
    scheduleSync();
  }
  function openSheet(id,opener=document.activeElement) {
    const dialog=get(id);dialog._mobileOpener=opener;
    if(!dialog.open)dialog.showModal();
    syncScrollLock();
  }
  function openSearch(target='read') {
    searchView=target;
    move(get('search-form'),get('mobile-search-slot'));
    get('search-query').value='';get('search-results').hidden=true;
    renderSurahs();openSheet('mobile-search');
    // Keep the full chapter list visible until the user asks for the keyboard.
  }
  function renderSurahs() {
    if(!enabled)return;
    const query=get('search-query').value.trim().toLocaleLowerCase(locale);
    const entries=surahs.map((s,i)=>({i,title:surahTitle(i),count:s[3]})).filter(({i,title})=>!query||title.toLocaleLowerCase(locale).includes(query)||String(i+1)===query);
    const list=get('mobile-surah-list');list.replaceChildren(...entries.map(({i,title,count})=>{
      const b=action('',()=>selectVerse(searchView==='map'?representative(i):surahs[i][2]));
      const name=document.createElement('span');name.textContent=format.format(i+1)+' · '+title;
      const n=document.createElement('small');n.textContent=t('verseCount',{k:format.format(count)});b.append(name,n);return b;
    }));
    list.hidden=!entries.length;list.previousElementSibling.hidden=!entries.length;
  }
  function openTools() {
    const sourceActions=document.querySelector('.reader-links');
    const buttons=get('mobile-verse-actions');buttons.replaceChildren();
    const proxies=[
      [sourceActions?.querySelector('button:nth-child(2)'),'compare'],
      [sourceActions?.querySelector('.reader-plate'),'book'],
      [sourceActions?.querySelector('a'),'source']
    ];
    for(const [source,icon]of proxies)if(source){
      if(source.tagName==='A'){const a=source.cloneNode(true);a.dataset.icon=icon;buttons.append(a);}
      else buttons.append(iconButton(source.textContent,icon,()=>{get('mobile-tools').close();source.click();}));
    }
    text(get('mobile-tool-reference'),label(state.id));
    move(document.querySelector('.reader .reading-options'),get('mobile-reading-settings'));
    move(document.querySelector('.audio-settings'),get('mobile-reading-settings'));
    get('mobile-translation-source').replaceChildren(...Array.from(document.querySelectorAll('#reading .translation-credit')).map(n=>n.cloneNode(true)));
    openSheet('mobile-tools');
  }
  for(const dialog of mobileDialogs){
    dialog.querySelector('[data-mobile-close]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();
      if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
    });
    dialog.addEventListener('close',()=>{
      if(dialog.id==='mobile-search')restore(get('search-form'));
      if(dialog.id==='mobile-tools'){
        restore(get('edition-select').closest('.reading-options'));restore(get('listen-mode').closest('.audio-settings'));
      }
      const opener=dialog._mobileOpener;if(opener?.isConnected&&opener.getClientRects().length)opener.focus({preventScroll:true});
    });
  }
  document.querySelectorAll('[data-mobile-nav]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.mobileNav)));
  get('mobile-menu-open').addEventListener('click',()=>openSheet('mobile-menu'));
  document.querySelectorAll('[data-mobile-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.mobileGo)));
  document.querySelectorAll('[data-mobile-dialog]').forEach(b=>b.addEventListener('click',()=>{
    get('mobile-menu').close();document.querySelector('[data-experience-dialog="'+b.dataset.mobileDialog+'"]').click();
  }));
  get('mobile-search-trigger').addEventListener('click',()=>openSearch(view==='map'?'map':'read'));
  get('mobile-pick-surah').addEventListener('click',()=>openSearch('map'));
  get('search-query').addEventListener('input',()=>{if(enabled&&get('mobile-search').open)renderSurahs();});
  get('mobile-open-verse').addEventListener('click',()=>navigate('read'));
  get('mobile-start-fatiha').addEventListener('click',()=>{selectVerse(0);navigate('read');});
  document.addEventListener('click',event=>{
    if(!enabled||event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const target=event.target.closest('#verse-plate-open-map,.jump,.husrev-sample button,#go-related');
    if(target){
      selectionTarget=target.matches('#verse-plate-open-map,.jump,.husrev-sample button')?'map':'read';
      // A native click can run microtasks between capture and target listeners.
      // Keep its destination until the original action has selected the verse.
      setTimeout(()=>{selectionTarget=null;},0);
    }
    const a=event.target.closest('a[href^="#"]');if(!a||a.getAttribute('href')==='#')return;
    const screen=screenForHash(a.hash);if(!screen)return;
    event.preventDefault();navigate(screen,{hash:a.hash});
  },true);
  get('dock-search').addEventListener('click',event=>{
    if(!enabled)return;event.preventDefault();event.stopImmediatePropagation();openSearch(view==='map'?'map':'read');
  },true);
  function routeFromLocation() {
    if(!enabled)return;
    const next=history.state?.atlasMobile||screenForHash(location.hash);
    if(next)navigate(next,{write:false,hash:location.hash});
  }
  addEventListener('popstate',routeFromLocation);addEventListener('hashchange',routeFromLocation);

  // Embedded maps allow normal page scrolling; only expanded maps consume drag.
  const baseLimitPan=limitAtlasPan,basePan=panAtlas,baseNearest=nearest;
  const baseCenterMapLabel=centerMapLabel;
  function expanded(){return enabled&&document.querySelector('.atlas-immersive')!==null;}
  centerMapLabel=center=>{
    if(!enabled)return baseCenterMapLabel(center);
    const transform=`translate3d(${center.x+atlasView.x}px,${center.y+atlasView.y}px,0) translate(-50%,-50%)`;
    const node=get('map-center');if(node.style.transform!==transform)node.style.transform=transform;
  };
  limitAtlasPan=()=>{
    if(!expanded())return baseLimitPan();
    const margin=Math.max(.22,(atlasView.scale-1)/2);
    atlasView.x=bound(atlasView.x,-mapViz.clientWidth*margin,mapViz.clientWidth*margin);
    atlasView.y=bound(atlasView.y,-mapViz.clientHeight*margin,mapViz.clientHeight*margin);
  };
  panAtlas=(dx,dy)=>{
    if(!expanded())return basePan(dx,dy);
    atlasView.x+=dx;atlasView.y+=dy;limitAtlasPan();hideHover();scheduleMapDraw();
  };
  nearest=event=>{
    if(!enabled)return baseNearest(event);
    const point=mapWorld(mapCoordinates(event));let selected=null,distance=26/atlasView.scale;
    for(const node of optionsOnMap){const d=Math.hypot(point.x-node.x,point.y-node.y);if(d<distance){selected=node;distance=d;}}
    return selected||baseNearest(event);
  };
  // A single owner handles touch gestures. Embedded maps leave scrolling and
  // page zoom to Safari; expanded maps apply the latest pointer positions once
  // per frame. Rebase when fingers join/leave to avoid a pan/pinch jump.
  const mapTouches=new Map();
  let gestureStart=null,gestureFrame=0,gestureMoved=false,mapBounds=null;
  function touchSnapshot(){
    const points=Array.from(mapTouches.values());
    if(!points.length)return null;
    const a=points[0],b=points[1]||a;
    return {count:points.length,x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),view:{...atlasView}};
  }
  function paintGesture(){
    gestureFrame=0;
    if(!gestureStart||!expanded()||!mapTouches.size)return;
    const point=touchSnapshot(),start=gestureStart;
    if(point.count!==start.count)return;
    const moved=Math.hypot(point.x-start.x,point.y-start.y)>7||point.count>1;
    if(!gestureMoved&&!moved)return;
    gestureMoved=true;suppressMapClick=true;
    document.body.classList.add('mobile-interacting');
    const scale=point.count>1?bound(start.view.scale*point.distance/start.distance,MIN_ZOOM,MAX_ZOOM):start.view.scale;
    const factor=scale/start.view.scale,cx=mapBounds.width/2,cy=mapBounds.height/2;
    atlasView.x=point.x-cx-(start.x-cx-start.view.x)*factor;
    atlasView.y=point.y-cy-(start.y-cy-start.view.y)*factor;
    const zoomed=atlasView.scale!==scale;atlasView.scale=scale;limitAtlasPan();hideHover();
    if(zoomed)updateAtlasToolbar();
    draw();
  }
  function flushGesture(){if(gestureFrame){cancelAnimationFrame(gestureFrame);gestureFrame=0;paintGesture();}}
  function clearMapTouches(){
    if(gestureFrame)cancelAnimationFrame(gestureFrame);gestureFrame=0;
    if(mapTouches.size)suppressMapClick=true;
    for(const id of mapTouches.keys())if(graph.hasPointerCapture(id))graph.releasePointerCapture(id);
    mapTouches.clear();gestureStart=null;mapBounds=null;
    document.body.classList.remove('mobile-interacting');
    if(enabled)scheduleViewport();
  }
  function touchPoint(event){return {x:event.clientX-mapBounds.left,y:event.clientY-mapBounds.top};}
  new ResizeObserver(()=>{
    if(!enabled||!mapTouches.size||!mapBounds)return;
    const next=graph.getBoundingClientRect();
    if(Math.abs(next.width-mapBounds.width)>1){clearMapTouches();return;}
    flushGesture();
    for(const point of mapTouches.values()){
      point.x+=mapBounds.left-next.left;point.y+=mapBounds.top-next.top;
    }
    mapBounds=next;gestureStart=touchSnapshot();
  }).observe(graph);
  graph.addEventListener('pointerdown',event=>{
    if(!enabled||event.pointerType==='mouse')return;
    event.stopImmediatePropagation();
    if(!expanded()){suppressMapClick=false;return;}
    if(mapTouches.size>=2)return;
    flushGesture();
    if(!mapTouches.size){mapBounds=graph.getBoundingClientRect();gestureMoved=false;suppressMapClick=false;}
    mapTouches.set(event.pointerId,touchPoint(event));
    graph.setPointerCapture(event.pointerId);gestureStart=touchSnapshot();
    if(mapTouches.size>1){gestureMoved=true;suppressMapClick=true;hideHover();}
  },true);
  graph.addEventListener('pointermove',event=>{
    if(!enabled||event.pointerType==='mouse')return;
    event.stopImmediatePropagation();
    if(!expanded()||!mapTouches.has(event.pointerId))return;
    mapTouches.set(event.pointerId,touchPoint(event));
    if(!gestureFrame)gestureFrame=requestAnimationFrame(paintGesture);
  },true);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])graph.addEventListener(type,event=>{
    if(!enabled||event.pointerType==='mouse')return;
    event.stopImmediatePropagation();
    if(!mapTouches.has(event.pointerId))return;
    if(type==='pointercancel'){suppressMapClick=true;clearMapTouches();return;}
    flushGesture();mapTouches.delete(event.pointerId);
    if(mapTouches.size)gestureStart=touchSnapshot();else clearMapTouches();
  },true);
  addEventListener('blur',clearMapTouches);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearMapTouches();});
  get('atlas-expand').addEventListener('click',()=>{
    if(!enabled)return;
    get('atlas-camera-panel').hidden=true;attr(get('atlas-camera-toggle'),'aria-expanded',false);
    syncMap();
  });
  get('immersive-close').addEventListener('click',()=>{if(enabled){clearMapTouches();syncMap();}});
  const baseDrawHusrev=drawHusrevViewport,scanFrames=new Map();
  drawHusrevViewport=pane=>{
    if(!enabled)return baseDrawHusrev(pane);
    if(scanFrames.has(pane))return;
    scanFrames.set(pane,requestAnimationFrame(()=>{scanFrames.delete(pane);baseDrawHusrev(pane);}));
  };
  for(const pane of husrevState.panes){
    for(const type of ['pointerdown','pointermove'])pane.viewport.addEventListener(type,event=>{
      if(enabled&&event.pointerType!=='mouse'&&!get('husrev-dialog').open)event.stopImmediatePropagation();
    },true);
    pane.viewport.addEventListener('lostpointercapture',event=>{
      // Transfer implicit touch capture from the image to its viewport without
      // discarding the active finger in the original pinch/pan handler.
      if(enabled&&event.target!==pane.viewport&&pane.viewport.hasPointerCapture(event.pointerId))event.stopPropagation();
    },true);
  }
  function syncMap() {
    const full=expanded();
    text(get('mobile-map-hint'),t(full?'mMapActive':'mMapHint'));
    text(get('mobile-map-reference'),label(state.id));text(get('mobile-map-count'),get('map-status').textContent);
    text(get('atlas-expand'),t(full?'mMapExit':'mFullscreen'));
    get('atlas-camera-toggle').title=t('uxCamera');
    get('map-fit').title=t('zoomFit');
  }
  document.querySelectorAll('button[data-mobile-page]').forEach(b=>b.addEventListener('click',()=>{
    get('husrev-studio').dataset.mobilePage=b.dataset.mobilePage;
    document.querySelectorAll('button[data-mobile-page]').forEach(other=>attr(other,'aria-pressed',other===b));
    dispatchEvent(new Event('resize'));
  }));
  get('mobile-guide-route').addEventListener('change',event=>updateGuide(Number(event.target.value),false,false,0));
  get('mobile-guide-scene').addEventListener('change',event=>updateGuide(guideIndex,false,false,Number(event.target.value)));
  get('mobile-husrev-preset').addEventListener('change',event=>document.querySelectorAll('#husrev-presets button')[Number(event.target.value)]?.click());
  function syncGuide() {
    const route=get('mobile-guide-route'),scene=get('mobile-guide-scene');
    const names=GUIDE.map((g,i)=>format.format(i+1)+' · '+t(g.name+'Title'));
    if(route.options.length!==names.length||[...route.options].some((o,i)=>o.text!==names[i]))route.replaceChildren(...names.map((s,i)=>new Option(s,String(i))));
    route.value=String(guideIndex);
    const choices=Array.from(document.querySelectorAll('#guide-reading .scene-button')).map(b=>b.textContent.trim());
    if(scene.options.length!==choices.length||[...scene.options].some((o,i)=>o.text!==choices[i]))scene.replaceChildren(...choices.map((s,i)=>new Option(s,String(i))));
    scene.value=String(guideDetail);
    const intro=document.querySelector('.guide-intro');
    if(intro)disclosure(Array.from(intro.children).filter(n=>n.tagName==='P'),'mExplanation','guide-intro',intro);
  }
  function comparisonTab(pane,focus=false) {
    const dialog=get('comparison');
    if(pane!=='a'&&pairing?.ids[1]===null)pane='a';
    dialog.dataset.mobileCompare=pane;
    document.querySelectorAll('button[data-mobile-compare]').forEach(b=>{const on=b.dataset.mobileCompare===pane;attr(b,'aria-selected',on);b.tabIndex=on?0:-1;if(on&&focus)b.focus({preventScroll:true});});
    get('comparison-scroll').scrollTop=0;
  }
  document.querySelectorAll('button[data-mobile-compare]').forEach((b,i)=>{
    b.addEventListener('click',()=>comparisonTab(b.dataset.mobileCompare));
    b.addEventListener('keydown',event=>{
      const tabs=Array.from(document.querySelectorAll('button[data-mobile-compare]'));
      let next;if(event.key==='ArrowRight')next=(i+1)%tabs.length;else if(event.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;
      event.preventDefault();comparisonTab(tabs[next].dataset.mobileCompare,true);
    });
  });
  for(const [id,pane]of [['compare-jump-a','a'],['compare-jump-b','b'],['compare-jump-evidence','evidence']])get(id).addEventListener('click',()=>{if(enabled)comparisonTab(pane);},true);
  get('comparison-audio').addEventListener('play',()=>{if(enabled)comparisonTab(listenQueue[queuePosition]===1?'b':'a');});
  const originalComparison=openComparison;
  openComparison=(...args)=>{if(enabled)get('comparison').dataset.mobileCompare='a';return originalComparison(...args);};
  const originalTarget=chooseComparisonTarget;
  chooseComparisonTarget=(...args)=>{const value=originalTarget(...args);if(enabled)comparisonTab('b');return value;};
  function syncDetails() {
    const wordSplit=get('lafiz-labi').querySelector('.study-split');
    disclosure([wordSplit.querySelector('.study-query')],'mSearchOptions','word-query',wordSplit,'mobile-word-query');
    const wordQuery=[...groups.keys()].find(d=>d.dataset.mobileGroup==='word-query');
    if(wordQuery){
      const results=wordSplit.querySelector('.study-results');if(wordQuery.nextElementSibling!==results)wordSplit.insertBefore(wordQuery,results);
      const summary=wordQuery.querySelector('summary');
      if(summary.dataset.i18n){
        delete summary.dataset.i18n;summary.replaceChildren();const title=document.createElement('span');title.dataset.i18n='mSearchOptions';title.textContent=t('mSearchOptions');const value=document.createElement('small');summary.append(title,value);
      }
      const selected=document.querySelector('#lafiz-labi .study-options button[aria-pressed=true]');
      let scope=get('word-scope').selectedOptions[0]?.textContent||'';
      if(get('word-scope').value==='surah')scope=surahTitle(Number(get('word-surah').value));
      if(get('word-scope').value==='verse')scope=label(state.id);
      if(get('word-scope').value==='page')scope+=' '+format.format(Number(get('word-page').value));
      text(summary.querySelector('small'),(selected?.textContent||t('uxWordTab'))+' · '+scope);
      if(!wordQuery.querySelector('.mobile-query-done')){
        const done=action(t('mShowResults'),()=>{wordQuery.open=false;get('word-result-total').scrollIntoView({behavior:'instant',block:'start'});});done.className='mobile-query-done';done.dataset.i18n='mShowResults';wordQuery.lastElementChild.append(done);
      }
    }
    const pane=get('ebced-labi');
    disclosure([pane.querySelector('.study-scope')],'mPageOptions','abjad-options',pane.querySelector('.study-query'));
    disclosure([get('layers')],'layers','map-layers',document.querySelector('.map-footer'),'mobile-layer-details');
    disclosure([document.querySelector('.husrev-options'),get('husrev-example-note'),document.querySelector('.husrev-intro .route-cite')],'mPageOptions','page-options',document.querySelector('.husrev-cases'));
    disclosure([get('ayet-sayimi'),get('page-lab'),...document.querySelectorAll('#tevafuk>.route-cite')],'mOtherCounts','other-counts',get('tevafuk'));
    disclosure([get('icaz').querySelector('.essay-intro'),get('essays-more')],'mExplanation','extra-readings',get('icaz').querySelector('.wrap'));
    const presets=Array.from(document.querySelectorAll('#husrev-presets button'));
    const presetSelect=get('mobile-husrev-preset');
    if(presetSelect.options.length!==presets.length||[...presetSelect.options].some((o,i)=>o.text!==presets[i].textContent))presetSelect.replaceChildren(...presets.map((b,i)=>new Option(b.textContent,String(i))));
    presetSelect.value=String(Math.max(0,presets.findIndex(b=>b.getAttribute('aria-pressed')==='true')));
    document.querySelectorAll('.husrev-points').forEach(closeInitially);
    for(const side of ['A','B']){
      const field=document.querySelector('.husrev-plate[data-side="'+side+'"] .husrev-page-number');
      text(document.querySelector('button[data-mobile-page="'+side+'"]'),t(side==='A'?'mPageA':'mPageB')+(field?' · '+format.format(Number(field.value)):''));
    }
    const paper=document.querySelector('.verse-plate-paper');
    if(paper)disclosure([...paper.children].filter(n=>n.matches('.guide-figure,.abjad-metrics,.verse-plate-rhythm')),'mCardDetails','card-details',paper);
    if(get('comparison').open){
      if(!get('comparison').dataset.mobileCompare)get('comparison').dataset.mobileCompare='a';
      disclosure([get('comparison-form')],'mChooseOther','comparison-query',get('comparison-scroll'));
      for(const side of ['a','b']){
        const card=get('compare-card-'+side);if(card){
          disclosure([card.querySelector('.compare-verse-settings')],'mOptions','comparison-settings-'+side,card);
          attr(card,'role','tabpanel');attr(card,'aria-labelledby','mobile-compare-tab-'+side);
        }
        const button=document.querySelector('button[data-mobile-compare="'+side+'"]');button.id='mobile-compare-tab-'+side;
        text(button,side.toUpperCase()+(pairing?.ids[side==='a'?0:1]!==null?' · '+verses[pairing.ids[side==='a'?0:1]][0]:''));
      }
      const evidenceTab=document.querySelector('button[data-mobile-compare=evidence]');evidenceTab.id='mobile-compare-tab-evidence';
      const evidence=get('comparison-evidence');if(evidence){attr(evidence,'role','tabpanel');attr(evidence,'aria-labelledby','mobile-compare-tab-evidence');}
      const b=pairing?.ids[1]!==null;document.querySelector('button[data-mobile-compare=b]').hidden=!b;evidenceTab.hidden=!b;
    }
  }
  function syncReader() {
    let reference=document.querySelector('.mobile-read-reference');
    if(!reference){reference=document.createElement('span');reference.className='mobile-read-reference';get('next-verse').before(reference);}
    text(reference,label(state.id));
    const links=document.querySelector('.reader-links');
    if(links&&!links.querySelector('.mobile-reader-more')){
      const more=iconButton(t('mTools'),'settings',openTools);more.className='mobile-reader-more';more.dataset.i18n='mTools';links.append(more);
    }
  }
  function synchronize() {
    if(!enabled)return;
    for(const node of initialOpen.keys())if(!node.isConnected)initialOpen.delete(node);
    text(get('mobile-page-title'),t(titles[view]));text(get('mobile-page-hint'),view==='read'?t('mReadHint'):'');
    syncReader();syncGuide();syncDetails();syncMap();
  }
  function scheduleSync() {
    if(!enabled||syncFrame)return;
    syncFrame=requestAnimationFrame(()=>{syncFrame=0;synchronize();});
  }
  const watcher=new MutationObserver(scheduleSync);
  for(const id of ['reading','word-results','guide-reading','comparison-body','verse-plate-body','husrev-plates'])watcher.observe(get(id),{childList:true,subtree:true});
  const originalSelect=selectVerse;
  selectVerse=(...args)=>{
    const changed=args[0]!==state.id;
    const searching=enabled&&get('mobile-search').open;
    const destination=enabled?(selectionTarget||(searching?searchView:null)||(args[1]?.scroll&&args[1]?.writeHash!==false?'read':null)):null;
    selectionTarget=null;
    // The original document-wide smooth scroll races with compact navigation.
    // Let the compact view restore a single, predictable reading position.
    const value=enabled?originalSelect(args[0],args[1]?{...args[1],scroll:false}:undefined):originalSelect(...args);
    if(enabled){
      if(destination)navigate(destination,{write:false,reset:changed});
      else rememberView();
      scheduleSync();
    }
    return value;
  };
  const originalShowAbjad=showAbjadForVerse;
  showAbjadForVerse=(...args)=>{if(enabled)navigate('study',{hash:'#ebced-labi'});return originalShowAbjad(...args);};
  const originalStudyPage=selectStudyPage;
  selectStudyPage=(page,focus=false)=>{
    if(enabled&&focus)navigate('pages',{hash:'#page-lab'});
    return originalStudyPage(page,focus);
  };
  const originalHusrev=openHusrevFromMadinah;
  openHusrevFromMadinah=(...args)=>{
    if(enabled&&husrevIndexForMadinah(args[0])!==null){
      navigate('pages',{hash:'#husrev'});document.querySelector('button[data-mobile-page=A]').click();
    }
    return originalHusrev(...args);
  };
  for(const name of ['renderGlobalUi','updateMap']){
    const base=name==='renderGlobalUi'?renderGlobalUi:updateMap;
    const wrapper=(...args)=>{const result=base(...args);scheduleSync();return result;};
    if(name==='renderGlobalUi')renderGlobalUi=wrapper;else updateMap=wrapper;
  }
  function activate() {
    if(enabled)return;enabled=true;
    previousScrollRestoration=history.scrollRestoration;history.scrollRestoration='manual';
    document.body.classList.add('mobile-mode');
    Object.entries(screens).forEach(([name,node])=>node.dataset.mobileScreen=name);
    move(get('mobile-search-trigger'),document.querySelector('.header-inner'));
    move(get('mobile-heading'),main.parentNode,main);
    move(get('mobile-map-actions'),document.querySelector('.map'),get('atlas-camera-panel'));
    move(get('atlas-expand'),get('mobile-map-actions'));
    move(get('atlas-camera-toggle'),get('mobile-map-actions'));
    move(document.querySelector('.map-tools'),get('map-viz'));
    move(get('immersive-close'),document.querySelector('.atlas-grid'));
    attr(get('map-viz'),'aria-describedby','mobile-map-hint');
    move(get('mobile-map-hint'),document.querySelector('.map'),document.querySelector('.map-footer'));
    move(get('mobile-map-selection'),document.querySelector('.map'),document.querySelector('.map-footer'));
    move(get('mobile-guide-selects'),get('guided').parentNode,get('guided'));
    move(get('mobile-page-tabs'),get('husrev-studio'),get('husrev-plates'));
    move(get('mobile-husrev-preset-field'),document.querySelector('.husrev-cases'),get('husrev-presets'));
    move(get('husrev-expand'),get('mobile-page-tabs'));
    move(get('mobile-compare-tabs'),get('comparison'),get('comparison-scroll'));
    get('husrev-studio').dataset.mobilePage='A';
    document.querySelectorAll('#kaynaklar details').forEach(closeInitially);
    synchronize();
    const storedView=history.state?.atlasMobile;
    const explicit=Object.hasOwn(titles,storedView)?storedView:screenForHash(location.hash);
    if(!location.hash||location.hash==='#ust'){
      try{const stored=JSON.parse(localStorage.getItem('quran-atlas-experience-v1'));const last=stored?.history?.[0];originalSelect(verseId.has(last)?verseId.get(last):0,{writeHash:false});}catch{originalSelect(0,{writeHash:false});}
    }
    navigate(explicit||'read',{write:false,hash:location.hash||hashes.read(),reset:!activatedBefore});
    activatedBefore=true;syncDialogViewport();
  }
  function deactivate() {
    if(!enabled)return;
    scrollPositions.set(view,currentScroll());
    clearMapTouches();
    if(document.querySelector('.atlas-immersive'))get('immersive-close').click();
    for(const d of mobileDialogs)if(d.open)d.close();
    enabled=false;
    clearTimeout(viewportTimer);clearTimeout(anchorTimer);
    if(viewportFrame)cancelAnimationFrame(viewportFrame);viewportFrame=0;
    syncScrollLock();history.scrollRestoration=previousScrollRestoration;
    for(const frame of scanFrames.values())cancelAnimationFrame(frame);scanFrames.clear();
    get('map-center').style.removeProperty('transform');
    for(const node of Array.from(movements.keys()))restore(node);
    for(const d of groups.keys())d.remove();groups.clear();
    for(const [node,open]of initialOpen)if(node.isConnected)node.open=open;initialOpen.clear();
    document.querySelectorAll('.mobile-reader-more').forEach(n=>n.remove());
    document.querySelectorAll('.mobile-read-reference').forEach(n=>n.remove());
    document.querySelectorAll('[data-mobile-screen]').forEach(n=>n.removeAttribute('data-mobile-screen'));
    document.querySelectorAll('[aria-labelledby^="mobile-compare-tab"]').forEach(n=>{n.removeAttribute('role');n.removeAttribute('aria-labelledby');});
    get('comparison').removeAttribute('data-mobile-compare');get('husrev-studio').removeAttribute('data-mobile-page');
    attr(get('map-viz'),'aria-describedby','map-gestures');
    document.body.classList.remove('mobile-mode');delete document.body.dataset.mobileView;
    text(get('atlas-expand'),t('openFocus'));
    get('atlas-camera-panel').hidden=true;attr(get('atlas-camera-toggle'),'aria-expanded',false);
    requestAnimationFrame(()=>{limitAtlasPan();updateMap();});
  }
  compact.addEventListener('change',()=>compact.matches?activate():deactivate());
  if(compact.matches)activate();
})();
