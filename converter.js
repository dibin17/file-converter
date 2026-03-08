// ── DARK MODE ──────────────────────────────────────────
let dark = localStorage.getItem('dibinDark')==='true';
function applyDark(){document.body.classList.toggle('dark',dark);document.getElementById('darkBtn').textContent=dark?'☀️':'🌙'}
function toggleDark(){dark=!dark;localStorage.setItem('dibinDark',dark);applyDark()}
applyDark();

// ── TABS ───────────────────────────────────────────────
function switchTab(name,btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-'+name).classList.add('active');
  if(name==='noise') setTimeout(drawNoiseWaveform,50);
}

// ── TOAST ──────────────────────────────────────────────
let toastT;
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2600);
}

// ── DRAG ZONE HELPERS ──────────────────────────────────
function dragOver(e,id){e.preventDefault();document.getElementById(id).classList.add('over')}
function dragLeave(id){document.getElementById(id).classList.remove('over')}
function dropFiles(e,type){
  e.preventDefault();
  const id={img:'imgDrop',b64:'b64Drop'}[type];
  if(id) dragLeave(id);
  const files=[...e.dataTransfer.files];
  if(type==='img') addImgFilesRaw(files);
  else if(type==='b64') addB64FilesRaw(files);
}

// ── HELPERS ────────────────────────────────────────────
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function fmtSize(b){if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';return(b/1048576).toFixed(2)+' MB'}
function imgExt(fmt){return{png:'png',jpeg:'jpg',webp:'webp',bmp:'bmp'}[fmt.split('/')[1]]||'png'}
function fileEmoji(name){const e=name.split('.').pop().toLowerCase();return{pdf:'📄',png:'🖼️',jpg:'🖼️',jpeg:'🖼️',webp:'🖼️',gif:'🎞️',mp3:'🎵',mp4:'🎬',zip:'🗜️',json:'📋',csv:'📊',xlsx:'📊',docx:'📝',txt:'📃',svg:'🎨'}[e]||'📎'}
function copyEl(id){const v=document.getElementById(id).value;if(!v){toast('Nothing to copy');return}navigator.clipboard.writeText(v).then(()=>toast('✓ Copied'))}

// ══════════════════════════════════════════
// DRAG-TO-REORDER (shared)
// ══════════════════════════════════════════
let dragSrc=null,dragArr=null,dragListId=null;

function makeDraggable(listId,arr,renderFn){
  const list=document.getElementById(listId);
  list.querySelectorAll('.file-row').forEach((row,i)=>{
    row.draggable=true;
    row.addEventListener('dragstart',e=>{dragSrc=i;dragArr=arr;dragListId=listId;row.classList.add('dragging');e.dataTransfer.effectAllowed='move'});
    row.addEventListener('dragend',()=>row.classList.remove('dragging'));
    row.addEventListener('dragover',e=>{e.preventDefault();row.classList.add('drag-over')});
    row.addEventListener('dragleave',()=>row.classList.remove('drag-over'));
    row.addEventListener('drop',e=>{
      e.preventDefault();row.classList.remove('drag-over');
      if(dragSrc===null||dragSrc===i)return;
      const moved=dragArr.splice(dragSrc,1)[0];
      dragArr.splice(i,0,moved);
      dragSrc=null;renderFn();
    });
  });
}

// ══════════════════════════════════════════
// IMAGE CONVERTER
// ══════════════════════════════════════════
let imgFiles=[];
function addImgFiles(e){addImgFilesRaw([...e.target.files]);e.target.value=''}
function addImgFilesRaw(files){files.filter(f=>f.type.startsWith('image/')).forEach(f=>imgFiles.push({file:f,status:'ready',result:null}));renderImgList()}

function renderImgList(){
  const list=document.getElementById('imgList'),bar=document.getElementById('imgActions'),dlAll=document.getElementById('imgDlAll');
  if(!imgFiles.length){list.innerHTML='';bar.style.display='none';return}
  bar.style.display='flex';
  document.getElementById('imgCount').textContent=`${imgFiles.length} file${imgFiles.length!==1?'s':''}`;
  dlAll.style.display=imgFiles.filter(f=>f.status==='done').length>=2?'inline-block':'none';
  list.innerHTML=imgFiles.map((f,i)=>`
    <div class="file-row" id="imgRow${i}">
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <div class="fi">🖼️</div>
      <div class="fi-info"><div class="fi-name">${esc(f.file.name)}</div><div class="fi-meta">${fmtSize(f.file.size)}${f.result?` → ${f.result.name}`:''}</div></div>
      <span class="fi-badge ${f.status}">${f.status==='working'?'⏳ converting…':f.status}</span>
      ${f.result?`<a class="fi-dl" href="${f.result.url}" download="${f.result.name}">↓ Save</a>`:''}
      <span class="fi-rm" onclick="removeFile('img',${i})">✕</span>
    </div>`).join('');
  makeDraggable('imgList',imgFiles,renderImgList);
}

function removeFile(type,i){if(type==='img'){imgFiles.splice(i,1);renderImgList()}else if(type==='b64'){b64Files.splice(i,1);renderB64List()}}
function clearList(type){
  if(type==='img'){imgFiles=[];renderImgList()}
  else if(type==='b64'){b64Files=[];renderB64List()}
}

async function convertAllImages(){
  const fmt=document.getElementById('imgFmt').value;
  const maxW=parseInt(document.getElementById('imgW').value)||null;
  const maxH=parseInt(document.getElementById('imgH').value)||null;
  const quality=0.92;
  const ext=imgExt(fmt);
  let n=0;
  for(let i=0;i<imgFiles.length;i++){
    if(imgFiles[i].status==='done')continue;
    imgFiles[i].status='working';renderImgList();
    try{
      const url=await convertImageCanvas(imgFiles[i].file,fmt,maxW,maxH,quality);
      imgFiles[i].result={url,name:imgFiles[i].file.name.replace(/\.[^.]+$/,'')+'.'+ext};
      imgFiles[i].status='done';n++;
    }catch{imgFiles[i].status='error'}
    renderImgList();
  }
  toast(`✓ Converted ${n} image${n!==1?'s':''} — click ↓ Save`);
}

function convertImageCanvas(file,fmt,maxW,maxH,quality){
  return new Promise((res,rej)=>{
    const img=new Image(),src=URL.createObjectURL(file);
    img.onload=()=>{
      let w=img.width,h=img.height;
      if(maxW&&w>maxW){h=Math.round(h*maxW/w);w=maxW}
      if(maxH&&h>maxH){w=Math.round(w*maxH/h);h=maxH}
      const c=document.createElement('canvas');c.width=w;c.height=h;
      const ctx=c.getContext('2d');
      if(fmt==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h)}
      ctx.drawImage(img,0,0,w,h);URL.revokeObjectURL(src);
      res(c.toDataURL(fmt,quality));
    };
    img.onerror=()=>{URL.revokeObjectURL(src);rej()};img.src=src;
  });
}

function downloadAllImages(){
  imgFiles.filter(f=>f.status==='done'&&f.result).forEach((f,i)=>{
    setTimeout(()=>{const a=document.createElement('a');a.href=f.result.url;a.download=f.result.name;a.click()},i*250);
  });
  toast('↓ Downloading all...');
}

