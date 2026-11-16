/* Quran Atlas experience. Scripture and source datasets are read, never rewritten. */
(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const paletteStyle = getComputedStyle(document.documentElement);
  const paletteColor = name => paletteStyle.getPropertyValue('--'+name).trim();
  const paletteRGB = name => paletteStyle.getPropertyValue('--'+name+'-rgb').trim();
  const paletteAlpha = (name,alpha) => `rgba(${paletteRGB(name)},${alpha})`;
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'quran-atlas-experience-v1';
  const defaults = {surface:'paper',texture:45,motion:true,fontSize:29,saved:[],history:[]};
  const readStorage = () => { try { return JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { return {}; } };
  const stored = readStorage();
  const validRefs = values => Array.isArray(values) ? [...new Set(values.filter(ref => typeof ref === 'string' && verseId.has(ref)))] : [];
  const prefs = {
    surface:['paper','etched','plain'].includes(stored.surface) ? stored.surface : defaults.surface,
    texture:Number.isFinite(stored.texture) ? bound(stored.texture,0,100) : defaults.texture,
    motion:stored.motion !== false,
    fontSize:Number.isFinite(stored.fontSize) ? bound(stored.fontSize,24,42) : defaults.fontSize,
    saved:validRefs(stored.saved),history:validRefs(stored.history).slice(0,12),
  };
  const persist = () => { try { localStorage.setItem(storageKey,JSON.stringify(prefs)); } catch { /* Preferences remain usable without storage. */ } };
  const motionAllowed = () => prefs.motion && !motionQuery.matches;
  let toastTimer;
  function toast(key) {
    const node=get('experience-toast');
    node.textContent=t(key); node.hidden=false;
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>{node.hidden=true;},2700);
  }
  function applyPrefs() {
    document.body.dataset.surface=prefs.surface;
    document.body.classList.toggle('reduced-motion',!motionAllowed());
    document.documentElement.style.scrollBehavior=motionAllowed()?'':'auto';
    document.documentElement.style.setProperty('--texture-opacity',String(prefs.texture*.0009));
    document.documentElement.style.setProperty('--reader-size',prefs.fontSize+'px');
    document.querySelectorAll('[data-surface-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.surfaceChoice===prefs.surface)));
    get('texture-strength').value=String(prefs.texture);
    get('motion-preference').setAttribute('aria-pressed',String(motionAllowed()));
    get('motion-preference').textContent=t(motionAllowed()?'motionOn':'motionOff');
    get('motion-preference').disabled=motionQuery.matches;
    if(!motionAllowed()) {
      document.querySelectorAll('.selection-sprite').forEach(node=>node.remove());
      document.getAnimations().forEach(animation=>animation.cancel());
    }
    scheduleHero();
  }

  document.querySelectorAll('[data-surface-choice]').forEach(button=>button.addEventListener('click',()=>{
    prefs.surface=button.dataset.surfaceChoice; applyPrefs(); persist();
  }));
  get('texture-strength').addEventListener('input',event=>{
    prefs.texture=Number(event.target.value); applyPrefs(); persist();
  });
  get('motion-preference').addEventListener('click',()=>{prefs.motion=!prefs.motion;applyPrefs();persist();manageAnimation();});
  motionQuery.addEventListener('change',()=>{applyPrefs();manageAnimation();});
  const baseAnimateVisible=animateVisible;
  animateVisible=(...args)=>motionAllowed()?baseAnimateVisible(...args):undefined;

  const dialogs=[get('experience-settings'),get('experience-saved')];
  function openDialog(dialog) {
    if(dialog.id==='experience-saved') renderSaved();
    if(!dialog.open) dialog.showModal();
  }
  document.querySelectorAll('[data-experience-dialog]').forEach(button=>button.addEventListener('click',()=>openDialog(get(button.dataset.experienceDialog))));
  document.querySelectorAll('[data-close-experience]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  dialogs.forEach(dialog=>dialog.addEventListener('click',event=>{
    if(event.target!==dialog) return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close();
  }));

  function renderSaved() {
    const list=get('saved-verses');
    list.replaceChildren();
    get('saved-empty').hidden=prefs.saved.length>0;
    for(const ref of prefs.saved) {
      const id=verseId.get(ref);
      const row=el('li');
      const open=action(label(id),()=>{
        get('experience-saved').close(); selectVerse(id,{scroll:true});
        get('reader-title').tabIndex=-1;
        get('reader-title').focus({preventScroll:true});
      });
      const remove=action(t('removeSaved'),()=>{
        prefs.saved=prefs.saved.filter(value=>value!==ref);
        persist();renderSaved();syncReadingTools();
      },'remove-saved');
      remove.setAttribute('aria-label',t('removeSaved')+' · '+label(id));
      row.append(open,remove);list.append(row);
    }
  }
  function syncReadingTools() {
    const ref=verses[state.id][0];
    const button=get('save-verse');
    const saved=prefs.saved.includes(ref);
    button.textContent=t(saved?'verseSaved':'saveVerse');
    button.setAttribute('aria-pressed',String(saved));
    const resume=get('resume-reading');
    const previous=prefs.history.find(value=>verseId.has(value));
    resume.hidden=!previous;
    if(previous) resume.textContent=t('resumeReading')+' · '+label(verseId.get(previous));
    const smaller=get('reader-font-smaller'),larger=get('reader-font-larger');
    smaller.disabled=prefs.fontSize<=24;larger.disabled=prefs.fontSize>=42;
  }
  get('save-verse').addEventListener('click',()=>{
    const ref=verses[state.id][0];
    const already=prefs.saved.includes(ref);
    prefs.saved=already?prefs.saved.filter(value=>value!==ref):[ref,...prefs.saved];
    persist();syncReadingTools();toast(already?'bookmarkRemoved':'bookmarkAdded');
  });
  get('resume-reading').addEventListener('click',()=>{
    const ref=prefs.history.find(value=>verseId.has(value));
    if(ref) selectVerse(verseId.get(ref),{scroll:true});
  });
  get('reader-font-smaller').addEventListener('click',()=>{prefs.fontSize=bound(prefs.fontSize-2,24,42);applyPrefs();persist();syncReadingTools();});
  get('reader-font-larger').addEventListener('click',()=>{prefs.fontSize=bound(prefs.fontSize+2,24,42);applyPrefs();persist();syncReadingTools();});
  const baseUpdateReading=updateReading;
  updateReading=(...args)=>{const result=baseUpdateReading(...args);syncReadingTools();return result;};

  let immersive=false,immersiveOpener;
  function setImmersive(value) {
    immersive=value;
    const grid=document.querySelector('.atlas-grid');
    grid.classList.toggle('atlas-immersive',value);
    get('atlas-expand').setAttribute('aria-pressed',String(value));
    get('atlas-expand').textContent=t(value?'closeFocus':'openFocus');
    get('immersive-close').hidden=!value;
    document.body.style.overflow=value?'hidden':'';
    if(value) {
      immersiveOpener=document.activeElement;
      get('immersive-close').focus({preventScroll:true});
    } else if(immersiveOpener?.isConnected) immersiveOpener.focus({preventScroll:true});
    requestAnimationFrame(()=>{limitAtlasPan();updateMap();});
  }
  get('atlas-expand').addEventListener('click',()=>setImmersive(!immersive));
  get('immersive-close').addEventListener('click',()=>setImmersive(false));
  get('dock-search').addEventListener('click',()=>{
    if(immersive) setImmersive(false);
    get('harita').scrollIntoView({behavior:motionAllowed()?'smooth':'auto',block:'start'});
    get('search-query').focus({preventScroll:true});
  });
  document.addEventListener('keydown',event=>{
    const target=event.target;
    const typing=target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    if(event.key==='Escape' && immersive && !document.querySelector('dialog[open]')) {event.preventDefault();setImmersive(false);}
    if(event.key==='/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey && !document.querySelector('dialog[open]')) {
      event.preventDefault();get('dock-search').click();
    }
  });
  let depth=true;
  get('atlas-depth').addEventListener('click',()=>{
    depth=!depth;get('atlas-depth').setAttribute('aria-pressed',String(depth));
    updateMap();pulseMap();
  });
  const baseRingPoint=ringPoint;
  ringPoint=(index,total,center,rx,ry)=>{
    if(depth && state.mode==='all' && window.AtlasCosmos) {
      const width=mapViz.clientWidth,height=mapViz.clientHeight;
      const point=window.AtlasCosmos.point(index,total,width,height,0,0,0,false,'map',window.AtlasCamera);
      return {...point,x:point.x-width*.01,y:point.y+height*.03,angle:Math.atan2(point.y-height*.47,point.x-width*.51)};
    }
    const point=baseRingPoint(index,total,center,rx,ry);
    if(!depth) return point;
    if(window.AtlasCamera) {
      const camera=window.AtlasCamera,angle=point.angle,drift=.82+.18*Math.sin(index*2.4+1);
      const rotation=camera.yaw*Math.PI/180,tilt=camera.tilt*Math.PI/180;
      const x=(point.x-center.x)*drift,y=(point.y-center.y)*drift*Math.cos(tilt)/.68;
      const z=Math.sin(angle)*Math.min(rx,ry)*camera.depth*Math.sin(tilt);
      const perspective=900/(900-z),px=(x*Math.cos(rotation)-y*Math.sin(rotation))*perspective,py=(x*Math.sin(rotation)+y*Math.cos(rotation))*perspective;
      const extentX=Math.sqrt(rx*rx*Math.cos(rotation)**2+(ry*Math.cos(tilt)/.68)**2*Math.sin(rotation)**2)*1.2;
      const extentY=Math.sqrt(rx*rx*Math.sin(rotation)**2+(ry*Math.cos(tilt)/.68)**2*Math.cos(rotation)**2)*1.2;
      const fit=Math.min(1,mapViz.clientWidth*.38/extentX,mapViz.clientHeight*.34/extentY);
      return {...point,x:center.x+px*fit,y:center.y+py*fit,angle:Math.atan2(py,px)};
    }
    const dy=point.y-center.y;
    const perspective=1+Math.sin(point.angle)*.075;
    const drift=.82+.18*Math.sin(index*2.4+1);
    return {...point,x:center.x+(point.x-center.x)*perspective*drift,y:center.y+dy*.85*drift+Math.cos(point.angle)*rx*.055};
  };
  const baseOrbit=orbit;
  orbit=(...args)=>depth?undefined:baseOrbit(...args);
  const baseDrawName=drawName;
  drawName=(point,text,center,compact,highlight)=>{
    if(!depth)return baseDrawName(point,text,center,compact,highlight);
    ctx.save();ctx.font=(highlight?'700 ':'500 ')+(compact?'11.5':'13')+'px Satoshi, "Amiri Quran", sans-serif';
    const width=ctx.measureText(text).width;
    const outward=Math.cos(point.angle)<0?-width-12:12;
    const x=bound(point.x+outward,6,mapViz.clientWidth-width-6),y=bound(point.y-9,13,mapViz.clientHeight-13);
    ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=paletteColor(highlight?'gold-bright':'on-dark');
    ctx.shadowColor=paletteColor('space');ctx.shadowBlur=7;ctx.fillText(text,x,y);ctx.restore();
  };
  const baseColor=color;
  color=(kind,alpha)=>baseColor(kind,depth&&state.mode==='all'&&alpha<.3?alpha*.35:alpha);
  const baseCircle=circle;
  circle=(x,y,radius,fill,border)=>{
    if(depth&&radius>35&&fill===paletteColor('night-raised')) {
      ctx.save();
      const halo=ctx.createRadialGradient(x,y,0,x,y,radius*1.55);
      halo.addColorStop(0,paletteAlpha('space',.94));halo.addColorStop(.5,paletteAlpha('space',.78));halo.addColorStop(1,paletteAlpha('space',0));
      ctx.fillStyle=halo;ctx.beginPath();ctx.arc(x,y,radius*1.55,0,Math.PI*2);ctx.fill();ctx.restore();return;
    }
    baseCircle(x,y,radius,fill,border);
  };

  // The opening instrument uses the real 114 surahs and the supplied relation
  // groups. Projection adds depth; no generated content stands in for the data.
  const heroCanvas=get('hero-atlas');
  const heroContext=heroCanvas.getContext('2d');
  let heroId=state.id,heroHover=-1,heroVisible=false,mapVisible=false;
  let pointerX=0,pointerY=0,heroFrame=0,lastHeroFrame=0;
  let heroPoints=[],heroLinks=[],heroBackground=[];
  const cosmos=window.AtlasCosmos;
  const cosmosColors={space:paletteColor('space'),gold:paletteColor('gold'),white:paletteColor('on-dark'),silver:paletteColor('silver')};
  let heroSky=null,heroSkySize='';
  function cacheHeroLinks() {
    heroBackground=visibleOverview.filter(edge=>edge.start!==edge.end).slice(-70);
    heroLinks=visibleOverview.filter(edge=>edge.start===chapter[heroId] || edge.end===chapter[heroId]).slice(-40);
  }
  function setHero(id) {
    if(!verses[id]) return;
    heroId=id;cacheHeroLinks();
    get('instrument-selected').textContent=label(id);
    const count=new Set(neighbors[id].map(edge=>other(edge,id))).size;
    get('instrument-count').textContent=t('linkCount',{k:format.format(count)});
    document.querySelectorAll('[data-hero-ref]').forEach(button=>{
      const ref=button.dataset.heroRef;
      button.textContent=label(verseId.get(ref));
      button.setAttribute('aria-pressed',String(verses[id][0]===ref));
    });
    scheduleHero();
  }
  document.querySelectorAll('[data-hero-ref]').forEach(button=>button.addEventListener('click',()=>setHero(verseId.get(button.dataset.heroRef))));
  document.querySelector('.hero-explore').addEventListener('click',event=>{event.preventDefault();selectVerse(heroId,{scroll:true});});
  function renderHero(now=performance.now()) {
    if(!heroContext || !cosmos) return;
    const width=heroCanvas.clientWidth,height=heroCanvas.clientHeight;
    if(!width || !height) return;
    const dpr=Math.min(devicePixelRatio||1,2);
    if(heroCanvas.width!==Math.round(width*dpr) || heroCanvas.height!==Math.round(height*dpr)) {
      heroCanvas.width=Math.round(width*dpr);heroCanvas.height=Math.round(height*dpr);
    }
    const size=width+':'+height+':'+dpr;
    if(heroSkySize!==size) {heroSky=cosmos.backdrop(width,height,cosmosColors);heroSkySize=size;}
    const c=heroContext;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);
    c.drawImage(heroSky,0,0,width,height);
    const moving=motionAllowed();
    heroPoints=surahs.map((_,index)=>cosmos.point(index,surahs.length,width,height,now,pointerX,pointerY,moving));
    const center={x:width*.51,y:height*.47};
    const path=(edge,active)=>{
      if(edge.start===edge.end)return;
      const a=heroPoints[edge.start],b=heroPoints[edge.end];
      c.beginPath();c.moveTo(a.x,a.y);
      c.bezierCurveTo(center.x+(a.x-center.x)*.34,center.y+(a.y-center.y)*.34,
        center.x+(b.x-center.x)*.34,center.y+(b.y-center.y)*.34,b.x,b.y);
      c.strokeStyle=paletteAlpha(active?'gold':'silver',active?.34:.07);
      c.lineWidth=active?.55+Math.min(.65,edge.weight/50):.45;c.stroke();
    };
    heroBackground.forEach(edge=>path(edge,false));heroLinks.forEach(edge=>path(edge,true));
    const selected=chapter[heroId];
    const related=new Set(heroLinks.flatMap(edge=>[edge.start,edge.end]));
    heroPoints.map((p,id)=>({...p,id})).sort((a,b)=>a.z-b.z).forEach(p=>{
      const active=p.id===selected || p.id===heroHover;
      c.save();
      if(active){c.shadowColor=paletteColor('gold');c.shadowBlur=23;}
      c.beginPath();c.arc(p.x,p.y,(active?3.9:related.has(p.id)?1.8:1.2)*p.scale,0,Math.PI*2);
      c.fillStyle=paletteColor(active?'gold-bright':related.has(p.id)?'accent-soft':'silver');c.fill();
      if(active){
        c.shadowBlur=0;c.beginPath();c.arc(p.x,p.y,9*p.scale,0,Math.PI*2);c.strokeStyle=paletteAlpha('gold',.45);c.lineWidth=.6;c.stroke();
        c.beginPath();c.moveTo(p.x-16,p.y);c.lineTo(p.x-11,p.y);c.moveTo(p.x+11,p.y);c.lineTo(p.x+16,p.y);
        c.moveTo(p.x,p.y-16);c.lineTo(p.x,p.y-11);c.moveTo(p.x,p.y+11);c.lineTo(p.x,p.y+16);c.stroke();
      }
      c.restore();
    });
    const boxes=[];
    const labels=[...new Set([selected,heroHover,0,16,35,54,76,95])].filter(id=>id>=0);
    for(const id of labels) {
      const p=heroPoints[id],active=id===selected||id===heroHover;
      c.font=`${active?'700':'400'} ${active?11:width<400?8:10}px Satoshi, 'DM Sans', sans-serif`;
      const text=surahTitle(id),extent=c.measureText(text).width;
      const x=bound(p.x+(p.x<center.x?-extent-14:14),7,width-extent-7),y=bound(p.y-10,14,height-35);
      if(!active&&boxes.some(b=>x<b.x+b.w+9&&x+extent>b.x-9&&Math.abs(y-b.y)<19))continue;
      boxes.push({x,y,w:extent});
      c.save();c.shadowColor=paletteColor('space');c.shadowBlur=7;c.textAlign='left';c.textBaseline='middle';
      c.fillStyle=paletteColor(active?'gold-bright':'night-muted');c.fillText(text,x,y);c.restore();
    }
  }
  function scheduleHero() {
    if(heroFrame) return;
    heroFrame=requestAnimationFrame(now=>{heroFrame=0;renderHero(now);});
  }
  heroCanvas.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse') return;
    const r=heroCanvas.getBoundingClientRect();
    const x=event.clientX-r.left,y=event.clientY-r.top;
    if(motionAllowed()) {pointerX=x/r.width-.5;pointerY=y/r.height-.5;}
    let nearest=-1,distance=18;
    heroPoints.forEach((p,id)=>{const d=Math.hypot(x-p.x,y-p.y);if(d<distance){nearest=id;distance=d;}});
    heroHover=nearest;heroCanvas.style.cursor=nearest>=0?'pointer':'crosshair';scheduleHero();
  });
  heroCanvas.addEventListener('pointerleave',()=>{pointerX=0;pointerY=0;heroHover=-1;scheduleHero();});
  heroCanvas.addEventListener('click',event=>{
    const r=heroCanvas.getBoundingClientRect();
    let nearest=-1,distance=23;
    heroPoints.forEach((p,id)=>{const d=Math.hypot(event.clientX-r.left-p.x,event.clientY-r.top-p.y);if(d<distance){nearest=id;distance=d;}});
    if(nearest>=0) setHero(surahs[nearest][2]);
  });
  new ResizeObserver(scheduleHero).observe(heroCanvas);
  get('layers').addEventListener('change',()=>{cacheHeroLinks();scheduleHero();pulseMap();});

  // A short data-path trace guides attention after a selection. It stops when
  // off screen/hidden and never changes, stretches or animates the verse text.
  let pulseStart=0,pulseUntil=0,animationFrame=0,lastAnimation=0;
  let sprite=null;
  for(const kind of ['l','t','k','r']) types[kind].rgb=paletteRGB('layer-'+kind);
  const baseDraw=draw;
  draw=()=>{
    baseDraw();
    if(!ctx || !motionAllowed() || !mapVisible || performance.now()>pulseUntil || state.mode!=='focus') return;
    const width=mapViz.clientWidth,height=mapViz.clientHeight;
    const cx=width/2,cy=height/2;
    const phase=(performance.now()-pulseStart)/1600;
    ctx.save();ctx.translate(cx+atlasView.x,cy+atlasView.y);ctx.scale(atlasView.scale,atlasView.scale);ctx.translate(-cx,-cy);
    optionsOnMap.slice(0,14).forEach((point,index)=>{
      const progress=Math.min(1,Math.max(0,(phase-index*.027)%1));
      const u=1-progress;
      if(!Number.isFinite(point.controlX)) return;
      const x=u*u*cx+2*u*progress*point.controlX+progress*progress*point.x;
      const y=u*u*cy+2*u*progress*point.controlY+progress*progress*point.y;
      ctx.beginPath();ctx.arc(x,y,1.7,0,Math.PI*2);ctx.fillStyle=color(point.edge[0],.9*(1-progress*.7));ctx.fill();
    });
    ctx.restore();
    if(sprite?.isConnected) {
      const n=Math.min(59,Math.floor((performance.now()-pulseStart)/2000*60));
      sprite.style.left=(cx+atlasView.x)+'px';sprite.style.top=(cy+atlasView.y)+'px';
      sprite.style.backgroundPosition=(-(n%5)*272)+'px '+(-Math.floor(n/5)*104)+'px';
      sprite.style.opacity=String(Math.min(.55,(1-n/60)*.8));
    }
  };
  function pulseMap() {
    if(!motionAllowed() || state.mode!=='focus') {sprite?.remove();sprite=null;draw();return;}
    pulseStart=performance.now();pulseUntil=pulseStart+2000;
    sprite?.remove();sprite=el('span','selection-sprite');sprite.setAttribute('aria-hidden','true');
    mapViz.append(sprite);manageAnimation();
  }
  function animate(now) {
    animationFrame=0;
    if(document.hidden || !motionAllowed()) return;
    if(now-lastAnimation>32) {
      lastAnimation=now;
      if(heroVisible) renderHero(now);
      if(mapVisible && now<pulseUntil) draw();
      if(now>=pulseUntil) {sprite?.remove();sprite=null;}
    }
    if(heroVisible || (mapVisible && now<pulseUntil)) animationFrame=requestAnimationFrame(animate);
  }
  function manageAnimation() {
    if(animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame=0;
    if(!document.hidden && motionAllowed() && (heroVisible || (mapVisible && performance.now()<pulseUntil))) animationFrame=requestAnimationFrame(animate);
  }
  const visibility=new IntersectionObserver(entries=>{
    for(const entry of entries) {
      if(entry.target===heroCanvas) heroVisible=entry.isIntersecting;
      if(entry.target===mapViz) mapVisible=entry.isIntersecting;
    }
    if(!mapVisible) {sprite?.remove();sprite=null;}
    scheduleHero();manageAnimation();
  },{threshold:.06});
  // The distant galaxy is cached once per size. It never captures map input.
  const mapCosmos=document.createElement('canvas');
  mapCosmos.id='map-cosmos';mapCosmos.className='map-cosmos';mapCosmos.setAttribute('aria-hidden','true');
  mapViz.prepend(mapCosmos);
  let mapSkySize='';
  function paintMapCosmos() {
    const width=mapViz.clientWidth,height=mapViz.clientHeight;
    if(!width || !height || !cosmos) return;
    const camera=window.AtlasCamera;
    const size=[width,height,devicePixelRatio,camera?.yaw,camera?.tilt,camera?.depth].join(':');
    if(size===mapSkySize)return;
    mapSkySize=size;
    const sky=cosmos.backdrop(width,height,cosmosColors,'map',camera);
    mapCosmos.width=sky.width;mapCosmos.height=sky.height;
    const context=mapCosmos.getContext('2d');if(context)context.drawImage(sky,0,0);
  }
  let mapResizeTimer;
  new ResizeObserver(()=>{
    if(!document.body.classList.contains('mobile-mode')){paintMapCosmos();return;}
    // Keep the cached sky while Safari animates its browser chrome; drawing
    // the noise texture at every intermediate height stalls touch handling.
    clearTimeout(mapResizeTimer);mapResizeTimer=setTimeout(paintMapCosmos,120);
  }).observe(mapViz);paintMapCosmos();
  let cameraPaintTimer;
  addEventListener('atlas-camera-change',()=>{clearTimeout(cameraPaintTimer);cameraPaintTimer=setTimeout(paintMapCosmos,100);});
  visibility.observe(heroCanvas);visibility.observe(mapViz);
  document.addEventListener('visibilitychange',manageAnimation);

  const baseSelectVerse=selectVerse;
  selectVerse=(id,options)=>{
    const result=baseSelectVerse(id,options);
    if(!Number.isInteger(id) || !verses[id]) return result;
    const ref=verses[id][0];
    prefs.history=[ref,...prefs.history.filter(value=>value!==ref)].slice(0,12);
    persist();syncReadingTools();setHero(id);pulseMap();
    return result;
  };
  const baseSelectMode=selectMode;
  selectMode=(...args)=>{const result=baseSelectMode(...args);pulseMap();return result;};
  const baseRenderGlobalUi=renderGlobalUi;
  renderGlobalUi=(...args)=>{
    const result=baseRenderGlobalUi(...args);
    syncReadingTools();setHero(heroId);applyPrefs();
    get('atlas-expand').textContent=t(immersive?'closeFocus':'openFocus');
    if(get('experience-saved').open) renderSaved();
    return result;
  };

  // Chapter navigation follows the document rather than trapping scroll.
  const sections=['harita','sayim','icaz','tevafuk','kaynaklar','kutuphane'].map(get).filter(Boolean);
  const chapterLinks=Array.from(document.querySelectorAll('.chapter-rail a,#site-nav a,.journey-index a'));
  let scrollFrame=0;
  function updateDocumentPosition() {
    scrollFrame=0;
    // The compact interface has no document progress bar or chapter rail.
    // Updating an inherited root variable on every swipe invalidates the
    // styles of the entire reading/data tree, including hidden sections.
    if(document.body.classList.contains('mobile-mode')) return;
    const max=document.documentElement.scrollHeight-innerHeight;
    const progress=max>0?Math.min(1,scrollY/max):0;
    document.documentElement.style.setProperty('--page-progress',String(progress));
    const active=sections.filter(section=>section.getBoundingClientRect().top<innerHeight*.34).at(-1);
    chapterLinks.forEach(anchor=>{
      if(anchor.hash==='#'+active?.id) anchor.setAttribute('aria-current','location');
      else anchor.removeAttribute('aria-current');
    });
  }
  addEventListener('scroll',()=>{if(!scrollFrame) scrollFrame=requestAnimationFrame(updateDocumentPosition);},{passive:true});
  addEventListener('resize',()=>{updateDocumentPosition();scheduleHero();});
  const chapterReveal=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      if(motionAllowed()) entry.target.classList.add('entering');
      chapterReveal.unobserve(entry.target);
    });
  },{threshold:.03});
  sections.forEach(section=>{section.classList.add('reveal-section');chapterReveal.observe(section);});

  cacheHeroLinks();setHero(state.id);applyPrefs();syncReadingTools();updateDocumentPosition();
  // Translate new chrome with the same validated six-language catalogue.
  updateLocaleControls();
  const entryHash=location.hash;
  let entryInterrupted=false;
  addEventListener('pointerdown',()=>{entryInterrupted=true;},{once:true,passive:true});
  addEventListener('wheel',()=>{entryInterrupted=true;},{once:true,passive:true});
  document.fonts.ready.then(()=>{
    scheduleHero();scheduleMapDraw();
    if(document.body.classList.contains('mobile-mode')) return;
    if(entryInterrupted || location.hash!==entryHash) return;
    const target=/^#ayet-\d+-\d+$/.test(entryHash)?get('harita'):get(entryHash.slice(1));
    if(!target || !entryHash) return;
    const root=document.documentElement;
    const behavior=root.style.scrollBehavior;
    root.style.scrollBehavior='auto';target.scrollIntoView({block:'start',behavior:'auto'});root.style.scrollBehavior=behavior;
  });
})();
