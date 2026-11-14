/* FFmpeg single-thread worker. Runs one segment at a time to limit memory pressure. */
importScripts('./ffmpeg-core.js');
let core, mounted=false;
const reply=(id,type,more={})=>postMessage({id,type,...more});
onmessage=async ({data:d})=>{
 const {id,action}=d;
 try {
  if(action==='init') { if(!core)core=await createFFmpegCore({locateFile:p=>'./'+p}); reply(id,'ready'); return; }
  if(!core)throw Error('請先載入 FFmpeg');
  if(action==='segment'){
   const file=d.file, name='input'+(file.name.match(/\.[a-z0-9]+$/i)?.[0]||'.mp4');
   try {core.FS.unmount('/input');}catch{}
   try {core.FS.mkdir('/input');}catch{}
   core.FS.mount(core.FS.filesystems.WORKERFS,{files:[new File([file],name,{type:file.type})]},'/input');
   const out='/tmp/part.mp4'; try{core.FS.unlink(out)}catch{}
   core.reset();
   const args=['-ss',String(d.start),'-i','/input/'+name,'-t',String(d.duration),'-map','0:v:0?','-map','0:a:0?','-c','copy','-avoid_negative_ts','make_zero','-movflags','+faststart',out];
   let code=core.exec(...args);
   if(code!==0)throw Error('FFmpeg 分割失敗，可能是不支援的格式或影片損壞 (code '+code+')');
   const bytes=core.FS.readFile(out); const buf=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
   core.FS.unlink(out); core.FS.unmount('/input');
   postMessage({id,type:'segment',buffer:buf,size:buf.byteLength},[buf]); return;
  }
 }catch(e){try{core?.FS.unmount('/input')}catch{} reply(id,'error',{message:String(e.message||e)})}
};