// ══════════════════════════════════════════
// BASE64 TEXT
// ══════════════════════════════════════════
function encodeText(){
  const v=document.getElementById('b64In').value;
  if(!v.trim()){toast('Nothing to encode');return}
  try{document.getElementById('b64Out').value=btoa(unescape(encodeURIComponent(v)));toast('✓ Encoded')}
  catch{toast('Encoding failed')}
}
function decodeText(){
  const v=document.getElementById('b64In').value.trim();
  if(!v){toast('Nothing to decode');return}
  try{document.getElementById('b64Out').value=decodeURIComponent(escape(atob(v)));toast('✓ Decoded')}
  catch{toast('Invalid Base64 — check your input')}
}
function clearB64Text(){document.getElementById('b64In').value='';document.getElementById('b64Out').value=''}

// BASE64 FILE BATCH
let b64Files=[];
function addB64Files(e){addB64FilesRaw([...e.target.files]);e.target.value=''}
function addB64FilesRaw(files){files.forEach(f=>b64Files.push({file:f,status:'ready',result:null}));renderB64List()}

function renderB64List(){
  const list=document.getElementById('b64List'),bar=document.getElementById('b64Actions');
  if(!b64Files.length){list.innerHTML='';bar.style.display='none';return}
  bar.style.display='flex';
  document.getElementById('b64Count').textContent=`${b64Files.length} file${b64Files.length!==1?'s':''}`;
  list.innerHTML=b64Files.map((f,i)=>`
    <div class="file-row">
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <div class="fi">${fileEmoji(f.file.name)}</div>
      <div class="fi-info"><div class="fi-name">${esc(f.file.name)}</div><div class="fi-meta">${fmtSize(f.file.size)}${f.result?` → ${fmtSize(f.result.b64.length)} encoded`:''}</div></div>
      <span class="fi-badge ${f.status}">${f.status==='working'?'⏳ encoding…':f.status}</span>
      ${f.result?`<button class="fi-dl" onclick="copyB64Result(${i})">Copy B64</button><a class="fi-dl blue" style="margin-left:4px" href="${f.result.txtUrl}" download="${esc(f.file.name)}.b64.txt">↓ .txt</a>`:''}
      <span class="fi-rm" onclick="removeFile('b64',${i})">✕</span>
    </div>`).join('');
  makeDraggable('b64List',b64Files,renderB64List);
}

function copyB64Result(i){navigator.clipboard.writeText(b64Files[i].result.b64).then(()=>toast('✓ Copied Base64 string'))}

async function encodeAllFiles(){
  let n=0;
  for(let i=0;i<b64Files.length;i++){
    if(b64Files[i].status==='done')continue;
    b64Files[i].status='working';renderB64List();
    try{
      const b64=await readFileBase64(b64Files[i].file);
      const blob=new Blob([b64],{type:'text/plain'});
      b64Files[i].result={b64,txtUrl:URL.createObjectURL(blob)};
      b64Files[i].status='done';n++;
    }catch{b64Files[i].status='error'}
    renderB64List();
  }
  toast(`✓ Encoded ${n} file${n!==1?'s':''}`);
}

function readFileBase64(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=e=>res(e.target.result.split(',')[1]);
    r.onerror=rej;r.readAsDataURL(file);
  });
}

// ══════════════════════════════════════════
// QR CODE
// ══════════════════════════════════════════
let qrObj=null;
function qrLive(){/* manual generate only */}

function generateQR(){
  const text=document.getElementById('qrInput').value.trim();
  if(!text){toast('Enter some text or a URL first');return}
  const size=Math.max(64,Math.min(1024,parseInt(document.getElementById('qrSize').value)||256));
  const ecc=document.getElementById('qrErr').value;
  const container=document.getElementById('qrCanvas');
  container.innerHTML='';
  try{
    qrObj=new QRCode(container,{text,width:size,height:size,correctLevel:QRCode.CorrectLevel[ecc]});
    container.style.display='block';
    document.getElementById('qrEmpty').style.display='none';
    document.getElementById('qrDlBtn').style.display='inline-block';
    toast('✓ QR code generated');
  }catch(e){toast('Generation failed — try shorter text')}
}

