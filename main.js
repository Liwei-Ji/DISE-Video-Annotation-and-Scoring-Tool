// main.js

const upload=document.getElementById('upload');
const video=document.getElementById('video');
const videoContainer=document.getElementById('video-container');
const intervalStart=document.getElementById('interval-start');
const startLabel=document.getElementById('interval-start-label');
const endLabel=document.getElementById('interval-end-label');
const captureBtn=document.getElementById('capture');
const thumbnails=document.getElementById('thumbnails');
const lightbox=document.getElementById('lightbox');
const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d');
const toggleBtn=document.getElementById('toggleMode');
const closeLightbox=document.getElementById('closeLightbox');
const saveAreaBtn=document.getElementById('saveArea');

let intervalDuration=10, intervalEnd=10;
let areaData = []; // 🟢 儲存面積資料 [ {src, area}, ... ]

upload.addEventListener('change',()=>{
  const file=upload.files[0]; if(!file)return;
  const url=URL.createObjectURL(file);
  video.src=url; videoContainer.style.display='block';
  video.addEventListener('loadedmetadata',()=>{
  const duration=video.duration;
  // 設定初始起點
  const start = 0;
  // 結束點 = 影片長度
  const end = duration;

  intervalStart.value = start;
  intervalStart.max = end;
  intervalDuration = end - start;
  intervalEnd = end;

  startLabel.textContent = formatTime(start);
  endLabel.textContent = formatTime(end);
});

  // === 產生時間軸縮圖 ===
const timeThumbs = document.getElementById('time-thumbnails');

async function generateTimelineThumbnails(video, duration) {
  timeThumbs.innerHTML = '';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 80;
  canvas.height = 45;

  const tempVideo = document.createElement('video');
  tempVideo.src = video.src;
  tempVideo.muted = true;

  const totalFrames = Math.min(120, Math.ceil(duration / 2)); // 最多120張
  const interval = duration / totalFrames;
  timeThumbs.style.width = `${totalFrames * 80}px`;

  let currentFrame = 0;
  tempVideo.addEventListener('seeked', () => {
    ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
    const img = document.createElement('img');
    img.src = canvas.toDataURL();
    timeThumbs.appendChild(img);
    currentFrame++;
    if (currentFrame < totalFrames) {
      tempVideo.currentTime = currentFrame * interval;
    }
  });

  tempVideo.addEventListener('loadeddata', () => {
    tempVideo.currentTime = 0;
  });
}

// 當影片載入好時呼叫縮圖生成
video.addEventListener('loadedmetadata', () => {
  const duration = video.duration;
  generateTimelineThumbnails(video, duration);
}, { once: true });

// 縮圖滑桿與影片時間移動
function updateTimelineScroll() {
  const maxScroll = timeThumbs.scrollWidth - document.getElementById('track-container').clientWidth;
  const percent = video.currentTime / video.duration;
  timeThumbs.style.transform = `translateX(${-maxScroll * percent}px)`;
}

intervalStart.addEventListener('input', () => {
  const start = parseFloat(intervalStart.value);
  video.currentTime = start;
  updateTimelineScroll();
});

video.addEventListener('timeupdate', updateTimelineScroll);

});

intervalStart.addEventListener('input', () => {
  const start = parseFloat(intervalStart.value);
  // 不要超過影片時間長度
  intervalEnd = Math.min(start + intervalDuration, video.duration); 
  // 更新時間顯示
  startLabel.textContent = formatTime(start);
  endLabel.textContent = formatTime(intervalEnd);
});

captureBtn.addEventListener('click',async()=>{
  const start=parseFloat(intervalStart.value);
  const shots=6;// 切圖數量
  const canvasTmp=document.createElement('canvas');
  const ctxTmp=canvasTmp.getContext('2d');
  thumbnails.innerHTML='處理中...';
  const imgs=[];
  for(let i=0;i<shots;i++){
    const time=start+i;
    await seekToTime(video,time);
    const w=video.videoWidth,h=video.videoHeight;
    const targetW=1280, scale=targetW/w, targetH=h*scale;
    canvasTmp.width=targetW; canvasTmp.height=targetH;
    ctxTmp.drawImage(video,0,0,targetW,targetH);
    imgs.push(canvasTmp.toDataURL('image/png'));
  }
  thumbnails.innerHTML = imgs.map((src, i) => {
  const t = (start + i).toFixed(1); // 每張圖片的時間
  return `
    <div class="thumb-wrap">
      <img src="${src}" data-index="${i}" data-time="${t}" />
      <div class="area-label">未標記</div>
    </div>
  `;
}).join('');
  document.querySelectorAll('#thumbnails img').forEach(img=>{
    img.addEventListener('click',()=>openLightbox(img.src, img));
  });
});

