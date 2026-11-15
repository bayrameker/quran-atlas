/* Task navigation and accessible controls around the preserved reading engine. */
(() => {
  'use strict';
  const get=id=>document.getElementById(id);
  const studyTabs=[get('study-tab-word'),get('study-tab-abjad')];
  const readerTabs=[get('reader-tab-verse'),get('reader-tab-links')];
  function selectTab(tabs,index,focus=false) {
    tabs.forEach((tab,i)=>{
      const active=i===index;
      tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
      get(tab.getAttribute('aria-controls')).hidden=!active;
    });
    if(focus)tabs[index].focus({preventScroll:true});
  }
  function bindTabs(tabs) {
    tabs.forEach((tab,index)=>{
      tab.addEventListener('click',()=>selectTab(tabs,index));
      tab.addEventListener('keydown',event=>{
        let next=index;
        if(event.key==='ArrowRight'||event.key==='ArrowLeft')next=1-index;
        else if(event.key==='Home')next=0;
        else if(event.key==='End')next=1;
        else return;
        event.preventDefault();selectTab(tabs,next,true);
      });
    });
  }
  bindTabs(studyTabs);bindTabs(readerTabs);
  for(const id of ['word-workbench-title','abjad-workbench-title'])get(id).tabIndex=-1;
  const selectStudyFromHash=()=>{
    if(location.hash==='#ebced-labi')selectTab(studyTabs,1);
    else if(location.hash==='#lafiz-labi')selectTab(studyTabs,0);
  };
  selectStudyFromHash();addEventListener('hashchange',selectStudyFromHash);
  for(const [id,index] of [['study-word-link',0],['study-letter-link',1]])get(id).addEventListener('click',()=>selectTab(studyTabs,index));
  const baseShowAbjad=showAbjadForVerse;
  showAbjadForVerse=(...args)=>{selectTab(studyTabs,1);return baseShowAbjad(...args);};
  const baseRenderAbjad=renderAbjadWorkbench;
  renderAbjadWorkbench=(...args)=>{
    const result=baseRenderAbjad(...args),entry=get('abjad-entry');
    if(document.activeElement!==entry&&entry.dataset.draft!=='true')entry.value=abjadText(abjadSelection,get('script-select').value);
    return result;
  };
  get('abjad-entry').addEventListener('input',()=>{get('abjad-entry').dataset.draft='true';});
  get('abjad-form').addEventListener('submit',()=>{get('abjad-entry').dataset.draft='false';},true);
  for(const id of ['abjad-specimen-allah','abjad-specimen-basmala','abjad-specimen-iqra','abjad-specimen-verse'])get(id).addEventListener('click',()=>{get('abjad-entry').dataset.draft='false';},true);
  const baseSelectVerse=selectVerse;
  selectVerse=(...args)=>{selectTab(readerTabs,0);return baseSelectVerse(...args);};

  // Camera state controls geometry as well as the matching cached background.
  const defaults={yaw:-28,tilt:47,depth:.4};
  window.AtlasCamera={...defaults};
  const camera=get('atlas-camera-panel'),cameraButton=get('atlas-camera-toggle');
  let cameraFrame=0;
  function syncCamera() {
    const enabled=get('atlas-depth').getAttribute('aria-pressed')==='true';
    for(const [key,unit] of [['yaw','°'],['tilt','°'],['depth','%']]) {
      const value=key==='depth'?Math.round(AtlasCamera[key]*100):Math.round(AtlasCamera[key]);
      get('camera-'+key).value=String(value);get('camera-'+key).disabled=!enabled;
      get('camera-'+key+'-value').textContent=format.format(value)+unit;
    }
  }
  function repaintCamera() {
    syncCamera();
    if(cameraFrame)return;
    cameraFrame=requestAnimationFrame(()=>{cameraFrame=0;updateMap();dispatchEvent(new Event('atlas-camera-change'));});
  }
  for(const key of ['yaw','tilt','depth'])get('camera-'+key).addEventListener('input',event=>{
    AtlasCamera[key]=Number(event.target.value)/(key==='depth'?100:1);repaintCamera();
  });
  function showCamera(open) {
    camera.hidden=!open;cameraButton.setAttribute('aria-expanded',String(open));
  }
  cameraButton.addEventListener('click',()=>showCamera(camera.hidden));
  get('atlas-depth').addEventListener('click',()=>{syncCamera();dispatchEvent(new Event('atlas-camera-change'));});
  get('camera-reset').addEventListener('click',()=>{
    Object.assign(AtlasCamera,defaults);
    if(get('atlas-depth').getAttribute('aria-pressed')!=='true')get('atlas-depth').click();
    get('map-fit').click();repaintCamera();
  });
  document.addEventListener('pointerdown',event=>{
    if(!camera.hidden&&!camera.contains(event.target)&&!cameraButton.contains(event.target))showCamera(false);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!camera.hidden){event.preventDefault();event.stopImmediatePropagation();showCamera(false);cameraButton.focus({preventScroll:true});}
  },true);
  syncCamera();

  const clock=value=>{
    if(!Number.isFinite(value)||value<0)return '–:–';
    const n=Math.floor(value);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
  };
  const transports=[];
  function transport(media,start) {
    const frame=document.createElement('div');frame.className='ux-media';frame.dir='ltr';
    const controls=document.createElement('div');controls.className='ux-media-controls';
    const button=(icon,key,callback)=>{
      const b=document.createElement('button');b.type='button';b.dataset.icon=icon;b.dataset.aria=key;b.setAttribute('aria-label',t(key));
      b.addEventListener('click',callback);controls.append(b);return b;
    };
    const play=button('play','uxPlay',()=>{
      if(!media.paused&&!media.ended)media.pause();
      else if(media.error){media.load();start();}
      else if(!media.hasAttribute('src'))start();
      else media.play().catch(()=>{frame.classList.remove('is-loading');});
    });play.className='ux-media-play';
    const back=button('back-five','uxBackFive',()=>{if(Number.isFinite(media.duration))media.currentTime=Math.max(0,media.currentTime-5);});
    const forward=button('forward-five','uxForwardFive',()=>{if(Number.isFinite(media.duration))media.currentTime=Math.min(media.duration,media.currentTime+5);});
    const time=document.createElement('output');time.setAttribute('aria-live','off');controls.append(time);
    const seek=document.createElement('input');seek.type='range';seek.min='0';seek.max='1000';seek.value='0';seek.step='1';seek.dataset.aria='uxSeek';seek.setAttribute('aria-label',t('uxSeek'));
    let dragging=false;
    seek.addEventListener('pointerdown',()=>{dragging=true;});
    seek.addEventListener('input',()=>{
      if(Number.isFinite(media.duration))time.textContent=clock(Number(seek.value)/1000*media.duration)+' / '+clock(media.duration);
    });
    seek.addEventListener('change',()=>{if(Number.isFinite(media.duration))media.currentTime=Number(seek.value)/1000*media.duration;dragging=false;refresh();});
    seek.addEventListener('pointerup',()=>{dragging=false;});
    seek.addEventListener('pointercancel',()=>{dragging=false;refresh();});
    function refresh() {
      const duration=media.duration,ready=Number.isFinite(duration)&&duration>0;
      const playing=!media.paused&&!media.ended;
      play.dataset.icon=playing?'pause':'play';play.dataset.aria=playing?'uxPause':'uxPlay';play.setAttribute('aria-label',t(play.dataset.aria));
      seek.disabled=!ready;back.disabled=!ready;forward.disabled=!ready;
      if(!dragging){seek.value=ready?String(Math.round(media.currentTime/duration*1000)):'0';time.textContent=clock(media.currentTime)+' / '+clock(duration);}
      seek.setAttribute('aria-valuetext',clock(media.currentTime)+' / '+clock(duration));
      seek.setAttribute('aria-label',t('uxSeek'));back.setAttribute('aria-label',t('uxBackFive'));forward.setAttribute('aria-label',t('uxForwardFive'));
      if(media.paused||media.ended||media.error)frame.classList.remove('is-loading');
      decorateReaderPlay();
    }
    for(const event of ['loadedmetadata','durationchange','timeupdate','play','pause','ended','emptied','error','seeked'])media.addEventListener(event,refresh);
    for(const event of ['waiting','loadstart'])media.addEventListener(event,()=>{if(!media.paused)frame.classList.add('is-loading');});
    for(const event of ['playing','canplay','error','pause'])media.addEventListener(event,()=>frame.classList.remove('is-loading'));
    frame.append(controls,seek);media.after(frame);media.parentElement.classList.add('ux-audio-enhanced');
    transports.push({media,refresh});refresh();return frame;
  }
  const readerMedia=get('recitation'),comparisonMediaElement=get('comparison-audio'),cardMedia=get('card-recitation');
  transport(readerMedia,playSelected);
  transport(comparisonMediaElement,()=>{if(pairing)beginComparisonAudio(pairing.ids[1]===null?[0]:[0,1]);});
  function stopCard() {
    cardMedia.pause();cardMedia.removeAttribute('src');cardMedia.load();get('card-audio-error').hidden=true;
  }
  function playCard() {
    if(!plateSelection)return;
    const url=audioUrl(plateSelection.id,get('card-reciter').value);
    get('card-audio-source').href=url;get('card-audio-error').hidden=true;
    if(cardMedia.getAttribute('src')!==url)cardMedia.src=url;
    setPlaybackRate(cardMedia,Number(get('card-speed').value));
    cardMedia.play().catch(error=>{if(error.name!=='AbortError')get('card-audio-error').hidden=false;});
  }
  transport(cardMedia,playCard);
  cardMedia.addEventListener('error',()=>{if(cardMedia.hasAttribute('src'))get('card-audio-error').hidden=false;});
  get('card-speed').addEventListener('change',()=>setPlaybackRate(cardMedia,Number(get('card-speed').value)));
  get('card-reciter').addEventListener('change',()=>{const playing=!cardMedia.paused;stopCard();if(playing)playCard();});
  function cardOptions() {
    const previous=get('card-reciter').value||reciterKey;
    get('card-reciter').replaceChildren(...reciterOptions());get('card-reciter').value=previous;
  }
  const baseOpenPlate=openVersePlate;
  openVersePlate=(...args)=>{stopCard();cardOptions();return baseOpenPlate(...args);};
  get('verse-plate-dialog').addEventListener('close',stopCard);
  get('verse-plate-open-map').addEventListener('click',()=>{
    const id=plateSelection.id;get('verse-plate-dialog').close();selectVerse(id,{scroll:true});
    get('reader-title').tabIndex=-1;get('reader-title').focus({preventScroll:true});
  });
  // One recitation at a time across the reader, comparisons and verse cards.
  document.addEventListener('play',event=>{
    if(!(event.target instanceof HTMLMediaElement))return;
    for(const media of [readerMedia,comparisonMediaElement,cardMedia])if(media!==event.target&&!media.paused)media.pause();
  },true);
  document.addEventListener('click',event=>{
    const button=event.target.closest('.reader-links button:first-child');
    if(button&&!readerMedia.paused&&!readerMedia.ended){event.preventDefault();event.stopImmediatePropagation();readerMedia.pause();}
  },true);

  function decorateReaderPlay() {
    const button=document.querySelector('.reader-links button:first-child');if(!button)return;
    const playing=!readerMedia.paused&&!readerMedia.ended;
    const label=t(playing?'uxPause':'listen');
    if(button.textContent!==label)button.textContent=label;
    button.dataset.icon=playing?'pause':'play';
    if(button.getAttribute('aria-pressed')!==String(playing))button.setAttribute('aria-pressed',String(playing));
  }
  const icons=[
    ['#prev-verse,.husrev-prev,#focus-page-prev','previous',true],['#next-verse,.husrev-next,#focus-page-next','next',true],
    ['#map-zoom-out,[data-hzoom="out"]','minus',true],['#map-zoom-in,[data-hzoom="in"]','plus',true],
    ['#map-fit,[data-hzoom="fit"]','fit'],['#save-verse','bookmark'],
    ['.reader-links button:nth-child(2),.guide-compare','compare'],['.reader-plate','book'],['.reader-links a,.husrev-source,.husrev-madinah-link','source'],
    ['#word-custom,#page-go,.husrev-go,.comparison-form button','search'],['#word-download,#verse-plate-save','download'],
    ['#verse-plate-abjad,#verse-plate-word-abjad,#abjad-form button','calculator'],
    ['#comparison-close,#verse-plate-close,#husrev-dialog-close,#immersive-close,[data-close-experience]','close',true],
    ['#husrev-expand,#husrev-layout','fit'],['#husrev-measure','plus'],['#word-more','plus'],['.husrev-sample button,#go-related','network']
  ];
  function decorate() {
    for(const [selector,icon,only] of icons)document.querySelectorAll(selector).forEach(node=>{node.dataset.icon=icon;if(only)node.dataset.iconOnly='true';});
    // Newly created play controls use their semantic container, never translated text.
    document.querySelectorAll('.listen-side,.listen-pair,.guide-listen').forEach(node=>{
      node.dataset.icon='play';const label=node.textContent.replace(/^[▶►]\s*/u,'');if(node.textContent!==label)node.textContent=label;
      if(node.matches('.listen-side'))node.dataset.iconOnly='true';
    });
    document.querySelectorAll('.guide-actions .jump').forEach(node=>{node.dataset.icon='network';});
    document.querySelectorAll('.guide-actions button:last-child').forEach(node=>{node.dataset.icon='book';});
    for(const id of ['word-allah','word-yawm','abjad-specimen-allah','abjad-specimen-basmala','abjad-specimen-iqra','abjad-specimen-verse']){
      const node=get(id);node.dataset.icon=node.getAttribute('aria-pressed')==='true'?'check':id.startsWith('word-')?'type':'book';
    }
    const rule=wordStudy.current?.key;
    get('study-current-rule').textContent=rule?t(wordRules[rule].title):'';
    decorateReaderPlay();
  }
  let decorationFrame=0;
  const observer=new MutationObserver(()=>{
    if(decorationFrame)return;
    decorationFrame=requestAnimationFrame(()=>{decorationFrame=0;decorate();});
  });
  for(const id of ['reading','word-results','word-rules','abjad-local','comparison-body','verse-plate-body','husrev-plates','husrev-pair','guide-reading']){
    const node=get(id);if(node)observer.observe(node,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed']});
  }
  for(const id of ['word-allah','word-yawm','word-custom','abjad-specimen-allah','abjad-specimen-basmala','abjad-specimen-iqra','abjad-specimen-verse'])get(id).addEventListener('click',()=>requestAnimationFrame(decorate));
  const baseRenderUI=renderGlobalUi;
  renderGlobalUi=(...args)=>{const value=baseRenderUI(...args);decorate();syncCamera();cardOptions();transports.forEach(p=>p.refresh());return value;};
  cardOptions();decorate();renderAbjadWorkbench();updateMap();
  if(['#ebced-labi','#lafiz-labi'].includes(location.hash))document.fonts.ready.then(()=>get(location.hash.slice(1))?.scrollIntoView({block:'start'}));
})();
