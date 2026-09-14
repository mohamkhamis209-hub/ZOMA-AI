/* نقل مباشر بين جهازين عبر WebRTC DataChannel. لا يمر محتوى المحادثات عبر خادم ZOMA. */
const ZomaTransfer = (() => {
  let pc = null, channel = null, role = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const iceComplete = pc => new Promise(resolve => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', done); resolve(); } };
    pc.addEventListener('icegatheringstatechange', done); setTimeout(resolve, 6000);
  });
  const reset = () => { try{channel?.close()}catch{} try{pc?.close()}catch{} channel=null; pc=null; role=null; };
  const setup = () => {
    channel.onopen=()=>window.__zomaTransferOnState?.('connected');
    channel.onclose=()=>window.__zomaTransferOnState?.('closed');
    channel.onerror=()=>window.__zomaTransferOnState?.('error');
    let parts=[];
    channel.onmessage=e=>{
      if(e.data==='__ZOMA_TRANSFER_END__'){
        const text=parts.join(''); parts=[];
        try{window.__zomaTransferOnData?.(JSON.parse(text));}catch{window.__zomaTransferOnState?.('invalid');}
      } else if(typeof e.data==='string') parts.push(e.data);
    };
  };
  async function createOffer(){
    reset(); role='sender'; pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    channel=pc.createDataChannel('zoma-transfer'); setup();
    await pc.setLocalDescription(await pc.createOffer()); await iceComplete(pc); return JSON.stringify(pc.localDescription);
  }
  async function acceptOffer(text){
    reset(); role='receiver'; pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    pc.ondatachannel=e=>{channel=e.channel; setup();};
    await pc.setRemoteDescription(JSON.parse(text)); await pc.setLocalDescription(await pc.createAnswer()); await iceComplete(pc); return JSON.stringify(pc.localDescription);
  }
  async function acceptAnswer(text){if(!pc||role!=='sender')throw new Error('أنشئ كود الإرسال أولًا');await pc.setRemoteDescription(JSON.parse(text));}
  async function send(data){
    if(!channel||channel.readyState!=='open')throw new Error('الاتصال المباشر غير جاهز');
    const text=JSON.stringify(data), chunk=12000;
    for(let i=0;i<text.length;i+=chunk){while(channel.bufferedAmount>2e6)await wait(50);channel.send(text.slice(i,i+chunk));}
    channel.send('__ZOMA_TRANSFER_END__');
  }
  function close(){reset();}
  return {createOffer,acceptOffer,acceptAnswer,send,close};
})();
