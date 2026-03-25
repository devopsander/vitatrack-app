/**
 * VitaTrack Main Application Logic (Firebase Edition)
 */
import store from './store.js';
import api from './api.js';

// --- State ---
let currentView = 'dashboard';
let weightChart = null;
let historyChart = null;
let isDashboardRendering = false;

// --- Initialization ---
store.onUserLoaded = (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Check if admin to show menu
    if (store.isAdmin()) {
        document.getElementById('nav-admin').classList.remove('hidden');
    }

    setupApp();
};

function setupApp() {
    setupNavigation();
    setupChatWidget();
    setupForms();
    
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await store.logout();
        window.location.href = 'login.html';
    });

    // Initial routing
    const initialView = window.location.hash.replace('#/', '') || currentView;
    renderView(initialView);

    window.addEventListener('hashchange', () => {
        const viewName = window.location.hash.replace('#/', '') || 'dashboard';
        renderView(viewName);
    });
}

// --- Navigation ---
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-links li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const viewName = item.dataset.view;
            if (viewName) window.location.hash = `/${viewName}`;
        });
    });
}

async function renderView(viewName) {
    const targetView = document.getElementById(`view-${viewName}`);
    if (!targetView) return;

    // UI Sync
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    targetView.classList.add('active');
    document.querySelectorAll('.nav-links li').forEach(nav => {
        nav.classList.toggle('active', nav.dataset.view === viewName);
    });

    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;

    currentView = viewName;

    switch(viewName) {
        case 'dashboard':
            await renderDashboard();
            break;
        case 'meals':
            renderMeals();
            break;
        case 'weight':
            renderWeightForm();
            renderWeightHistoryTable();
            break;
        case 'profile':
            renderProfile();
            break;
        case 'admin':
            await renderAdmin();
            break;
    }
}

// --- DASHBOARD ---
async function renderDashboard() {
    if (isDashboardRendering) return;
    isDashboardRendering = true;

    try {
        const profile = store.getProfile();
        const macros = store.getDailyMacros();
    
        document.getElementById('greeting-text').textContent = `Olá, ${profile.name}! 👋`;

        // Parallel tasks
        await Promise.allSettled([
            loadMotivation(profile, macros),
            renderCals(profile, macros),
            renderMacros(profile, macros),
            renderDashboardWeightChart(),
            renderBadges()
        ]);

    } catch (err) {
        console.error("Dashboard error", err);
    } finally {
        isDashboardRendering = false;
    }
}

async function loadMotivation(profile, macros) {
    const quoteEl = document.getElementById('motivational-quote');
    quoteEl.classList.add('loading-dots');
    quoteEl.textContent = "Gerando";
    
    try {
        const msg = await api.getMotivationalMessage({
            caloriasConsumidas: macros.cal,
            metaCalorias: profile.goalCalories,
            objetivo: profile.goalType
        });
        quoteEl.classList.remove('loading-dots');
        quoteEl.textContent = msg;
    } catch (e) {
        quoteEl.classList.remove('loading-dots');
        quoteEl.textContent = "Foco e determinação! Você está no caminho certo.";
    }
}

async function renderCals(profile, macros) {
    const calGoal = profile.goalCalories;
    const calConsumed = macros.cal;
    document.getElementById('cal-goal').textContent = calGoal;
    
    // Animate counter
    const el = document.getElementById('cal-consumed');
    el.textContent = calConsumed;

    const progressRing = document.getElementById('cal-progress-ring');
    const radius = progressRing.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    let percent = calConsumed / calGoal;
    if (percent > 1) percent = 1;
    const offset = circumference - percent * circumference;
    
    progressRing.style.strokeDashoffset = offset;
    progressRing.style.stroke = percent > 0.9 ? 'var(--amber-500)' : 'var(--emerald-500)';
}

async function renderMacros(profile, macros) {
    const update = (type, c, g) => {
        document.getElementById(`${type}-consumed`).textContent = `${c}g`;
        document.getElementById(`${type}-goal`).textContent = g;
        let p = Math.min((c / g) * 100, 100);
        document.getElementById(`${type}-bar`).style.width = `${p}%`;
    };
    update('protein', macros.p, profile.goalProtein);
    update('carbs', macros.c, profile.goalCarbs);
    update('fat', macros.f, profile.goalFat);
}

