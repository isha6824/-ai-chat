// 1) Supabase dashboard > Project Settings > API se URL aur anon/publishable key bharein.
const SUPABASE_URL = "https://fmieqzyfxtjpkqnhbfjf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_D3oY-fbDGuKqGxg_qRER5g_IrXNhGaU";

const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (id) => document.getElementById(id);
let user = null, myProfile = null, peerProfile = null, channel = null, pendingFile = null;
const el = {
  authView:$("authView"), chatView:$("chatView"), authForm:$("authForm"), email:$("email"), password:$("password"),
  authMessage:$("authMessage"), signupBtn:$("signupBtn"), loginBtn:$("loginBtn"), logoutBtn:$("logoutBtn"),
  signedInAs:$("signedInAs"), messages:$("messages"), messageForm:$("messageForm"), messageInput:$("messageInput"),
  mediaInput:$("mediaInput"), mediaPreview:$("mediaPreview"), chatMessage:$("chatMessage"), profileForm:$("profileForm"),
  displayName:$("displayName"), about:$("about"), avatarInput:$("avatarInput"), myAvatar:$("myAvatar"),
  myEmail:$("myEmail"), profileMessage:$("profileMessage"), peerSelect:$("peerSelect"), openPeerBtn:$("openPeerBtn"),
  peerAvatar:$("peerAvatar"), peerName:$("peerName"), peerStatus:$("peerStatus"), binItems:$("binItems"),
  setupNotice:$("setupNotice"), refreshBtn:$("refreshBtn")
};
function status(node, text, good=false){node.textContent=text; node.style.color=good?"#a8f0c5":"#ffd6a3";}
function initials(name){return (name||"?").trim().slice(0,1).toUpperCase();}
async function mediaHref(path){
  if(!path)return "";
  // Older rows may contain full URLs; new rows store private bucket paths.
  if(/^https?:\/\//i.test(path))return path;
  const {data,error}=await db.storage.from("chat-media").createSignedUrl(path,3600);
  return error?"":data.signedUrl;
}
async function setAvatar(node, path, name){
  const url=await mediaHref(path);
  node.style.backgroundImage=url?`url("${url}")`:"";
  node.textContent=url?"":initials(name);
}
function dateLabel(s){return new Date(s).toLocaleString();}
function escapeText(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function showApp(on){el.authView.classList.toggle("hidden",on);el.chatView.classList.toggle("hidden",!on);}
function requireConfig(){if(!db){status(el.authMessage,"Pehle app.js mein Supabase URL aur key set karein.");return false;}return true;}

el.authForm.addEventListener("submit", async e=>{
  e.preventDefault();if(!requireConfig())return;
  status(el.authMessage,"Login ho raha hai...");
  const {data,error}=await db.auth.signInWithPassword({email:el.email.value.trim(),password:el.password.value});
  if(error)status(el.authMessage,error.message);else await onSignedIn(data.user);
});
el.signupBtn.addEventListener("click",async()=>{
  if(!requireConfig())return;
  status(el.authMessage,"Account ban raha hai...");
  const {data,error}=await db.auth.signUp({email:el.email.value.trim(),password:el.password.value});
  if(error)status(el.authMessage,error.message);
  else if(data.session)await onSignedIn(data.user);
  else status(el.authMessage,"Signup request ho gayi. Email confirmation agar enabled hai to email verify karein.",true);
});
el.logoutBtn.addEventListener("click",async()=>{if(channel)await db.removeChannel(channel);await db.auth.signOut();user=null;showApp(false);});
db?.auth.onAuthStateChange((event,session)=>{
  if(event==="SIGNED_IN"&&session?.user&&user?.id!==session.user.id) setTimeout(()=>onSignedIn(session.user),0);
  if(event==="SIGNED_OUT"){user=null;showApp(false);}
});
async function onSignedIn(u){user=u;showApp(true);el.signedInAs.textContent=u.email;el.myEmail.textContent=u.email;await loadProfile();await loadProfiles();await loadBin();if(peerProfile)await openChat(peerProfile);}
async function loadProfile(){
  const {data,error}=await db.from("profiles").select("*").eq("id",user.id).maybeSingle();
  if(error){status(el.profileMessage,error.message);return;}
  myProfile=data;
  el.displayName.value=data?.display_name||"";
  el.about.value=data?.about||"";
  await setAvatar(el.myAvatar,data?.avatar_url,data?.display_name||user.email);
  el.setupNotice.textContent=data?"Aapka profile set hai. Doosre user ko Profile tab se select karein.":"Pehle Profile / DP tab mein display name A ya I set karke Save profile dabayein.";
}
el.profileForm.addEventListener("submit",async e=>{
  e.preventDefault();if(!user)return;
  const name=el.displayName.value.trim();
  if(!name){status(el.profileMessage,"Display name zaroori hai.");return;}
  let avatarUrl=myProfile?.avatar_url||null;
  const file=el.avatarInput.files?.[0];
  if(file){
    if(file.size>8*1024*1024){status(el.profileMessage,"DP image 8 MB se chhoti honi chahiye.");return;}
    const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase();
    const path=`${user.id}/avatar-${Date.now()}.${ext}`;
    const {error:upErr}=await db.storage.from("chat-media").upload(path,file,{upsert:true,contentType:file.type});
    if(upErr){status(el.profileMessage,"DP upload error: "+upErr.message);return;}
    const {data}=db.storage.from("chat-media").getPublicUrl(path);avatarUrl=data.publicUrl;
  }
  const {data,error}=await db.from("profiles").upsert({id:user.id,display_name:name,about:el.about.value.trim(),avatar_url:avatarUrl,updated_at:new Date().toISOString()}).select().single();
  if(error){status(el.profileMessage,error.message);return;}
  myProfile=data;await setAvatar(el.myAvatar,data.avatar_url,data.display_name);status(el.profileMessage,"Profile save ho gaya.",true);await loadProfiles();
});
async function loadProfiles(){
  const {data,error}=await db.from("profiles").select("id,display_name,avatar_url,about").neq("id",user.id).order("display_name");
  if(error){status(el.profileMessage,error.message);return;}
  const old=el.peerSelect.value;
  el.peerSelect.innerHTML='<option value="">Doosra profile chunein</option>';
  (data||[]).forEach(p=>{const o=document.createElement("option");o.value=p.id;o.textContent=`${p.display_name}${p.about?" — "+p.about:""}`;el.peerSelect.appendChild(o);});
  if(data?.some(p=>p.id===old))el.peerSelect.value=old;
  if(peerProfile&&data?.some(p=>p.id===peerProfile.id))peerProfile=data.find(p=>p.id===peerProfile.id);
}
el.openPeerBtn.addEventListener("click",async()=>{
  const id=el.peerSelect.value;if(!id){status(el.profileMessage,"Pehle doosra profile chunein.");return;}
  const {data,error}=await db.from("profiles").select("*").eq("id",id).single();
  if(error){status(el.profileMessage,error.message);return;}
  await openChat(data);document.querySelector('[data-panel="chatPanel"]').click();
});
async function openChat(peer){
  if(!peer||!myProfile){status(el.chatMessage,"Pehle apna profile save karein.");return;}
  peerProfile=peer;el.peerName.textContent=peer.display_name;el.peerStatus.textContent="Chat";await setAvatar(el.peerAvatar,peer.avatar_url,peer.display_name);
  if(channel)await db.removeChannel(channel);
  await loadMessages();
  const ids=[user.id,peer.id].sort();
  channel=db.channel("chat-"+ids.join("-")).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`receiver_id=eq.${user.id}`},()=>loadMessages())
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`sender_id=eq.${user.id}`},()=>loadMessages()).subscribe();
}
async function loadMessages(){
  if(!peerProfile)return;
  const {data,error}=await db.from("messages").select("*").or(`and(sender_id.eq.${user.id},receiver_id.eq.${peerProfile.id}),and(sender_id.eq.${peerProfile.id},receiver_id.eq.${user.id})`).is("deleted_at",null).order("created_at",{ascending:true}).limit(500);
  if(error){status(el.chatMessage,"Messages load error: "+error.message);return;}
  el.messages.innerHTML="";
  if(!data?.length){el.messages.innerHTML='<div class="empty-state">💜<br>Abhi koi message nahi hai.<br>Pehla message bhejein!</div>';return;}
  for(const m of data)el.messages.appendChild(await renderMessage(m));
  el.messages.scrollTop=el.messages.scrollHeight;
}
async function renderMessage(m){
  const div=document.createElement("div");div.className="bubble"+(m.sender_id===user.id?" mine":"");
  if(m.media_url){
    const url=await mediaHref(m.media_url);
    if(url && (m.media_type||"").startsWith("image/")){const img=document.createElement("img");img.src=url;img.alt="Shared image";div.appendChild(img);}
    else if(url && (m.media_type||"").startsWith("video/")){const video=document.createElement("video");video.controls=true;video.src=url;div.appendChild(video);}
    else if(url){const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener";a.textContent="Open attachment";div.appendChild(a);}
  }
  const body=document.createElement("div");body.textContent=m.body||"";div.appendChild(body);
  const meta=document.createElement("small");meta.textContent=`${m.sender_id===user.id?"You":(peerProfile?.display_name||"User")} · ${dateLabel(m.created_at)}`;div.appendChild(meta);
  if(m.sender_id===user.id){const actions=document.createElement("div");actions.className="bubble-actions";const del=document.createElement("button");del.textContent="Recycle Bin";del.addEventListener("click",()=>softDelete(m));actions.appendChild(del);div.appendChild(actions);}
  return div;
}
el.messageForm.addEventListener("submit",async e=>{
  e.preventDefault();if(!peerProfile){status(el.chatMessage,"Pehle Profile tab se doosra profile select karein.");return;}
  const body=el.messageInput.value.trim();const file=pendingFile;
  if(!body&&!file)return;
  let mediaUrl=null,mediaType=null;
  if(file){
    if(file.size>50*1024*1024){status(el.chatMessage,"File 50 MB se chhoti honi chahiye.");return;}
    const ext=(file.name.split(".").pop()||"bin").replace(/[^a-z0-9]/gi,"").toLowerCase();
    const path=`${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const {error:upErr}=await db.storage.from("chat-media").upload(path,file,{contentType:file.type});
    if(upErr){status(el.chatMessage,"Media upload error: "+upErr.message);return;}
    const {data}=db.storage.from("chat-media").getPublicUrl(path);mediaUrl=data.publicUrl;mediaType=file.type;
  }
  const {error}=await db.from("messages").insert({sender_id:user.id,receiver_id:peerProfile.id,body,media_url:mediaUrl,media_type:mediaType});
  if(error){status(el.chatMessage,error.message);return;}
  el.messageInput.value="";pendingFile=null;el.mediaPreview.classList.add("hidden");el.mediaPreview.textContent="";status(el.chatMessage,"Message bhej diya.",true);await loadMessages();
});
el.mediaInput.addEventListener("change",()=>{pendingFile=el.mediaInput.files?.[0]||null;if(pendingFile){el.mediaPreview.textContent=`Selected: ${pendingFile.name}`;el.mediaPreview.classList.remove("hidden");}else el.mediaPreview.classList.add("hidden");});
async function softDelete(m){
  const {error}=await db.from("messages").update({deleted_at:new Date().toISOString(),deleted_by:user.id}).eq("id",m.id).eq("sender_id",user.id);
  if(error){status(el.chatMessage,error.message);return;}await loadMessages();
}
async function loadBin(){
  const {data,error}=await db.from("messages").select("*").eq("deleted_by",user.id).not("deleted_at","is",null).order("deleted_at",{ascending:false}).limit(200);
  if(error){el.binItems.textContent="Recycle Bin load error: "+error.message;return;}
  el.binItems.innerHTML="";
  if(!data?.length){el.binItems.innerHTML='<div class="empty-state">Recycle Bin khaali hai.</div>';return;}
  data.forEach(m=>{
    const item=document.createElement("div");item.className="bin-item";
    const t=document.createElement("div");t.className="bin-text";t.textContent=m.body||((m.media_type||"").startsWith("video/")?"Video attachment":"Photo/file attachment");const small=document.createElement("small");small.textContent=dateLabel(m.deleted_at);t.appendChild(small);
    const restore=document.createElement("button");restore.textContent="Restore";restore.addEventListener("click",async()=>{const {error}=await db.from("messages").update({deleted_at:null,deleted_by:null}).eq("id",m.id).eq("deleted_by",user.id);if(error)status(el.chatMessage,error.message);else await loadBin();});
    const del=document.createElement("button");del.className="danger";del.textContent="Delete forever";del.addEventListener("click",async()=>{if(!confirm("Is message ko hamesha ke liye delete karein?"))return;const {error}=await db.from("messages").delete().eq("id",m.id).eq("deleted_by",user.id);if(error)status(el.chatMessage,error.message);else await loadBin();});
    item.append(t,restore,del);el.binItems.appendChild(item);
  });
}
el.refreshBtn.addEventListener("click",async()=>{await loadProfiles();await loadMessages();await loadBin();});
document.querySelectorAll(".side-link").forEach(btn=>btn.addEventListener("click",async()=>{
  document.querySelectorAll(".side-link").forEach(b=>b.classList.toggle("active",b===btn));
  document.querySelectorAll(".panel").forEach(p=>p.classList.add("hidden"));$(btn.dataset.panel).classList.remove("hidden");
  if(btn.dataset.panel==="binPanel")await loadBin();if(btn.dataset.panel==="profilePanel")await loadProfiles();
}));