function downloadQR(){
  const fmt=document.getElementById('qrFmt').value;
  const container=document.getElementById('qrCanvas');
  if(fmt==='png'){
    const canvas=container.querySelector('canvas');
    if(!canvas){toast('Generate a QR code first');return}
    const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='qrcode.png';a.click();
    toast('↓ Downloaded PNG');
  } else {
    const img=container.querySelector('img');
    if(!img){toast('Generate a QR code first');return}
    // Create SVG wrapper
    const size=parseInt(document.getElementById('qrSize').value)||256;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><image href="${img.src}" width="${size}" height="${size}"/></svg>`;
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));a.download='qrcode.svg';a.click();
    toast('↓ Downloaded SVG');
  }
}

function clearQR(){
  document.getElementById('qrInput').value='';
  document.getElementById('qrCanvas').innerHTML='';
  document.getElementById('qrCanvas').style.display='none';
  document.getElementById('qrEmpty').style.display='flex';
  document.getElementById('qrDlBtn').style.display='none';
  qrObj=null;
}
// ══════════════════════════════════════════
// AUDIO FX
// ══════════════════════════════════════════
let audioCtx=null,audioBuffer=null,audioFileName='',audioSource=null,isPlaying=false;
let mediaRecorder=null,recChunks=[],recInterval=null,recSeconds=0;

function getAudioCtx(){if(!audioCtx||audioCtx.state==='closed')audioCtx=new(window.AudioContext||window.webkitAudioContext)();return audioCtx}

function dropAudio(e){e.preventDefault();dragLeave('audioDrop');const f=e.dataTransfer.files[0];if(f)loadAudioFileRaw(f)}
function loadAudioFile(e){const f=e.target.files[0];if(f)loadAudioFileRaw(f);e.target.value=''}

function loadAudioFileRaw(file){
  const ctx=getAudioCtx();
  audioFileName=file.name;
  const reader=new FileReader();
  reader.onload=e=>{
    ctx.decodeAudioData(e.target.result.slice(0),buf=>{
      audioBuffer=buf;
      document.getElementById('audioInfo').style.display='block';
      document.getElementById('audioFileName').textContent=file.name;
      const dur=buf.duration;
      document.getElementById('audioFileMeta').textContent=`${fmtDur(dur)} · ${buf.numberOfChannels}ch · ${buf.sampleRate}Hz · ${fmtSize(file.size)}`;
      document.getElementById('playFxBtn').style.display='inline-block';
      drawWaveform(buf);
      toast('✓ Audio loaded');
    },()=>toast('Could not decode audio — try a different file'));
  };
  reader.readAsArrayBuffer(file);
}

function fmtDur(s){const m=Math.floor(s/60);return`${m}:${String(Math.floor(s%60)).padStart(2,'0')}`}

function drawWaveform(buf){
  const canvas=document.getElementById('waveCanvas');
  const W=canvas.offsetWidth||800;canvas.width=W;
  const H=64;const ctx2=canvas.getContext('2d');
  const data=buf.getChannelData(0);
  const step=Math.ceil(data.length/W);
  const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#c0622f';
  ctx2.clearRect(0,0,W,H);
  ctx2.fillStyle=accent+'33';
  for(let i=0;i<W;i++){
    let max=0;for(let j=0;j<step;j++){const v=Math.abs(data[i*step+j]||0);if(v>max)max=v}
    const h=max*(H-4);
    ctx2.fillRect(i,(H-h)/2,1,Math.max(1,h));
  }
}

function togglePlay(){
  if(!audioBuffer)return;
  if(isPlaying){stopAudio();return}
  const ctx=getAudioCtx();
  audioSource=ctx.createBufferSource();
  audioSource.buffer=audioBuffer;
  audioSource.connect(ctx.destination);
  audioSource.start();
  isPlaying=true;
  document.getElementById('playBtn').textContent='⏹ Stop';
  audioSource.onended=()=>{isPlaying=false;document.getElementById('playBtn').textContent='▶ Play Original'};
}

function stopAudio(){
  if(audioSource){try{audioSource.stop()}catch(e){}audioSource=null}
  isPlaying=false;
  document.getElementById('playBtn').textContent='▶ Play Original';
}

function updateFX(){
  document.querySelectorAll('.fx-card').forEach(c=>{
    const cb=c.querySelector('input[type=checkbox]');
    if(cb)c.classList.toggle('active',cb.checked);
  });
  // live update echo feedback label
  const fb=document.getElementById('fxEchoFeedback');
  if(fb)document.getElementById('fxEchoFbLabel').textContent=Math.round(fb.value*100)+'%';
}

function updateSliderLabel(el,labelId,unit){
  const v=parseFloat(el.value);
  document.getElementById(labelId).textContent=v+unit;
}

function resetFX(){
  document.querySelectorAll('.fx-card input[type=checkbox]').forEach(cb=>cb.checked=false);
  document.getElementById('fxReverbAmt').value=2;document.getElementById('fxReverbLabel').textContent='2.0s';
  document.getElementById('fxEchoDelay').value=0.3;document.getElementById('fxEchoLabel').textContent='0.3s';
  document.getElementById('fxEchoFeedback').value=0.4;document.getElementById('fxEchoFbLabel').textContent='40%';
  document.getElementById('fxPitchAmt').value=0;document.getElementById('fxPitchLabel').textContent='0 st';
  document.getElementById('fxSpeedAmt').value=1;document.getElementById('fxSpeedLabel').textContent='1x';
  document.getElementById('fxDistortAmt').value=100;document.getElementById('fxDistortLabel').textContent='100';
  document.getElementById('fxPixelAmt').value=8;document.getElementById('fxPixelLabel').textContent='8 bit';
  document.getElementById('fxLowAmt').value=800;document.getElementById('fxLowLabel').textContent='800 Hz';
  document.getElementById('fxHighAmt').value=1000;document.getElementById('fxHighLabel').textContent='1000 Hz';
  document.getElementById('fxUnreverbAmt').value=1500;document.getElementById('fxUnreverbLabel').textContent='1500 Hz';
  document.getElementById('fxBassAmt').value=8;document.getElementById('fxBassLabel').textContent='8 dB';
  document.getElementById('fxChorusAmt').value=2;document.getElementById('fxChorusLabel').textContent='2 Hz';
  updateFX();toast('FX reset');
}

function clearAudio(){
  stopAudio();audioBuffer=null;audioFileName='';
  document.getElementById('audioInfo').style.display='none';
  document.getElementById('renderStatus').textContent='';
}

// ── LIVE PREVIEW ──────────────────────────────────────
function playWithFX(){
  if(!audioBuffer)return;
  stopAudio();
  const ctx=getAudioCtx();
  // Apply speed / pitch (playbackRate)
  const speedOn=document.getElementById('fxSpeedOn').checked;
  const pitchOn=document.getElementById('fxPitchOn').checked;
  const speed=speedOn?parseFloat(document.getElementById('fxSpeedAmt').value):1;
  const semitones=pitchOn?parseInt(document.getElementById('fxPitchAmt').value):0;
  const pitchRate=Math.pow(2,semitones/12);

  let buf=audioBuffer;

  // Reverse in place (clone first)
  if(document.getElementById('fxReverseOn').checked){
    buf=cloneReverse(buf);
  }

  const src=ctx.createBufferSource();
  src.buffer=buf;
  src.playbackRate.value=speed*pitchRate;

  let chain=src;

  // Bass boost
  if(document.getElementById('fxBassOn').checked){
    const bass=ctx.createBiquadFilter();
    bass.type='lowshelf';bass.frequency.value=200;
    bass.gain.value=parseFloat(document.getElementById('fxBassAmt').value);
    chain.connect(bass);chain=bass;
  }
  // Low-pass
  if(document.getElementById('fxLowOn').checked){
    const lp=ctx.createBiquadFilter();
    lp.type='lowpass';lp.frequency.value=parseFloat(document.getElementById('fxLowAmt').value);
    chain.connect(lp);chain=lp;
  }
  // High-pass
  if(document.getElementById('fxHighOn').checked){
    const hp=ctx.createBiquadFilter();
    hp.type='highpass';hp.frequency.value=parseFloat(document.getElementById('fxHighAmt').value);
    chain.connect(hp);chain=hp;
  }
  // Un-reverb (highpass + aggressive compression)
  if(document.getElementById('fxUnreverbOn').checked){
    const ur=ctx.createBiquadFilter();
    ur.type='highpass';ur.frequency.value=parseFloat(document.getElementById('fxUnreverbAmt').value);
    const comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-30;comp.knee.value=6;comp.ratio.value=20;comp.attack.value=0.001;comp.release.value=0.05;
    chain.connect(ur);ur.connect(comp);chain=comp;
  }
  // Distortion
  if(document.getElementById('fxDistortOn').checked){
    const dist=ctx.createWaveShaper();
    dist.curve=makeDistortionCurve(parseFloat(document.getElementById('fxDistortAmt').value));
    dist.oversample='4x';
    chain.connect(dist);chain=dist;
  }
  // Echo
  if(document.getElementById('fxEchoOn').checked){
    const delay=ctx.createDelay(2);
    const fb=ctx.createGain();
    delay.delayTime.value=parseFloat(document.getElementById('fxEchoDelay').value);
    fb.gain.value=parseFloat(document.getElementById('fxEchoFeedback').value);
    chain.connect(delay);delay.connect(fb);fb.connect(delay);
    const mix=ctx.createGain();mix.gain.value=1;
    chain.connect(mix);delay.connect(mix);chain=mix;
  }
  // Reverb
  if(document.getElementById('fxReverbOn').checked){
    const conv=ctx.createConvolver();
    conv.buffer=makeImpulse(ctx,parseFloat(document.getElementById('fxReverbAmt').value));
    const wet=ctx.createGain();wet.gain.value=0.6;
    const dry=ctx.createGain();dry.gain.value=0.4;
    chain.connect(dry);chain.connect(conv);conv.connect(wet);
    const merge=ctx.createGain();dry.connect(merge);wet.connect(merge);chain=merge;
  }
  // Chorus
  if(document.getElementById('fxChorusOn').checked){
    const delay2=ctx.createDelay(0.03);
    delay2.delayTime.value=0.02;
    const osc=ctx.createOscillator();
    const oscGain=ctx.createGain();
    osc.frequency.value=parseFloat(document.getElementById('fxChorusAmt').value);
    oscGain.gain.value=0.003;
    osc.connect(oscGain);oscGain.connect(delay2.delayTime);osc.start();
    const mix2=ctx.createGain();
    chain.connect(delay2);delay2.connect(mix2);chain.connect(mix2);chain=mix2;
  }

  chain.connect(ctx.destination);
  src.start();audioSource=src;isPlaying=true;
  document.getElementById('playBtn').textContent='⏹ Stop';
  src.onended=()=>{isPlaying=false;document.getElementById('playBtn').textContent='▶ Play Original'};
}

// ── RENDER TO FILE ────────────────────────────────────
async function renderAndDownload(){
  if(!audioBuffer){toast('Load or record audio first');return}
  const btn=document.getElementById('renderBtn');
  const status=document.getElementById('renderStatus');
  btn.textContent='⏳ Rendering...';btn.disabled=true;
  status.textContent='Processing...';

  try{
    const speedOn=document.getElementById('fxSpeedOn').checked;
    const pitchOn=document.getElementById('fxPitchOn').checked;
    const speed=speedOn?parseFloat(document.getElementById('fxSpeedAmt').value):1;
    const semitones=pitchOn?parseInt(document.getElementById('fxPitchAmt').value):0;
    const pitchRate=Math.pow(2,semitones/12);
    const playbackRate=speed*pitchRate;

    let srcBuf=audioBuffer;
    if(document.getElementById('fxReverseOn').checked) srcBuf=cloneReverse(srcBuf);

    // Bitcrush (pixelate) — do offline on raw samples
    if(document.getElementById('fxPixelOn').checked){
      srcBuf=bitcrush(srcBuf,parseInt(document.getElementById('fxPixelAmt').value));
    }

    const duration=srcBuf.duration/playbackRate+3; // +3s tail for reverb/echo
    const offCtx=new OfflineAudioContext(srcBuf.numberOfChannels,Math.ceil(duration*srcBuf.sampleRate),srcBuf.sampleRate);

    const src=offCtx.createBufferSource();
    src.buffer=srcBuf;src.playbackRate.value=playbackRate;

    let chain=src;

    if(document.getElementById('fxBassOn').checked){
      const bass=offCtx.createBiquadFilter();bass.type='lowshelf';bass.frequency.value=200;
      bass.gain.value=parseFloat(document.getElementById('fxBassAmt').value);
      chain.connect(bass);chain=bass;
    }
    if(document.getElementById('fxLowOn').checked){
      const lp=offCtx.createBiquadFilter();lp.type='lowpass';
      lp.frequency.value=parseFloat(document.getElementById('fxLowAmt').value);
      chain.connect(lp);chain=lp;
    }
    if(document.getElementById('fxHighOn').checked){
      const hp=offCtx.createBiquadFilter();hp.type='highpass';
      hp.frequency.value=parseFloat(document.getElementById('fxHighAmt').value);
      chain.connect(hp);chain=hp;
    }
    if(document.getElementById('fxUnreverbOn').checked){
      const ur=offCtx.createBiquadFilter();ur.type='highpass';
      ur.frequency.value=parseFloat(document.getElementById('fxUnreverbAmt').value);
      const comp=offCtx.createDynamicsCompressor();
      comp.threshold.value=-30;comp.knee.value=6;comp.ratio.value=20;comp.attack.value=0.001;comp.release.value=0.05;
      chain.connect(ur);ur.connect(comp);chain=comp;
    }
    if(document.getElementById('fxDistortOn').checked){
      const dist=offCtx.createWaveShaper();
      dist.curve=makeDistortionCurve(parseFloat(document.getElementById('fxDistortAmt').value));
      dist.oversample='4x';chain.connect(dist);chain=dist;
    }
    if(document.getElementById('fxEchoOn').checked){
      const delay=offCtx.createDelay(2);const fb=offCtx.createGain();
      delay.delayTime.value=parseFloat(document.getElementById('fxEchoDelay').value);
      fb.gain.value=parseFloat(document.getElementById('fxEchoFeedback').value);
      chain.connect(delay);delay.connect(fb);fb.connect(delay);
      const mix=offCtx.createGain();chain.connect(mix);delay.connect(mix);chain=mix;
    }
    if(document.getElementById('fxReverbOn').checked){
      const conv=offCtx.createConvolver();
      conv.buffer=makeImpulse(offCtx,parseFloat(document.getElementById('fxReverbAmt').value));
      const wet=offCtx.createGain();wet.gain.value=0.6;
      const dry=offCtx.createGain();dry.gain.value=0.4;
      chain.connect(dry);chain.connect(conv);conv.connect(wet);
      const merge=offCtx.createGain();dry.connect(merge);wet.connect(merge);chain=merge;
    }
    if(document.getElementById('fxChorusOn').checked){
      const d=offCtx.createDelay(0.03);d.delayTime.value=0.02;
      const osc=offCtx.createOscillator();const og=offCtx.createGain();og.gain.value=0.003;
      osc.frequency.value=parseFloat(document.getElementById('fxChorusAmt').value);
      osc.connect(og);og.connect(d.delayTime);osc.start();
      const m=offCtx.createGain();chain.connect(d);d.connect(m);chain.connect(m);chain=m;
    }

    chain.connect(offCtx.destination);
    src.start(0);

    const rendered=await offCtx.startRendering();
    const wav=bufferToWav(rendered);
    const blob=new Blob([wav],{type:'audio/wav'});
    const base=audioFileName.replace(/\.[^.]+$/,'');
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=base+'_fx.wav';a.click();
    status.textContent='✓ Done!';toast('↓ Downloaded WAV');
  }catch(e){
    console.error(e);status.textContent='Error — try fewer effects';toast('Render failed');
  }
  btn.textContent='⚡ Render & Download';btn.disabled=false;
}

// ── AUDIO UTILS ───────────────────────────────────────
function cloneReverse(buf){
  const out=new AudioBuffer({length:buf.length,numberOfChannels:buf.numberOfChannels,sampleRate:buf.sampleRate});
  for(let c=0;c<buf.numberOfChannels;c++){
    const d=buf.getChannelData(c).slice().reverse();
    out.copyToChannel(d,c);
  }
  return out;
}

function bitcrush(buf,bits){
  const steps=Math.pow(2,bits);
  const out=new AudioBuffer({length:buf.length,numberOfChannels:buf.numberOfChannels,sampleRate:buf.sampleRate});
  for(let c=0;c<buf.numberOfChannels;c++){
    const d=buf.getChannelData(c);const o=new Float32Array(d.length);
    for(let i=0;i<d.length;i++) o[i]=Math.round(d[i]*steps)/steps;
    out.copyToChannel(o,c);
  }
  return out;
}

function makeDistortionCurve(amount){
  const n=256,curve=new Float32Array(n);
  for(let i=0;i<n;i++){const x=i*2/n-1;curve[i]=(Math.PI+amount)*x/(Math.PI+amount*Math.abs(x))}
  return curve;
}

function makeImpulse(ctx,duration){
  const sr=ctx.sampleRate,len=Math.floor(sr*duration),buf=ctx.createBuffer(2,len,sr);
  for(let c=0;c<2;c++){const d=buf.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2)}
  return buf;
}

// ── WAV ENCODER ───────────────────────────────────────
function bufferToWav(buf){
  const nCh=buf.numberOfChannels,sr=buf.sampleRate,len=buf.length;
  const out=new Int16Array(len*nCh);
  for(let c=0;c<nCh;c++){const d=buf.getChannelData(c);for(let i=0;i<len;i++)out[i*nCh+c]=Math.max(-32768,Math.min(32767,d[i]*32768))}
  const hdr=new ArrayBuffer(44);const v=new DataView(hdr);
  const write=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  write(0,'RIFF');v.setUint32(4,36+out.byteLength,true);write(8,'WAVE');
  write(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,nCh,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*nCh*2,true);v.setUint16(32,nCh*2,true);v.setUint16(34,16,true);
  write(36,'data');v.setUint32(40,out.byteLength,true);
  const final=new Uint8Array(44+out.byteLength);
  final.set(new Uint8Array(hdr));final.set(new Uint8Array(out.buffer),44);
  return final;
}

// ── MICROPHONE RECORDER ───────────────────────────────
async function toggleRecord(){
  if(mediaRecorder&&mediaRecorder.state==='recording'){
    mediaRecorder.stop();clearInterval(recInterval);
    document.getElementById('recBtn').textContent='⏺ Record';
    document.getElementById('recBtn').classList.remove('recording');
    return;
  }
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    recChunks=[];recSeconds=0;
    mediaRecorder=new MediaRecorder(stream);
    mediaRecorder.ondataavailable=e=>{if(e.data.size>0)recChunks.push(e.data)};
    mediaRecorder.onstop=()=>{
      stream.getTracks().forEach(t=>t.stop());
      const blob=new Blob(recChunks,{type:'audio/webm'});
      const url=URL.createObjectURL(blob);
      audioFileName='recording.webm';
      fetch(url).then(r=>r.arrayBuffer()).then(ab=>{
        const ctx=getAudioCtx();
        ctx.decodeAudioData(ab,buf=>{
          audioBuffer=buf;
          document.getElementById('audioInfo').style.display='block';
          document.getElementById('audioFileName').textContent='🎤 recording.webm';
          document.getElementById('audioFileMeta').textContent=`${fmtDur(buf.duration)} · ${buf.numberOfChannels}ch · ${buf.sampleRate}Hz`;
          document.getElementById('playFxBtn').style.display='inline-block';
          drawWaveform(buf);toast('✓ Recording loaded');
        },()=>toast('Could not decode recording'));
      });
    };
    mediaRecorder.start();
    document.getElementById('recBtn').textContent='⏹ Stop';
    document.getElementById('recBtn').classList.add('recording');
    recInterval=setInterval(()=>{recSeconds++;document.getElementById('recTimer').textContent=fmtDur(recSeconds)},1000);
  }catch(e){toast('Microphone access denied')}
}
// ══════════════════════════════════════════
// STEGANOGRAPHY
// Uses LSB (Least Significant Bit) encoding:
// Each pixel's R,G,B channels each store 1 bit
// of the message, making changes invisible to
// the human eye. 3 bits per pixel.
// ══════════════════════════════════════════
let stegImageData=null, stegOrigFile=null, stegRevealData=null;

function switchSteg(mode){
  document.getElementById('stegHidePanel').style.display=mode==='hide'?'block':'none';
  document.getElementById('stegRevealPanel').style.display=mode==='reveal'?'block':'none';
  document.getElementById('stegHideBtn').classList.toggle('active',mode==='hide');
  document.getElementById('stegRevealBtn').classList.toggle('active',mode==='reveal');
}

function dropSteg(e){e.preventDefault();dragLeave('stegDrop');const f=e.dataTransfer.files[0];if(f)loadStegImageRaw(f)}
function loadStegImage(e){loadStegImageRaw(e.target.files[0]);e.target.value=''}
function dropStegReveal(e){e.preventDefault();dragLeave('stegRevealDrop');const f=e.dataTransfer.files[0];if(f)loadStegRevealRaw(f)}
function loadStegReveal(e){loadStegRevealRaw(e.target.files[0]);e.target.value=''}

function loadStegImageRaw(file){
  stegOrigFile=file;
  const img=new Image();
  const url=URL.createObjectURL(file);
  img.onload=()=>{
    // Draw to original canvas
    const canvas=document.getElementById('stegCanvas');
    canvas.width=img.width;canvas.height=img.height;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,0,0);
    stegImageData=ctx.getImageData(0,0,img.width,img.height);
    // Mirror to preview canvas (starts identical)
    const prev=document.getElementById('stegPreviewCanvas');
    prev.width=img.width;prev.height=img.height;
    prev.getContext('2d').drawImage(img,0,0);
    URL.revokeObjectURL(url);
    const maxChars=Math.floor((img.width*img.height*3)/8)-4;
    document.getElementById('stegInfo').innerHTML=
      `<strong>${esc(file.name)}</strong>
       ${img.width} × ${img.height}px<br>
       Max message: <span style="color:var(--accent)">${maxChars.toLocaleString()} chars</span><br>
       ${fmtSize(file.size)}`;
    document.getElementById('stegHideControls').style.display='block';
    toast('✓ Image loaded');
  };
  img.src=url;
}

let stegPreviewRaf=null;
function stegLivePreview(){
  if(!stegImageData) return;
  if(stegPreviewRaf) cancelAnimationFrame(stegPreviewRaf);
  stegPreviewRaf=requestAnimationFrame(()=>{
    let msg=document.getElementById('stegMsg').value;
    const pass=document.getElementById('stegPass').value;
    const badge=document.getElementById('stegPreviewBadge');
    const prev=document.getElementById('stegPreviewCanvas');
    if(!msg.trim()){
      // Restore original
      prev.width=stegImageData.width;prev.height=stegImageData.height;
      prev.getContext('2d').putImageData(stegImageData,0,0);
      badge.style.display='none';
      stegPreviewRaf=null;return;
    }
    if(pass) msg=xorCipher(msg,pass);
    const len=msg.length;
    const header=String.fromCharCode((len>>24)&0xFF,(len>>16)&0xFF,(len>>8)&0xFF,len&0xFF);
    const full=header+msg+'\0';
    const maxChars=Math.floor((stegImageData.width*stegImageData.height*3)/8)-4;
    if(msg.length>maxChars){badge.style.display='none';stegPreviewRaf=null;return}
    const bits=strToBits(full);
    const data=new Uint8ClampedArray(stegImageData.data);
    let bitIdx=0;
    for(let i=0;i<data.length&&bitIdx<bits.length;i++){
      if((i+1)%4===0) continue;
      data[i]=(data[i]&0xFE)|bits[bitIdx++];
    }
    prev.width=stegImageData.width;prev.height=stegImageData.height;
    prev.getContext('2d').putImageData(new ImageData(data,stegImageData.width,stegImageData.height),0,0);
    badge.style.display='inline';
    stegPreviewRaf=null;
  });
}

function loadStegRevealRaw(file){
  const img=new Image();
  const url=URL.createObjectURL(file);
  img.onload=()=>{
    const c=document.createElement('canvas');
    c.width=img.width;c.height=img.height;
    const ctx=c.getContext('2d');
    ctx.drawImage(img,0,0);
    stegRevealData=ctx.getImageData(0,0,img.width,img.height);
    URL.revokeObjectURL(url);
    document.getElementById('stegRevealControls').style.display='block';
    document.getElementById('stegRevealResult').style.display='none';
    toast('✓ Image loaded — click Reveal Message');
  };
  img.src=url;
}

// Simple XOR cipher with password
function xorCipher(str, pass){
  if(!pass) return str;
  return str.split('').map((c,i)=>
    String.fromCharCode(c.charCodeAt(0)^pass.charCodeAt(i%pass.length))
  ).join('');
}

// Encode string to bits array
function strToBits(str){
  const bits=[];
  for(let i=0;i<str.length;i++){
    const code=str.charCodeAt(i);
    for(let b=7;b>=0;b--) bits.push((code>>b)&1);
  }
  return bits;
}

// Decode bits array back to string
function bitsToStr(bits){
  let str='';
  for(let i=0;i+7<bits.length;i+=8){
    let code=0;
    for(let b=0;b<8;b++) code=(code<<1)|bits[i+b];
    if(code===0) break; // null terminator
    str+=String.fromCharCode(code);
  }
  return str;
}

function hideMessage(){
  if(!stegImageData){toast('Load an image first');return}
  let msg=document.getElementById('stegMsg').value;
  const pass=document.getElementById('stegPass').value;
  if(!msg.trim()){toast('Enter a message to hide');return}

  if(pass) msg=xorCipher(msg,pass);

  // Prepend 4-byte length header so we know how much to read back
  const len=msg.length;
  const header=String.fromCharCode((len>>24)&0xFF,(len>>16)&0xFF,(len>>8)&0xFF,len&0xFF);
  const full=header+msg+'\0';

  const maxChars=Math.floor((stegImageData.width*stegImageData.height*3)/8)-4;
  if(msg.length>maxChars){toast(`Message too long! Max ${maxChars} chars for this image`);return}

  const bits=strToBits(full);
  const data=new Uint8ClampedArray(stegImageData.data);
  let bitIdx=0;

  for(let i=0;i<data.length&&bitIdx<bits.length;i++){
    // Skip alpha channel (every 4th byte)
    if((i+1)%4===0) continue;
    // Set LSB of this channel to our bit
    data[i]=(data[i]&0xFE)|bits[bitIdx++];
  }

  // Write to canvas and download
  const canvas=document.createElement('canvas');
  canvas.width=stegImageData.width;canvas.height=stegImageData.height;
  const ctx=canvas.getContext('2d');
  ctx.putImageData(new ImageData(data,stegImageData.width,stegImageData.height),0,0);

  const baseName=stegOrigFile.name.replace(/\.[^.]+$/,'');
  const a=document.createElement('a');
  a.href=canvas.toDataURL('image/png');
  a.download=baseName+'_secret.png';
  a.click();

  document.getElementById('stegHideStatus').textContent=`✓ Message hidden (${msg.length} chars)`;
  toast('🔒 Message hidden & downloaded!');
}

function revealMessage(){
  if(!stegRevealData){toast('Load an image first');return}
  const pass=document.getElementById('stegRevealPass').value;
  const data=stegRevealData.data;
  const bits=[];

  for(let i=0;i<data.length;i++){
    if((i+1)%4===0) continue;
    bits.push(data[i]&1);
  }

  // Read 4-byte length header first
  const headerBits=bits.slice(0,32);
  let len=0;
  for(let i=0;i<32;i++) len=(len<<1)|headerBits[i];

  if(len<=0||len>500000){
    document.getElementById('stegRevealResult').style.display='block';
    document.getElementById('stegRevealText').textContent='No hidden message found (or wrong image format).';
    return;
  }

  // Read message bits
  const msgBits=bits.slice(32,32+(len+1)*8);
  let msg=bitsToStr(msgBits);
  if(pass) msg=xorCipher(msg,pass);

  document.getElementById('stegRevealResult').style.display='block';
  document.getElementById('stegRevealText').textContent=msg;
  toast('🔓 Message revealed!');
}

function copyStegResult(){
  const txt=document.getElementById('stegRevealText').textContent;
  navigator.clipboard.writeText(txt).then(()=>toast('✓ Copied'));
}

function clearSteg(){
  stegImageData=null;stegOrigFile=null;
  document.getElementById('stegHideControls').style.display='none';
  document.getElementById('stegMsg').value='';
  document.getElementById('stegPass').value='';
  document.getElementById('stegHideStatus').textContent='';
  document.getElementById('stegPreviewBadge').style.display='none';
  const c=document.getElementById('stegCanvas');c.width=0;c.height=0;
  const p=document.getElementById('stegPreviewCanvas');p.width=0;p.height=0;
  toast('Cleared');
}

// ══════════════════════════════════════════
// FILTER STUDIO
// ══════════════════════════════════════════
let filterImg=null,filterRaf=null;

function dropFilter(e){e.preventDefault();dragLeave('filterDrop');const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))loadFilterImageRaw(f)}
function loadFilterImage(e){const f=e.target.files[0];if(f)loadFilterImageRaw(f);e.target.value=''}

function loadFilterImageRaw(file){
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.crossOrigin='anonymous';
  img.onload=()=>{
    // Draw to offscreen canvas first to avoid taint issues
    const off=document.createElement('canvas');
    off.width=img.width;off.height=img.height;
    off.getContext('2d').drawImage(img,0,0);
    filterImg=off;
    URL.revokeObjectURL(url);
    document.getElementById('filterWorkspace').style.display='block';
    applyFilters();
    toast('✓ Image loaded');
  };
  img.src=url;
}

function updateNoiseChecked(){
  document.querySelectorAll('.noise-type-btn').forEach(lbl=>{
    lbl.classList.toggle('checked',lbl.querySelector('input').checked);
  });
}

function applyFilters(){
  if(!filterImg)return;
  if(filterRaf)cancelAnimationFrame(filterRaf);
  filterRaf=requestAnimationFrame(()=>{
    const g=id=>document.getElementById(id).value;
    const bright=g('fBright'),contrast=g('fContrast'),saturate=g('fSaturate'),hue=g('fHue');
    const blur=g('fBlur'),opacity=g('fOpacity'),gray=g('fGray'),invert=g('fInvert'),sepia=g('fSepia');
    const sx=g('fStretchX')/100,sy=g('fStretchY')/100,rot=g('fRotate');
    const pixelate=parseInt(g('fPixelate'));
    const lbl={brightVal:bright+'%',contrastVal:contrast+'%',saturateVal:saturate+'%',hueVal:hue+'°',
      blurVal:blur+'px',opacityVal:opacity+'%',grayVal:gray+'%',invertVal:invert+'%',sepiaVal:sepia+'%',
      stretchXVal:Math.round(sx*100)+'%',stretchYVal:Math.round(sy*100)+'%',rotateVal:rot+'°',
      pixelateVal:pixelate===0?'off':pixelate+'%'};
    Object.entries(lbl).forEach(([id,v])=>document.getElementById(id).textContent=v);
    const W=Math.round(filterImg.width*sx),H=Math.round(filterImg.height*sy);
    const rad=rot*Math.PI/180;
    const cW=Math.round(W*Math.abs(Math.cos(rad))+H*Math.abs(Math.sin(rad)));
    const cH=Math.round(W*Math.abs(Math.sin(rad))+H*Math.abs(Math.cos(rad)));
    const canvas=document.getElementById('filterCanvas');
    canvas.width=cW;canvas.height=cH;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,cW,cH);ctx.save();ctx.translate(cW/2,cH/2);ctx.rotate(rad);
    ctx.filter=`brightness(${bright}%) contrast(${contrast}%) saturate(${saturate}%) hue-rotate(${hue}deg) blur(${blur}px) opacity(${opacity}%) grayscale(${gray}%) invert(${invert}%) sepia(${sepia}%)`;
    if(pixelate>0){
      // Draw small then scale up with no smoothing = pixelation
      const blockSize=Math.max(1,Math.round(pixelate*0.8));
      const smallW=Math.max(1,Math.round(W/blockSize));
      const smallH=Math.max(1,Math.round(H/blockSize));
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(filterImg,-W/2,-H/2,smallW,smallH);
      ctx.filter='none';
      ctx.drawImage(canvas,cW/2-W/2,cH/2-H/2,smallW,smallH,- W/2,-H/2,W,H);
    } else {
      ctx.drawImage(filterImg,-W/2,-H/2,W,H);
    }
    ctx.restore();filterRaf=null;
  });
}

function setSliders(vals){Object.entries(vals).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v})}

function applyPreset(name){
  setSliders({fBright:100,fContrast:100,fSaturate:100,fHue:0,fBlur:0,fOpacity:100,fGray:0,fInvert:0,fSepia:0,fStretchX:100,fStretchY:100,fRotate:0,fPixelate:0});
  if(name==='grayscale') setSliders({fGray:100,fSaturate:0});
  else if(name==='sepia') setSliders({fSepia:100,fSaturate:60,fBright:110});
  else if(name==='vivid') setSliders({fSaturate:250,fContrast:120,fBright:110});
  else if(name==='cold') setSliders({fHue:200,fSaturate:80,fBright:95});
  else if(name==='warm') setSliders({fHue:20,fSaturate:130,fBright:110,fSepia:20});
  else if(name==='nightmare') setSliders({fInvert:100,fHue:180,fSaturate:200,fContrast:150});
  else if(name==='deep-fry') setSliders({fBright:160,fContrast:300,fSaturate:300,fBlur:0.5,fPixelate:20});
  else if(name==='stretch') setSliders({fStretchX:200,fStretchY:50});
  applyFilters();toast('Preset applied');
}

function resetFilters(){
  setSliders({fBright:100,fContrast:100,fSaturate:100,fHue:0,fBlur:0,fOpacity:100,fGray:0,fInvert:0,fSepia:0,fStretchX:100,fStretchY:100,fRotate:0,fPixelate:0});
  applyFilters();toast('Filters reset');
}

function downloadFilteredImage(){
  const canvas=document.getElementById('filterCanvas');
  const fmt=document.getElementById('filterFmt').value;
  const ext=fmt.split('/')[1].replace('jpeg','jpg');
  const a=document.createElement('a');a.href=canvas.toDataURL(fmt,0.92);a.download='filtered.'+ext;a.click();
  toast('↓ Downloaded');
}

function clearFilterImage(){
  filterImg=null;
  document.getElementById('filterWorkspace').style.display='none';
  const c=document.getElementById('filterCanvas');c.width=0;c.height=0;
}


// ══════════════════════════════════════════
// METADATA STRIPPER
// Parses EXIF binary data from JPEG/TIFF/WebP
// manually — no library needed.
// ══════════════════════════════════════════
let metaFiles=[];

function dropMeta(e){e.preventDefault();dragLeave('metaDrop');loadMetaFilesRaw([...e.dataTransfer.files])}
function loadMetaFiles(e){loadMetaFilesRaw([...e.target.files]);e.target.value=''}
function loadMetaFilesRaw(files){
  files.forEach(f=>metaFiles.push({file:f,exif:null}));
  metaFiles.forEach((m,i)=>{if(!m.exif)readExif(m.file,i)});
  document.getElementById('metaResults').style.display='block';
}

// ── EXIF TAG NAMES ──────────────────────────────────
const EXIF_TAGS={
  0x010F:'Make',0x0110:'Model',0x0112:'Orientation',
  0x011A:'XResolution',0x011B:'YResolution',0x0128:'ResolutionUnit',
  0x0131:'Software',0x0132:'DateTime',0x013B:'Artist',
  0x8298:'Copyright',0x8769:'ExifIFD',0x8825:'GPSIFD',
  0x9000:'ExifVersion',0x9003:'DateTimeOriginal',0x9004:'DateTimeDigitized',
  0x9201:'ShutterSpeedValue',0x9202:'ApertureValue',0x9203:'BrightnessValue',
  0x9204:'ExposureBiasValue',0x9205:'MaxApertureValue',
  0x9207:'MeteringMode',0x9208:'LightSource',0x9209:'Flash',
  0x920A:'FocalLength',0xA000:'FlashPixVersion',0xA001:'ColorSpace',
  0xA002:'PixelXDimension',0xA003:'PixelYDimension',
  0xA20E:'FocalPlaneXResolution',0xA20F:'FocalPlaneYResolution',
  0xA210:'FocalPlaneResolutionUnit',0xA401:'CustomRendered',
  0xA402:'ExposureMode',0xA403:'WhiteBalance',0xA404:'DigitalZoomRatio',
  0xA405:'FocalLengthIn35mmFilm',0xA406:'SceneCaptureType',
  0xA430:'CameraOwnerName',0xA431:'BodySerialNumber',
  0xA432:'LensSpecification',0xA433:'LensMake',0xA434:'LensModel',
  0xA435:'LensSerialNumber',
  // GPS tags (read from GPS IFD)
  0x0000:'GPSVersionID',0x0001:'GPSLatitudeRef',0x0002:'GPSLatitude',
  0x0003:'GPSLongitudeRef',0x0004:'GPSLongitude',0x0005:'GPSAltitudeRef',
  0x0006:'GPSAltitude',0x0007:'GPSTimeStamp',0x0008:'GPSSatellites',
  0x0009:'GPSStatus',0x000A:'GPSMeasureMode',0x000B:'GPSDOP',
  0x000C:'GPSSpeedRef',0x000D:'GPSSpeed',0x001D:'GPSDateStamp',
  0x0012:'GPSMapDatum',
};

const GPS_TAGS=new Set(['GPSLatitude','GPSLongitude','GPSLatitudeRef','GPSLongitudeRef','GPSAltitude','GPSAltitudeRef','GPSTimeStamp','GPSDateStamp','GPSSatellites','GPSSpeed','GPSMapDatum','GPSDOP']);
const DEVICE_TAGS=new Set(['Make','Model','BodySerialNumber','LensMake','LensModel','LensSerialNumber','CameraOwnerName','Software']);

function readExif(file, idx){
  const reader=new FileReader();
  reader.onload=e=>{
    const buf=e.target.result;
    const tags=parseExif(buf,file.type);
    metaFiles[idx].exif=tags;
    renderMetaList();
  };
  reader.readAsArrayBuffer(file);
}

function parseExif(buf, mimeType){
  const view=new DataView(buf);
  const tags={};

  // Find EXIF APP1 marker in JPEG (FF E1)
  if(mimeType==='image/jpeg'||mimeType==='image/jpg'){
    let offset=2;
    while(offset<view.byteLength-2){
      const marker=view.getUint16(offset);
      const segLen=view.getUint16(offset+2);
      if(marker===0xFFE1){
        // Check for "Exif\0\0" header
        const exifHeader=String.fromCharCode(...new Uint8Array(buf,offset+4,6));
        if(exifHeader.startsWith('Exif')){
          readTiffBlock(view, offset+10, tags);
        }
      }
      offset+=2+segLen;
    }
  } else if(mimeType==='image/tiff'){
    readTiffBlock(view, 0, tags);
  } else if(mimeType==='image/webp'){
    // WebP EXIF chunk: look for "EXIF" chunk marker
    let o=12;
    while(o<view.byteLength-8){
      const chunk=String.fromCharCode(...new Uint8Array(buf,o,4));
      const size=view.getUint32(o+4,true);
      if(chunk==='EXIF'){
        const exifStart=o+8;
        readTiffBlock(view, exifStart, tags);
        break;
      }
      o+=8+size+(size%2);
    }
  }
  return tags;
}

function readTiffBlock(view, tiffStart, tags){
  let little;
  try{
    const order=view.getUint16(tiffStart);
    little=(order===0x4949); // II = little endian, MM = big endian
    const ifdOffset=view.getUint32(tiffStart+4,little);
    readIFD(view,tiffStart,tiffStart+ifdOffset,little,tags,false);
  }catch(e){}
}

function readIFD(view, tiffStart, ifdOffset, little, tags, isGps){
  try{
    const count=view.getUint16(ifdOffset,little);
    for(let i=0;i<count;i++){
      const entryOffset=ifdOffset+2+i*12;
      const tag=view.getUint16(entryOffset,little);
      const type=view.getUint16(entryOffset+2,little);
      const num=view.getUint32(entryOffset+4,little);
      const valOffset=entryOffset+8;
      const tagName=EXIF_TAGS[tag]||(isGps?`GPS_0x${tag.toString(16)}`:`0x${tag.toString(16)}`);

      if(tag===0x8769&&!isGps){
        // Recurse into ExifIFD
        const subOffset=view.getUint32(valOffset,little);
        readIFD(view,tiffStart,tiffStart+subOffset,little,tags,false);
        continue;
      }
      if(tag===0x8825&&!isGps){
        // Recurse into GPS IFD
        const gpsOffset=view.getUint32(valOffset,little);
        readIFD(view,tiffStart,tiffStart+gpsOffset,little,tags,true);
        continue;
      }

      const val=readExifValue(view,tiffStart,type,num,valOffset,little);
      if(val!==null) tags[tagName]=val;
    }
  }catch(e){}
}

function readExifValue(view,tiffStart,type,count,valOffset,little){
  const typeSizes=[0,1,1,2,4,8,1,1,2,4,8,4,8];
  const typeSize=typeSizes[type]||1;
  const totalSize=typeSize*count;
  let dataOffset=valOffset;
  if(totalSize>4) dataOffset=tiffStart+view.getUint32(valOffset,little);

  try{
    if(type===2){
      // ASCII string
      const bytes=new Uint8Array(view.buffer,dataOffset,count);
      return new TextDecoder().decode(bytes).replace(/\0/g,'').trim()||null;
    }
    if(type===3) return count===1?view.getUint16(dataOffset,little):
      [...Array(Math.min(count,8))].map((_,i)=>view.getUint16(dataOffset+i*2,little)).join(', ');
    if(type===4) return count===1?view.getUint32(dataOffset,little):
      [...Array(Math.min(count,8))].map((_,i)=>view.getUint32(dataOffset+i*4,little)).join(', ');
    if(type===5||type===10){
      // Rational — show as fraction or decimal
      const vals=[...Array(Math.min(count,4))].map((_,i)=>{
        const n=type===5?view.getUint32(dataOffset+i*8,little):view.getInt32(dataOffset+i*8,little);
        const d=type===5?view.getUint32(dataOffset+i*8+4,little):view.getInt32(dataOffset+i*8+4,little);
        if(d===0)return'0';
        return Number.isInteger(n/d)?String(n/d):(n/d).toFixed(4);
      });
      return vals.join(', ');
    }
    if(type===9) return view.getInt32(dataOffset,little);
    return null;
  }catch{return null}
}

function formatExifVal(key, val){
  // Format GPS coordinates nicely
  if(key==='GPSLatitude'||key==='GPSLongitude'){
    const parts=String(val).split(', ').map(Number);
    if(parts.length===3){
      const deg=parts[0],min=parts[1],sec=parts[2];
      return`${deg}° ${min}' ${sec.toFixed(2)}"`;
    }
  }
  return String(val);
}