async function renderDashboardWeightChart() {
    const ctx = document.getElementById('dashboard-weight-chart');
    if (!ctx) return;
    const history = store.getWeightHistory().slice(-30);
    if (weightChart) weightChart.destroy();
    if (history.length === 0) return;

    weightChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: history.map(h => formatDate(h.date)),
            datasets: [{
                label: 'Peso (kg)',
                data: history.map(h => h.weight),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderBadges() {
    const badgesContainer = document.getElementById('badges-container');
    const history = store.getWeightHistory();
    const mealsToday = store.getMeals();
    let badgesHtml = '';
    
    if (history.length > 0) badgesHtml += `<span class="badge"><i data-lucide="award"></i> 1º Peso</span>`;
    if (mealsToday.length >= 2) badgesHtml += `<span class="badge"><i data-lucide="star"></i> Dieta Ativa</span>`;
    
    badgesContainer.innerHTML = badgesHtml || '<small>Continue registrando para ganhar badges!</small>';
    lucide.createIcons();
}

// --- MEALS ---
function renderMeals() {
    const container = document.getElementById('meals-list-container');
    const meals = store.getMeals();
    
    if (meals.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhuma refeição hoje.</p>';
        return;
    }

    container.innerHTML = meals.map(m => `
        <div class="meal-item card">
            <div class="meal-info">
                ${m.image ? `<img src="${m.image}" class="meal-thumb">` : ''}
                <div>
                    <small>${m.type}</small>
                    <h4>${m.name}</h4>
                    <p>${m.cal} kcal | P:${m.p} C:${m.c} G:${m.f}</p>
                </div>
            </div>
            <button class="icon-btn btn-delete-meal" data-id="${m.id}"><i data-lucide="trash-2"></i></button>
        </div>
    `).join('');

    document.querySelectorAll('.btn-delete-meal').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('Excluir?')) {
                await store.deleteMeal(store.getTodayDateString(), btn.dataset.id);
                renderMeals();
            }
        });
    });
    lucide.createIcons();
}

// --- WEIGHT ---
function renderWeightForm() {
    const history = store.getWeightHistory();
    const profile = store.getProfile();
    if (history.length > 0 && profile.height) {
        const lastW = history[history.length - 1].weight;
        const imc = lastW / ((profile.height/100)**2);
        document.getElementById('imc-value').textContent = imc.toFixed(1);
        document.getElementById('imc-card').classList.remove('hidden');
    }
}

function renderWeightHistoryTable() {
    const history = store.getWeightHistory().slice().reverse();
    const tbody = document.getElementById('weight-history-body');
    tbody.innerHTML = history.map(h => `
        <tr>
            <td>${formatDate(h.date)}</td>
            <td>${h.weight} kg</td>
            <td>${h.waist || '--'}</td>
            <td><button class="delete-weight" data-date="${h.date}">Excluir</button></td>
        </tr>
    `).join('');

    document.querySelectorAll('.delete-weight').forEach(btn => {
        btn.addEventListener('click', async () => {
            await store.deleteWeightRecord(btn.dataset.date);
            renderWeightView();
        });
    });
}

function renderWeightView() {
    renderWeightForm();
    renderWeightHistoryTable();
}

// --- PROFILE ---
function renderProfile() {
    const p = store.getProfile();
    document.getElementById('prof-name').value = p.name || '';
    document.getElementById('prof-height').value = p.height || '';
    document.getElementById('prof-goal-weight').value = p.goalWeight || '';
}

// --- ADMIN ---
async function renderAdmin() {
    if (!store.isAdmin()) return;
    const stats = await store.getAdminStats();
    if (!stats) return;

    document.getElementById('admin-total-users').textContent = stats.totalUsers;
    document.getElementById('admin-active-today').textContent = stats.activeToday;
    
    const table = document.getElementById('admin-users-table');
    table.innerHTML = stats.usersList.map(u => `
        <tr>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td>${u.goal}</td>
        </tr>
    `).join('');
}

