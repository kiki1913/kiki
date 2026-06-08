const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = e => reject(e);
});

// LOGIN
function login() {
    if(document.getElementById('user').value==='tiro' && document.getElementById('pass').value==='0000') {
        document.getElementById('login-area').style.display='none';
        document.getElementById('admin-content').style.display='block';
        loadAdminApps();
    }
}

// RENDER APPS (INDEX)
function renderApps() {
    const apps = JSON.parse(localStorage.getItem('tiro_apps')) || [];
    const cont = document.getElementById('app-display');
    if(!cont) return;
    cont.innerHTML = apps.map((app, i) => `
        <div class="app-card">
            <div class="app-stats-mini">
                <span><i class="fa fa-eye"></i> ${app.views || 0}</span>
                <span><i class="fa fa-heart"></i> ${app.likes || 0}</span>
            </div>
            <div onclick="openAppModal(${i})">
                <img src="${app.logo}" class="app-logo">
                <h3>${app.name}</h3>
            </div>
            <div class="app-actions">
                <button class="action-btn" onclick="handleLike(${app.id})"><i class="fa fa-heart"></i></button>
                <button class="action-btn" onclick="handleShare('${app.link}', ${app.id})"><i class="fa fa-share"></i></button>
            </div>
        </div>
    `).join('');
}

// MODAL & ANALYTICS
function openAppModal(i) {
    let apps = JSON.parse(localStorage.getItem('tiro_apps'));
    apps[i].views = (apps[i].views || 0) + 1;
    localStorage.setItem('tiro_apps', JSON.stringify(apps));
    
    const app = apps[i];
    document.getElementById('m-logo').src = app.logo;
    document.getElementById('m-name').innerText = app.name;
    document.getElementById('m-desc').innerText = app.desc;
    document.getElementById('m-link').href = app.link;
    document.getElementById('m-slides').innerHTML = app.screens.map(s => `<div class="swiper-slide"><img src="${s}"></div>`).join('');
    
    document.getElementById('modalOverlay').style.display = 'flex';
    new Swiper('#m-swiper', { pagination: {el: '.swiper-pagination'}, autoplay: true });
    renderApps();
}

function closeAppModal() { document.getElementById('modalOverlay').style.display='none'; }

function handleLike(id) {
    let apps = JSON.parse(localStorage.getItem('tiro_apps'));
    const i = apps.findIndex(a => a.id === id);
    apps[i].likes = (apps[i].likes || 0) + 1;
    localStorage.setItem('tiro_apps', JSON.stringify(apps));
    renderApps();
}

function handleShare(url, id) {
    navigator.clipboard.writeText(url);
    alert("Link nusxalandi!");
    let apps = JSON.parse(localStorage.getItem('tiro_apps'));
    const i = apps.findIndex(a => a.id === id);
    apps[i].shares = (apps[i].shares || 0) + 1;
    localStorage.setItem('tiro_apps', JSON.stringify(apps));
}

// ADMIN FUNCTIONS
async function addApp() {
    const logo = await toBase64(document.getElementById('app-logo-file').files[0]);
    const screens = [];
    for(let f of document.getElementById('app-imgs-file').files) { screens.push(await toBase64(f)); }

    const apps = JSON.parse(localStorage.getItem('tiro_apps')) || [];
    apps.push({
        id: Date.now(),
        name: document.getElementById('app-name').value,
        desc: document.getElementById('app-desc').value,
        link: document.getElementById('app-link').value,
        logo, screens, views:0, likes:0, shares:0
    });
    localStorage.setItem('tiro_apps', JSON.stringify(apps));
    location.reload();
}

function loadAdminApps() {
    const apps = JSON.parse(localStorage.getItem('tiro_apps')) || [];
    document.getElementById('admin-app-list').innerHTML = apps.map(a => `
        <div class="admin-card" style="background:#0a0a0c">
            <div style="display:flex; justify-content:space-between">
                <strong>${a.name}</strong>
                <div>
                    <button onclick="openEdit(${a.id})" style="color:cyan; background:none; border:none; cursor:pointer">Tahrirlash</button>
                    <button onclick="deleteApp(${a.id})" style="color:red; background:none; border:none; cursor:pointer; margin-left:10px">O'chirish</button>
                </div>
            </div>
            <div class="stat-grid">
                <div class="stat-box"><h4>Views</h4><p>${a.views||0}</p></div>
                <div class="stat-box"><h4>Likes</h4><p>${a.likes||0}</p></div>
                <div class="stat-box"><h4>Shares</h4><p>${a.shares||0}</p></div>
            </div>
        </div>
    `).join('');
}

function openEdit(id) {
    const app = JSON.parse(localStorage.getItem('tiro_apps')).find(a => a.id === id);
    document.getElementById('edit-id').value = app.id;
    document.getElementById('edit-name').value = app.name;
    document.getElementById('edit-desc').value = app.desc;
    document.getElementById('edit-link').value = app.link;
    document.getElementById('editModal').style.display = 'flex';
}

function saveEdit() {
    const id = parseInt(document.getElementById('edit-id').value);
    let apps = JSON.parse(localStorage.getItem('tiro_apps'));
    const i = apps.findIndex(a => a.id === id);
    apps[i].name = document.getElementById('edit-name').value;
    apps[i].desc = document.getElementById('edit-desc').value;
    apps[i].link = document.getElementById('edit-link').value;
    localStorage.setItem('tiro_apps', JSON.stringify(apps));
    location.reload();
}

function deleteApp(id) {
    let apps = JSON.parse(localStorage.getItem('tiro_apps')).filter(a => a.id !== id);
    localStorage.setItem('tiro_apps', JSON.stringify(apps));
    loadAdminApps();
}

async function saveProfile() {
    const f = document.getElementById('inp-img-file').files[0];
    let img = JSON.parse(localStorage.getItem('tiro_dev'))?.img || "";
    if(f) img = await toBase64(f);
    localStorage.setItem('tiro_dev', JSON.stringify({
        name: document.getElementById('inp-name').value,
        job: document.getElementById('inp-job').value,
        bio: document.getElementById('inp-bio').value,
        img
    }));
    alert("Saqlandi!");
}