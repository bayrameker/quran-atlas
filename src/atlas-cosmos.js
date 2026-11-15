/* Native Canvas star fields. Decorative space; the interactive nodes use atlas data. */
(() => {
  'use strict';
  const tau=Math.PI*2;
  function random(seed) {
    let value=seed>>>0;
    return ()=>{value^=value<<13;value^=value>>>17;value^=value<<5;return (value>>>0)/4294967296;};
  }
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',');
  function noise(x,y) {
    const hash=(a,b)=>{let n=Math.imul(a,374761393)+Math.imul(b,668265263)+912541;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);
    return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;
  }
  function nebula(width,height,cx,cy,radius,colors,rotation=-.48,squash=.68) {
    const layer=document.createElement('canvas');
    layer.width=Math.min(470,Math.round(width*.7));layer.height=Math.max(1,Math.round(height*layer.width/width));
    const context=layer.getContext('2d');if(!context)return layer;
    const frame=context.createImageData(layer.width,layer.height),pixels=frame.data;
    const scale=width/layer.width,cos=Math.cos(rotation),sin=Math.sin(rotation);
    const warm=[1,3,5].map(i=>parseInt(colors.gold.slice(i,i+2),16));
    for(let y=0;y<layer.height;y++)for(let x=0;x<layer.width;x++) {
      const dx=x*scale-cx,dy=y*scale-cy;
      const gx=(dx*cos+dy*sin)/radius,gy=(-dx*sin+dy*cos)/radius/squash;
      const r=Math.hypot(gx,gy);if(r>1.3)continue;
      const n=noise(x*.055,y*.055)*.6+noise(x*.13,y*.13)*.27+noise(x*.29,y*.29)*.13;
      const phase=Math.atan2(gy,gx)-r*4.7+(n-.5)*.7;
      const arms=Math.pow(Math.max(0,Math.cos(phase*4)),7)*Math.exp(-r*1.9);
      const core=Math.exp(-r*r*31)*.8;
      const density=Math.max(0,(core+arms*.7)*Math.pow(n,1.4)*(1-Math.min(1,r/1.3)));
      const offset=(y*layer.width+x)*4,tint=.12+n*.2;
      for(let channel=0;channel<3;channel++)pixels[offset+channel]=Math.round(205*(1-tint)+warm[channel]*tint);
      pixels[offset+3]=Math.round(Math.min(.54,density*1.8)*255);
    }
    context.putImageData(frame,0,0);return layer;
  }
  function backdrop(width,height,colors,variant='hero',camera) {
    const canvas=document.createElement('canvas');
    const ratio=Math.min(devicePixelRatio||1,1.5,1400/width);
    canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
    const c=canvas.getContext('2d');
    if(!c) return canvas;
    c.scale(ratio,ratio);
    const rand=random(variant==='hero'?912541:314159);
    const white=rgb(colors.white),gold=rgb(colors.gold),silver=rgb(colors.silver);
    c.fillStyle=colors.space;c.fillRect(0,0,width,height);
    const stars=Math.min(550,Math.floor(width*height/1100));
    for(let i=0;i<stars;i++) {
      const x=rand()*width,y=rand()*height,size=.2+rand()*.75;
      c.fillStyle=`rgba(${i%7===0?gold:white},${.13+rand()*.6})`;
      c.beginPath();c.arc(x,y,size,0,tau);c.fill();
      if(i%61===0){c.fillStyle=`rgba(${white},.13)`;c.fillRect(x-3,y-.3,6,.6);c.fillRect(x-.3,y-3,.6,6);}
    }
    const cx=width*.51,cy=height*(variant==='hero'?.47:.5);
    const radius=Math.min(width*.48,height*.64);
    const rotation=variant==='map'&&camera?camera.yaw*Math.PI/180:-.48;
    const squash=variant==='map'&&camera?Math.cos(camera.tilt*Math.PI/180):.68;
    c.drawImage(nebula(width,height,cx,cy,radius,colors,rotation,squash),0,0,width,height);
    c.save();c.translate(cx,cy);c.rotate(rotation);c.scale(1,squash);
    const halo=c.createRadialGradient(0,0,0,0,0,radius*1.1);
    halo.addColorStop(0,`rgba(${gold},.11)`);halo.addColorStop(.23,`rgba(${silver},.065)`);halo.addColorStop(1,`rgba(${silver},0)`);
    c.fillStyle=halo;c.fillRect(-radius*1.15,-radius*1.15,radius*2.3,radius*2.3);
    const dust=width<500?3300:6500;
    for(let i=0;i<dust;i++) {
      const r=Math.pow(rand(),.65),spread=(rand()+rand()+rand()-1.5)*(.27+(1-r)*.7);
      const angle=(i%4)*tau/4+r*4.7+spread;
      const offset=(rand()-.5)*radius*.075;
      const x=Math.cos(angle)*r*radius+offset,y=Math.sin(angle)*r*radius+offset*.7;
      const brightness=rand(),size=.2+Math.pow(brightness,3)*.9;
      c.fillStyle=`rgba(${i%5===0?gold:silver},${(.04+brightness*.3)*(1-r*.35)})`;
      c.fillRect(x,y,size,size);
    }
    const core=c.createRadialGradient(0,0,0,0,0,radius*.24);
    core.addColorStop(0,`rgba(${white},.24)`);core.addColorStop(.2,`rgba(${gold},.12)`);core.addColorStop(1,`rgba(${gold},0)`);
    c.fillStyle=core;c.fillRect(-radius*.25,-radius*.25,radius*.5,radius*.5);
    c.restore();
    // An irregular dust lane keeps the field open and gives depth without a disc.
    c.save();c.translate(cx,cy);c.rotate(rotation);
    const lane=c.createLinearGradient(0,-28,0,28);
    lane.addColorStop(0,'transparent');lane.addColorStop(.48,colors.space+'88');lane.addColorStop(1,'transparent');
    c.fillStyle=lane;c.fillRect(-radius,-28,radius*2,56);c.restore();
    return canvas;
  }
  let layoutKey='',layout=[];
  function projected(index,total,width,height,camera) {
    const radius=Math.min(width*.43,height*.6),r=.16+.8*Math.sqrt((index+.5)/total);
    const angle=(index%4)*tau/4+r*4.7+Math.sin(index*21.73)*.17;
    const tilt=camera.tilt*Math.PI/180,rotation=camera.yaw*Math.PI/180;
    const x=Math.cos(angle)*r*radius,y=Math.sin(angle)*r*radius*Math.cos(tilt);
    const z=(Math.sin(angle)*r*radius*Math.sin(tilt)+Math.cos(index*5.7)*20)*camera.depth;
    const scale=900/(900-z),spread=Math.max(1,Math.min(1.16,width/(height*1.55)));
    return {x:(x*Math.cos(rotation)-y*Math.sin(rotation))*scale*spread,y:(x*Math.sin(rotation)+y*Math.cos(rotation))*scale,z,scale,angle};
  }
  function point(index,total,width,height,now,pointerX,pointerY,motion,variant='hero',camera) {
    if(variant==='map'&&camera) {
      const key=[total,width,height,camera.yaw,camera.tilt,camera.depth].join(':');
      if(key!==layoutKey) {
        layoutKey=key;layout=Array.from({length:total},(_,i)=>projected(i,total,width,height,camera));
        const xMax=Math.max(...layout.map(p=>Math.abs(p.x))),yMax=Math.max(...layout.map(p=>Math.abs(p.y)));
        const fit=Math.min(1,width*.43/xMax,height*.39/yMax);
        layout=layout.map(p=>({...p,x:width*.51+p.x*fit,y:height*.47+p.y*fit}));
      }
      return layout[index];
    }
    const radius=Math.min(width*.43,height*(variant==='map'?.6:.55));
    const r=.16+.8*Math.sqrt((index+.5)/total);
    const angle=(index%4)*tau/4+r*4.7+Math.sin(index*21.73)*.17;
    const x=Math.cos(angle)*r*radius,y=Math.sin(angle)*r*radius*.68;
    const z=Math.sin(angle)*r*radius*.4+Math.cos(index*5.7)*16;
    const scale=900/(900-z);
    const rotation=-.48+(motion?pointerX*.065+Math.sin(now*.00011)*.009:0);
    const spread=Math.max(1,Math.min(1.16,width/(height*1.55)));
    return {x:width*.51+(x*Math.cos(rotation)-y*Math.sin(rotation))*scale*spread,
      y:height*.47+(x*Math.sin(rotation)+y*Math.cos(rotation))*scale+(motion?pointerY*z*.055:0),
      z,scale,angle};
  }
  window.AtlasCosmos=Object.freeze({backdrop,point});
})();
