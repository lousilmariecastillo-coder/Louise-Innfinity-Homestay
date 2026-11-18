let siteContent;
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = n => n == null || n === "" ? "Rate to be added" : `₱${Number(n).toLocaleString("en-PH")}`;
const roomName = id => siteContent?.rooms?.find(r=>r.id===id)?.name || id;

async function loadSiteContent(){
  try{
    const res = await fetch("/data/site-content.json",{cache:"no-store"});
    if(!res.ok) throw new Error("Could not load site details");
    siteContent = await res.json();
    renderContent();
  }catch(e){ console.error(e); }
}
function renderContent(){
  $$("[data-brand]").forEach(el=>el.textContent=siteContent.brand);
  $("#introText").textContent=siteContent.intro;
  $("#locationText").textContent=siteContent.location;
  $("#footerLocation").textContent=siteContent.location;
  $("#mapLink").href=siteContent.contact?.mapsUrl || "#";
  $("#year").textContent=new Date().getFullYear();

  $("#roomGrid").innerHTML = siteContent.rooms.map((room,i)=>{
    const img = room.image ? `<img src="${escapeHtml(room.image)}" alt="${escapeHtml(room.name)}">` : `<div class="room-placeholder"><div><span>⌂</span>ROOM PHOTO<br>COMING SOON</div></div>`;
    const capacity = room.capacity ? `Up to ${room.capacity} guests` : "Add guest capacity";
    const price = room.rate != null ? `${money(room.rate)} <small>/ night</small>` : `Rate to be added`;
    return `<article class="room-card">
      <div class="room-photo">${img}</div>
      <div class="room-info">
        <div class="room-topline"><h3>${escapeHtml(room.name || `Room ${String(i+1).padStart(2,"0")}`)}</h3><span class="room-badge">Room ${String(i+1).padStart(2,"0")}</span></div>
        <p>${escapeHtml(room.description || "Room details coming soon.")}</p>
        <div class="room-meta"><span>♙ ${escapeHtml(capacity)}</span><span class="room-price">${price}</span></div>
        <a class="room-book" href="#booking" data-select-room="${room.id}">Inquire about this room ↗</a>
      </div>
    </article>`;
  }).join("");

  $("#roomSelect").innerHTML = `<option value="">Choose a room</option>` + siteContent.rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
  $("#amenityGrid").innerHTML = siteContent.amenities.map(a=>`<article class="amenity"><div class="amenity-icon">${escapeHtml(a.icon)}</div><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.detail)}</p></article>`).join("");
  $$("[data-select-room]").forEach(a=>a.addEventListener("click",()=>$("#roomSelect").value=a.dataset.selectRoom));
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function setMessage(text,kind=""){
  const el=$("#availabilityResult");el.textContent=text;el.className="availability-result"+(kind?" "+kind:"");
}
function localDateISO(d=new Date()){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function setDateMinimums(){
  const today=localDateISO();$("#checkIn").min=today;$("#checkOut").min=today;
  $("#checkIn").addEventListener("change",()=>{const v=$("#checkIn").value;$("#checkOut").min=v||today;if($("#checkOut").value && $("#checkOut").value<=v)$("#checkOut").value="";});
}
let availabilityTimer;
async function checkAvailability(){
  clearTimeout(availabilityTimer);
  const checkIn=$("#checkIn").value,checkOut=$("#checkOut").value,roomId=$("#roomSelect").value;
  if(!checkIn||!checkOut||!roomId){setMessage("Choose your dates and room to check availability.");return;}
  if(checkOut<=checkIn){setMessage("Check-out must be after check-in.","bad");return;}
  setMessage("Live calendar is not connected yet. Dates will be manually checked by the homestay before confirmation.","warn"); return;
  setMessage("Checking the reservation calendar…");
  availabilityTimer=setTimeout(async()=>{
    try{
      const q=new URLSearchParams({checkIn,checkOut,roomId});
      const res=await fetch(`/.netlify/functions/availability?${q}`);
      const data=await res.json();
      if(!res.ok)throw new Error(data.message||"Could not check dates.");
      if(!data.configured){setMessage("Calendar setup is still pending. You can send a request now; the homestay will verify the dates before confirming.","warn");return;}
      if(data.available){setMessage(`These dates appear available for ${roomName(roomId)}. Send your request and wait for approval.`,"good");}
      else{setMessage(`Sorry, ${roomName(roomId)} is already booked for some or all of those dates. Please choose another date or room.`,"bad");}
    }catch(e){setMessage("Live availability is not connected yet. You may still send an inquiry for manual checking.","warn");}
  },250);
}
$("#checkIn").addEventListener("change",checkAvailability);
$("#checkOut").addEventListener("change",checkAvailability);
$("#roomSelect").addEventListener("change",checkAvailability);

$("#bookingForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const form=e.currentTarget;
  if(!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form).entries());
  if(data.company){return;}
  if(data.checkOut<=data.checkIn){setMessage("Check-out must be after check-in.","bad");return;}
  const btn=$("#submitBooking");btn.disabled=true;btn.textContent="Sending request…";
  setMessage("The booking request system is still being set up. Please contact the homestay directly for now; no request was sent.","warn");
  btn.disabled=false;btn.innerHTML='Send booking request <span>→</span>';
  return;
  try{
    const res=await fetch("/.netlify/functions/booking-request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    const result=await res.json();
    if(!res.ok)throw new Error(result.message||"Something went wrong. Please try again.");
    setMessage(`Your request has been received! Reference: ${result.reference}. This is not a confirmed booking yet. The homestay will contact you after reviewing it.`,"good");
    form.reset();
  }catch(err){setMessage(err.message||"We couldn't send your request. Please try again later.","bad");}
  finally{btn.disabled=false;btn.innerHTML='Send booking request <span>→</span>';}
});

$("#menuToggle").addEventListener("click",()=>{
  const nav=$("#mainNav"),open=nav.classList.toggle("open");
  $("#menuToggle").setAttribute("aria-expanded",String(open));
  $("#menuToggle").textContent=open?"×":"☰";
});
$$('#mainNav a').forEach(a=>a.addEventListener("click",()=>{$("#mainNav").classList.remove("open");$("#menuToggle").setAttribute("aria-expanded","false");$("#menuToggle").textContent="☰";}));

setDateMinimums();
loadSiteContent();