function formatTime(sec){sec=Math.floor(sec);return`${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`;}
function seekToTime(video,t){return new Promise(res=>{const onSeeked=()=>{video.removeEventListener('seeked',onSeeked);setTimeout(res,100);};video.addEventListener('seeked',onSeeked);video.currentTime=t;});}

// === Lightbox & Drawing ===
let img=new Image();
let mode='box';
let box=null, polygon=null;
let draggingHandle=null, dragIndex=null;
const HANDLE_SIZE=8;
let currentThumbElement=null; // 用來回寫面積標籤

function openLightbox(src, thumbElement){
  lightbox.style.display='flex';
  currentThumbElement = thumbElement.parentElement;
  img.onload=()=>{
    canvas.width=img.width; canvas.height=img.height;
    const size=Math.min(img.width,img.height)/2;
    box={x:(img.width-size)/2,y:(img.height-size)/2,w:size,h:size};
    polygon=null; mode='box';
    toggleBtn.textContent='多邊形框'; draw();
  };
  img.src=src;
}
closeLightbox.addEventListener('click',()=>lightbox.style.display='none');

// === Toggle ===
toggleBtn.addEventListener('click',()=>{
  if(mode==='box'&&box){
    polygon=getBoxPolygonPoints(box);
    box=null; mode='polygon';
    toggleBtn.textContent='矩形框';
  }else if(mode==='polygon'&&polygon){
    const xs=polygon.map(p=>p.x),ys=polygon.map(p=>p.y);
    box={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
    polygon=null; mode='box';
    toggleBtn.textContent='多邊形框';
  }
  draw();
});

// 儲存面積 + 框資料
saveAreaBtn.addEventListener('click', () => {
  let area = 0;
  let boxData = null, polygonData = null;

  if (mode === 'box' && box) {
    area = box.w * box.h;
    boxData = { ...box };
  } else if (mode === 'polygon' && polygon) {
    area = calculatePolygonArea(polygon);
    polygonData = polygon.map(p => ({ ...p }));
  }

  if (area && currentThumbElement) {
    currentThumbElement.querySelector('.area-label').textContent = `面積: ${area.toFixed(1)} px²`;

    // 🟢 取得時間並一起儲存
    const captureTime = parseFloat(currentThumbElement.querySelector('img').dataset.time);

    // 如果 areaData 已有該 src，就更新
    const idx = areaData.findIndex(a => a.src === img.src);
    const newData = { 
      src: img.src, 
      area: area.toFixed(1), 
      box: boxData, 
      polygon: polygonData, 
      time: captureTime // 👈 儲存影片時間
    };

    if (idx >= 0) areaData[idx] = newData;
    else areaData.push(newData);

    alert('✅ 已儲存！');
  }
});


// 開啟 Lightbox 時，恢復之前框
function openLightbox(src, thumbElement){
  lightbox.style.display='flex';
  currentThumbElement = thumbElement.parentElement;

  img.onload=()=>{
    canvas.width=img.width; canvas.height=img.height;

    // 嘗試從 areaData 讀取之前存的框
    const data = areaData.find(a=>a.src===src);
    if(data){
      if(data.box){ box={...data.box}; polygon=null; mode='box'; }
      else if(data.polygon){ polygon = data.polygon.map(p=>({...p})); box=null; mode='polygon'; }
    } else {
      // 新圖片初始化框
      const size=Math.min(img.width,img.height)/2;
      box={x:(img.width-size)/2,y:(img.height-size)/2,w:size,h:size};
      polygon=null; mode='box';
    }

    toggleBtn.textContent = (mode==='box') ? '多邊形' : '矩形框';
    draw();
  };
  img.src = src;
}

// === Mouse events ===
canvas.addEventListener('mousedown',e=>{
  const m=getMouse(e);
  if(mode==='box'&&box) draggingHandle=getBoxHandle(m);
  if(mode==='polygon'&&polygon) dragIndex=getPolygonVertex(m);
});
canvas.addEventListener('mousemove',e=>{
  const m=getMouse(e);
  if(mode==='box'&&draggingHandle&&box){resizeBox(draggingHandle,m);draw();}
  if(mode==='polygon'&&dragIndex!==null&&polygon){polygon[dragIndex]=m;draw();}
});
canvas.addEventListener('mouseup',e=>{
  const m=getMouse(e);
  if(mode==='polygon'&&dragIndex===null){
    const idx=findEdgeToInsert(m);
    if(idx!==null){ polygon.splice(idx+1,0,m); draw(); }
  }
  draggingHandle=null; dragIndex=null;
});
function getMouse(e){
  const rect=canvas.getBoundingClientRect();
  const scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height;
  return {x:(e.clientX-rect.left)*scaleX, y:(e.clientY-rect.top)*scaleY};
}

// === Draw ===
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0);
  if(mode==='box'&&box){
    ctx.fillStyle='rgba(0,0,0,0.0)';
    ctx.fillRect(box.x,box.y,box.w,box.h);
    ctx.strokeStyle='white';ctx.lineWidth=2;ctx.strokeRect(box.x,box.y,box.w,box.h);
    getBoxHandles().forEach(p=>drawHandle(p.x,p.y));
    const area=box.w*box.h;ctx.fillStyle='white';ctx.font='18px Arial';
    ctx.fillText(`面積: ${area.toFixed(1)} px²`, box.x+10, box.y+20);
  }else if(mode==='polygon'&&polygon){
    ctx.fillStyle='rgba(0,0,0,0.0)';
    ctx.strokeStyle='white';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(polygon[0].x,polygon[0].y);
    polygon.forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();
    polygon.forEach(p=>drawHandle(p.x,p.y));
    const area=calculatePolygonArea(polygon);
    const c=getPolygonCentroid(polygon);
    ctx.fillStyle='white';ctx.font='18px Arial';
    ctx.fillText(`面積: ${area.toFixed(1)} px²`, c.x+10, c.y);
  }
}
function drawHandle(x,y){
  ctx.fillStyle='white';ctx.strokeStyle='black';
  ctx.fillRect(x-HANDLE_SIZE/2,y-HANDLE_SIZE/2,HANDLE_SIZE,HANDLE_SIZE);
  ctx.strokeRect(x-HANDLE_SIZE/2,y-HANDLE_SIZE/2,HANDLE_SIZE,HANDLE_SIZE);
}

