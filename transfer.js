/* نقل مباشر مبسط عبر QR متحرك. البيانات تبقى على الجهازين ولا تُرفع إلى خادم ZOMA. */
const ZomaTransfer = (() => {
  const CHUNK_SIZE = 1500;
  const FRAME_MS = 650;
  let timer = null;
  let stream = null;
  let scanTimer = null;
  let chunks = new Map();
  let receiveMeta = null;
  let payloadFrames = [];
  let frameIndex = 0;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function bytesToBase64(bytes){
    let binary='';
    const step=0x8000;
    for(let i=0;i<bytes.length;i+=step) binary += String.fromCharCode(...bytes.subarray(i,i+step));
    return btoa(binary);
  }
  function base64ToBytes(base64){
    const binary=atob(base64); const out=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) out[i]=binary.charCodeAt(i);
    return out;
  }
  async function encodeData(data){
    const text=JSON.stringify(data);
    const raw=new TextEncoder().encode(text);
    if('CompressionStream' in window){
      try{
        const compressed=await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
        return 'G1.'+bytesToBase64(new Uint8Array(compressed));
      }catch{}
    }
    return 'P1.'+bytesToBase64(raw);
  }
  async function decodeData(payload){
    const [kind,b64]=payload.split('.',2);
    const bytes=base64ToBytes(b64||'');
    let raw=bytes;
    if(kind==='G1'){
      if(!('DecompressionStream' in window)) throw new Error('المتصفح لا يدعم فك ضغط النقل. استخدم Chrome أو Edge محدث.');
      raw=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    }
    return JSON.parse(new TextDecoder().decode(raw));
  }
  function clearTimer(){ if(timer){clearInterval(timer);timer=null;} }
  function stopCamera(){
    if(scanTimer){cancelAnimationFrame(scanTimer);scanTimer=null;}
    if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
    const v=document.getElementById('transferVideo'); if(v) v.srcObject=null;
  }
  function close(){ clearTimer(); stopCamera(); chunks=new Map(); receiveMeta=null; payloadFrames=[]; frameIndex=0; }

  async function prepareSender(data){
    close();
    const encoded=await encodeData(data);
    const id=crypto.randomUUID().replaceAll('-','').slice(0,12);
    const total=Math.max(1,Math.ceil(encoded.length/CHUNK_SIZE));
    payloadFrames=[];
    for(let i=0;i<total;i++){
      const part=encoded.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE);
      payloadFrames.push(`ZOMAQR1|${id}|${total}|${i}|${part}`);
    }
    frameIndex=0;
    return {id,total};
  }
  async function drawCurrent(){
    if(!window.QRCode) throw new Error('تعذر تحميل مولد QR Code.');
    const canvas=document.getElementById('transferQrCanvas');
    await QRCode.toCanvas(canvas,payloadFrames[frameIndex],{errorCorrectionLevel:'M',margin:2,width:360});
    const total=payloadFrames.length;
    document.getElementById('transferProgressText').textContent=`${frameIndex+1} / ${total}`;
    document.getElementById('transferProgressBar').style.width=`${((frameIndex+1)/total)*100}%`;
  }
  async function startSender(data){
    const meta=await prepareSender(data);
    await drawCurrent();
    clearTimer();
    timer=setInterval(async()=>{
      frameIndex=(frameIndex+1)%payloadFrames.length;
      try{await drawCurrent();}catch{}
    },FRAME_MS);
    return meta;
  }

  function parseFrame(value){
    if(typeof value!=='string'||!value.startsWith('ZOMAQR1|')) return null;
    const parts=value.split('|');
    if(parts.length<5) return null;
    const [,id,totalRaw,indexRaw,...rest]=parts;
    const total=Number(totalRaw), index=Number(indexRaw);
    if(!id||!Number.isInteger(total)||!Number.isInteger(index)||total<1||index<0||index>=total) return null;
    return {id,total,index,data:rest.join('|')};
  }
  async function handleFrame(value){
    const frame=parseFrame(value); if(!frame) return false;
    if(!receiveMeta||receiveMeta.id!==frame.id){
      receiveMeta={id:frame.id,total:frame.total}; chunks=new Map();
    }
    chunks.set(frame.index,frame.data);
    const count=chunks.size;
    document.getElementById('transferReceiveProgressText').textContent=`${count} / ${receiveMeta.total}`;
    document.getElementById('transferReceiveProgressBar').style.width=`${(count/receiveMeta.total)*100}%`;
    document.getElementById('transferReceiveStatus').textContent='تم التقاط جزء من النقل…';
    if(count===receiveMeta.total){
      clearTimer(); stopCamera();
      const payload=Array.from({length:receiveMeta.total},(_,i)=>chunks.get(i)||'').join('');
      try{
        const data=await decodeData(payload);
        window.__zomaTransferOnData?.(data);
        document.getElementById('transferReceiveStatus').textContent='تم استقبال المحادثات بنجاح ✅';
        return true;
      }catch(e){
        document.getElementById('transferReceiveStatus').textContent='تعذر قراءة النسخة. حاول مرة أخرى.';
      }
    }
    return false;
  }
  async function startReceiver(){
    close();
    if(!('BarcodeDetector' in window)) throw new Error('المتصفح لا يدعم قراءة QR بالكاميرا. استخدم Chrome أو Edge محدث.');
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    const video=document.getElementById('transferVideo'); video.srcObject=stream; await video.play();
    const detector=new BarcodeDetector({formats:['qr_code']});
    const canvas=document.getElementById('transferScanCanvas'); const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const scan=async()=>{
      if(!stream||video.readyState<2){scanTimer=requestAnimationFrame(scan);return;}
      try{
        const codes=await detector.detect(video);
        for(const code of codes){ if(code.rawValue){ await handleFrame(code.rawValue); break; } }
      }catch{}
      if(stream) scanTimer=requestAnimationFrame(scan);
    };
    canvas.width=video.videoWidth||640; canvas.height=video.videoHeight||480; void ctx;
    scan();
  }
  return {startSender,startReceiver,stopCamera,close};
})();