function renderMetaList(){
  const container=document.getElementById('metaFileList');
  container.innerHTML=metaFiles.map((m,i)=>{
    const tags=m.exif||{};
    const tagEntries=Object.entries(tags).filter(([k])=>k!=='ExifIFD'&&k!=='GPSIFD');
    const hasGps=tagEntries.some(([k])=>GPS_TAGS.has(k));

    let tableRows='';
    if(tagEntries.length===0){
      tableRows=`<div class="meta-none">No readable EXIF metadata found in this file</div>`;
    } else {
      // Sort: GPS first, then device, then rest
      const sorted=tagEntries.sort(([a],[b])=>{
        const aGps=GPS_TAGS.has(a),bGps=GPS_TAGS.has(b);
        const aDev=DEVICE_TAGS.has(a),bDev=DEVICE_TAGS.has(b);
        if(aGps&&!bGps)return -1;if(!aGps&&bGps)return 1;
        if(aDev&&!bDev)return -1;if(!aDev&&bDev)return 1;
        return a.localeCompare(b);
      });
      tableRows=`<table class="meta-table">${sorted.map(([k,v])=>{
        const isGps=GPS_TAGS.has(k);
        const isDev=DEVICE_TAGS.has(k);
        const cls=isGps?'meta-tag-gps':isDev?'meta-tag-device':'';
        const label=isGps?`📍 ${k}`:isDev?`📱 ${k}`:k;
        return`<tr><td class="${cls}">${esc(label)}</td><td>${esc(formatExifVal(k,v))}</td></tr>`;
      }).join('')}</table>`;
    }

    const gpsWarning=hasGps?`<span style="font-family:'DM Mono',monospace;font-size:.62rem;color:var(--red,#c0392b);margin-left:10px">⚠ GPS location found</span>`:'';

    return`<div class="meta-card">
      <div class="meta-card-header">
        <div class="meta-card-filename">${esc(m.file.name)}</div>
        ${gpsWarning}
        <div class="meta-card-size">${fmtSize(m.file.size)}</div>
        <button class="btn btn-primary meta-card-strip" style="padding:5px 14px;font-size:.65rem" onclick="stripOne(${i})">Strip &amp; Download</button>
        <span class="fi-rm" onclick="removeMeta(${i})" style="margin-left:8px">✕</span>
      </div>
      ${tableRows}
    </div>`;
  }).join('');
}