// === Geometry ===
function getBoxHandles(){const {x,y,w,h}=box;return[{x:x,y:y,name:'tl'},{x:x+w,y:y,name:'tr'},{x:x+w,y:y+h,name:'br'},{x:x,y:y+h,name:'bl'}];}
function getBoxHandle(m){return getBoxHandles().find(h=>Math.abs(m.x-h.x)<HANDLE_SIZE*2&&Math.abs(m.y-h.y)<HANDLE_SIZE*2)?.name||null;}
function resizeBox(h,m){let{x,y,w,h:hh}=box;switch(h){case'tl':w+=(x-m.x);hh+=(y-m.y);x=m.x;y=m.y;break;case'tr':w=m.x-x;hh+=(y-m.y);y=m.y;break;case'br':w=m.x-x;hh=m.y-y;break;case'bl':w+=(x-m.x);hh=m.y-y;x=m.x;break;}if(w<10)w=10;if(hh<10)hh=10;box={x,y,w,h:hh};}
function getPolygonVertex(m){for(let i=0;i<polygon.length;i++){const p=polygon[i];if(Math.abs(p.x-m.x)<HANDLE_SIZE*2&&Math.abs(p.y-m.y)<HANDLE_SIZE*2)return i;}return null;}
function findEdgeToInsert(m){const t=8;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];const d=pointToSegmentDistance(m,a,b);if(d<t)return i;}return null;}
function pointToSegmentDistance(p,a,b){const A=p.x-a.x,B=p.y-a.y,C=b.x-a.x,D=b.y-a.y;const dot=A*C+B*D;const len=C*C+D*D;let t=dot/len;t=Math.max(0,Math.min(1,t));const x=a.x+t*C,y=a.y+t*D;const dx=p.x-x,dy=p.y-y;return Math.sqrt(dx*dx+dy*dy);}
function getBoxPolygonPoints(b){const {x,y,w,h}=b;return[{x:x,y:y},{x:x+w/2,y:y},{x:x+w,y:y},{x:x+w,y:y+h/2},{x:x+w,y:y+h},{x:x+w/2,y:y+h},{x:x,y:y+h},{x:x,y:y+h/2}];}
function calculatePolygonArea(points){let a=0,n=points.length;for(let i=0;i<n;i++){const j=(i+1)%n;a+=points[i].x*points[j].y - points[j].x*points[i].y;}return Math.abs(a/2);}
function getPolygonCentroid(points){let x=0,y=0;for(const p of points){x+=p.x;y+=p.y;}return{x:x/points.length,y:y/points.length};}