// --- FORMS SETUP ---
function setupForms() {
    // Add Meal
    const mealForm = document.getElementById('add-meal-form');
    let mealPhoto = null;

    document.getElementById('meal-photo-input').addEventListener('change', (e) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            mealPhoto = ev.target.result.split(',')[1];
            document.getElementById('meal-photo-preview').innerHTML = `<img src="${ev.target.result}" style="max-height:100px;">`;
            document.getElementById('meal-photo-preview').classList.remove('hidden');
        };
        reader.readAsDataURL(e.target.files[0]);
    });

    document.getElementById('btn-upload-meal-photo').addEventListener('click', () => {
        document.getElementById('meal-photo-input').click();
    });

    document.getElementById('btn-analyze-ai').addEventListener('click', async () => {
        const name = document.getElementById('meal-name').value;
        const btn = document.getElementById('btn-analyze-ai');
        btn.disabled = true;
        btn.textContent = "Analisando...";
        
        try {
            const data = await api.analyzeMeal(name, mealPhoto);
            document.getElementById('meal-cal').value = data.calorias;
            document.getElementById('meal-protein').value = data.proteinas;
            document.getElementById('meal-carbs').value = data.carboidratos;
            document.getElementById('meal-fat').value = data.gorduras;
            document.getElementById('manual-macros').classList.remove('hidden');
        } catch(e) { alert(e.message); }
        finally { btn.disabled = false; btn.textContent = "Analisar com IA"; }
    });

    mealForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const meal = {
            name: document.getElementById('meal-name').value,
            type: document.getElementById('meal-type').value,
            cal: parseInt(document.getElementById('meal-cal').value),
            p: parseInt(document.getElementById('meal-protein').value),
            c: parseInt(document.getElementById('meal-carbs').value),
            f: parseInt(document.getElementById('meal-fat').value),
            image: mealPhoto ? `data:image/jpeg;base64,${mealPhoto}` : null
        };
        await store.addMeal(store.getTodayDateString(), meal);
        mealForm.reset();
        document.getElementById('manual-macros').classList.add('hidden');
        document.getElementById('meal-photo-preview').classList.add('hidden');
        mealPhoto = null;
        renderMeals();
    });

    // Weight Form
    document.getElementById('add-weight-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const w = parseFloat(document.getElementById('weight-kg').value);
        await store.addWeightRecord(w, null, null, null);
        e.target.reset();
        renderWeightView();
        alert("Peso registrado!");
    });

    // Profile Form
    document.getElementById('form-profile').addEventListener('submit', async (e) => {
        e.preventDefault();
        await store.updateProfile({
            name: document.getElementById('prof-name').value,
            height: parseFloat(document.getElementById('prof-height').value),
            goalWeight: parseFloat(document.getElementById('prof-goal-weight').value)
        });
        alert("Perfil atualizado!");
    });
}

// --- CHAT ---
function setupChatWidget() {
    const sendBtn = document.getElementById('chat-send-btn');
    const input = document.getElementById('chat-input');
    const msgs = document.getElementById('chat-messages');

    document.getElementById('chat-toggle-btn').addEventListener('click', () => {
        document.getElementById('chat-window').classList.toggle('hidden');
    });

    const send = async () => {
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        
        appendMsg('user', text);
        await store.addChatMessage('user', text);

        const aiMsg = await api.chatMessage(store.getChatHistory(), {}, text);
        appendMsg('assistant', aiMsg);
        await store.addChatMessage('assistant', aiMsg);
    };

    sendBtn.addEventListener('click', send);
    input.addEventListener('keypress', (e) => { if(e.key === 'Enter') send(); });

    function appendMsg(role, text) {
        const div = document.createElement('div');
        div.className = `message ${role}`;
        div.textContent = text;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
    }
}

// --- HELPERS ---
function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
}

// Global exposure for refresh button in HTML
window.app = {
    refreshAdmin: renderAdmin
};