function removeMeta(i){
  metaFiles.splice(i,1);
  if(!metaFiles.length) document.getElementById('metaResults').style.display='none';
  else renderMetaList();
}

function clearMeta(){
  metaFiles=[];
  document.getElementById('metaResults').style.display='none';
  toast('Cleared');
}

// Strip EXIF by drawing to canvas (browser strips all metadata on toDataURL)
function stripOne(i){
  const m=metaFiles[i];
  const img=new Image();
  const url=URL.createObjectURL(m.file);
  img.onload=()=>{
    const c=document.createElement('canvas');
    c.width=img.width;c.height=img.height;
    c.getContext('2d').drawImage(img,0,0);
    URL.revokeObjectURL(url);
    const fmt=m.file.type==='image/png'?'image/png':'image/jpeg';
    const ext=fmt==='image/png'?'png':'jpg';
    const base=m.file.name.replace(/\.[^.]+$/,'');
    const a=document.createElement('a');
    a.href=c.toDataURL(fmt,0.97);
    a.download=base+'_clean.'+ext;
    a.click();
    toast(`✓ Stripped & downloaded ${esc(m.file.name)}`);
  };
  img.src=url;
}

function stripAll(){
  if(!metaFiles.length){toast('No files loaded');return}
  metaFiles.forEach((_,i)=>setTimeout(()=>stripOne(i),i*300));
  toast(`Stripping ${metaFiles.length} file${metaFiles.length!==1?'s':''}…`);
}