// === 匯出最大最小面積 JSON ===
document.getElementById('exportJson').addEventListener('click', () => {
  // 篩選出已標記面積的圖片
  const validData = areaData.filter(item => item.area && parseFloat(item.area) > 0);

  if (validData.length < 2) {
    alert('⚠️ 需要至少兩張已標記面積的圖片才能匯出最大與最小面積！');
    return;
  }

  // 找出最大與最小面積資料
  const sorted = [...validData].sort((a, b) => parseFloat(a.area) - parseFloat(b.area));
  const smallest = sorted[0];
  const largest = sorted[sorted.length - 1];

  const exportData = [smallest, largest];

  // === 計算阻塞百分比與VOTE分數 ===
  const maxArea = parseFloat(largest.area);
  const minArea = parseFloat(smallest.area);
  const obstructionPercent = ((maxArea - minArea) / maxArea) * 100;

  let voteScore = 0;
  if (obstructionPercent > 75) voteScore = 2;
  else if (obstructionPercent >= 50) voteScore = 1;

  // --- 1. 匯出 JSON 檔 (包含阻塞百分比與VOTE分數) ---
  const fullExportData = {
    smallestArea: smallest,
    largestArea: largest,
    obstructionPercent: obstructionPercent.toFixed(1),
    voteScore: voteScore
  };

  const jsonStr = JSON.stringify(fullExportData, null, 2);
  const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  const aJson = document.createElement('a');
  aJson.href = jsonUrl;
  aJson.download = 'area_extremes_with_scores.json';
  aJson.click();
  URL.revokeObjectURL(jsonUrl);

  // --- 2. 匯出圖片 ---
  drawAndSaveWithOverlay(smallest, 'min_area.png');
  drawAndSaveWithOverlay(largest, 'max_area.png');

  // --- 3. 顯示結果在畫面上 ---
  const resultBox = document.getElementById('obstruction-result');
  resultBox.innerHTML = `
  🚨 阻塞百分比：<strong>${obstructionPercent.toFixed(1)}%</strong><br>
  📝 VOTE Score：<strong>${voteScore}</strong>`;
});


function drawAndSaveWithOverlay(data, filename) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');

    // 畫圖片本身
    ctx.drawImage(img, 0, 0);

    // 畫框
    if (data.box) {
      const { x, y, w, h } = data.box;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = 'rgba(0,0,0,0.0)';
      ctx.fillRect(x, y, w, h);
    } else if (data.polygon) {
      ctx.beginPath();
      const points = data.polygon;
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.0)';
      ctx.fill();
    }

    // === 寫上面積與時間 ===
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`面積: ${data.area} px²`, 20, 30);

    // 時間顯示
    if (typeof data.time === 'number') {
      ctx.fillText(`時間: ${data.time.toFixed(1)} 秒`, 20, 60);
    }

    // === 轉成圖片下載 ===
    const finalImage = canvas.toDataURL('image/png');

    // 動態產生檔名包含時間：如 min_area_3_0s.png
    let filenameWithTime = filename;
    if (typeof data.time === 'number') {
      const timeLabel = `${data.time.toFixed(1)}s`.replace('.', '_');
      const base = filename.replace(/\.png$/, '');
      filenameWithTime = `${base}_${timeLabel}.png`;
    }

    const a = document.createElement('a');
    a.href = finalImage;
    a.download = filenameWithTime;
    a.click();
  };

  img.src = data.src;

} 
