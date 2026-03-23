/**
 * VitaTrack Main Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- State & DOM Elements ---
    let currentView = 'dashboard';
    const views = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.nav-links li');

    // Chart instances
    let weightChart = null;
    let historyChart = null;

    // --- Initialization ---
    initApp();

    function initApp() {
        if (!store.isLoggedIn()) {
            window.location.href = 'login.html';
            return;
        }

        setupNavigation();
        setupChatWidget();
        setupForms();
        
        document.getElementById('btn-logout').addEventListener('click', () => {
            store.logout();
            window.location.href = 'login.html';
        });

        renderView(currentView);
    }

    // --- Navigation ---
    function setupNavigation() {
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const viewName = item.dataset.view;
                if (!viewName) return;

                // Update active class
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                currentView = viewName;
                renderView(viewName);
            });
        });
    }

    function renderView(viewName) {
        views.forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${viewName}`).classList.add('active');

        switch(viewName) {
            case 'dashboard':
                renderDashboard();
                break;
            case 'meals':
                renderMeals();
                break;
            case 'weight':
                renderWeightForm();
                break;
            case 'goals':
                renderGoalsForm();
                break;
            case 'history':
                renderHistory();
                break;
        }
    }

    // --- DASHBOARD ---
    async function renderDashboard() {
        const profile = store.getProfile();
        const macros = store.getDailyMacros();
        
        // Greeting
        document.getElementById('greeting-text').textContent = `Olá, ${profile.name}! 👋`;

        // Load Motivation
        loadMotivation();

        // Progress Ring (Calories)
        const calGoal = profile.goalCalories;
        const calConsumed = macros.cal;
        document.getElementById('cal-goal').textContent = calGoal;
        
        // Animate counter
        animateCounter('cal-consumed', calConsumed);

        const progressRing = document.getElementById('cal-progress-ring');
        const radius = progressRing.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        
        let percent = calConsumed / calGoal;
        if (percent > 1) percent = 1;
        const offset = circumference - percent * circumference;
        
        // Add a slight delay for animation effect
        setTimeout(() => {
            progressRing.style.strokeDashoffset = offset;
            if (percent > 0.9) {
                progressRing.style.stroke = 'var(--amber-500)'; // Warning if close to limit
            } else {
                progressRing.style.stroke = 'var(--emerald-500)';
            }
        }, 100);

        // Macro Cards
        updateMacroCard('protein', macros.p, profile.goalProtein);
        updateMacroCard('carbs', macros.c, profile.goalCarbs);
        updateMacroCard('fat', macros.f, profile.goalFat);

        // Weight Chart
        renderDashboardWeightChart();
        
        // Badges Update
        renderBadges();
    }

    function renderBadges() {
        const badgesContainer = document.getElementById('badges-container');
        if (!badgesContainer) return;

        const history = store.getWeightHistory();
        const mealsToday = store.getMeals();
        
        let badgesHtml = '';
        
        // Badge 1: 1o Registro
        if (history.length > 0) {
            badgesHtml += `<div style="background:var(--grad-accent); color:white; padding: 0.5rem 1rem; border-radius: var(--radius-full); font-size:0.8rem; font-weight:bold; white-space:nowrap; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="award" style="width:14px; height:14px;"></i> 1º Peso</div>`;
        }
        
        // Badge 2: Refeições lançadas hoje
        if (mealsToday.length >= 2) {
            badgesHtml += `<div style="background:var(--grad-primary); color:white; padding: 0.5rem 1rem; border-radius: var(--radius-full); font-size:0.8rem; font-weight:bold; white-space:nowrap; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="star" style="width:14px; height:14px;"></i> Dieta em Dia</div>`;
        }

        if (!badgesHtml) {
            badgesHtml = '<span style="color:var(--text-secondary); font-size:0.9rem;">Registre dados para desbloquear conquistas!</span>';
        }

        badgesContainer.innerHTML = badgesHtml;
    }

    function updateMacroCard(type, consumed, goal) {
        document.getElementById(`${type}-consumed`).textContent = `${consumed}g`;
        document.getElementById(`${type}-goal`).textContent = goal;

        let pct = (consumed / goal) * 100;
        if (pct > 100) pct = 100;
        
        setTimeout(() => {
            document.getElementById(`${type}-bar`).style.width = `${pct}%`;
        }, 300);
    }

    async function loadMotivation() {
        const quoteEl = document.getElementById('motivational-quote');
        const macros = store.getDailyMacros();
        const profile = store.getProfile();
        
        if (!api.getKey()) {
            quoteEl.textContent = "Configure sua chave da API para receber mensagens motivacionais!";
            return;
        }

        quoteEl.classList.add('loading-dots');
        quoteEl.textContent = "Gerando";
        
        try {
            const context = {
                caloriasConsumidas: macros.cal,
                metaCalorias: profile.goalCalories,
                objetivo: profile.goalType
            };
            const msg = await api.getMotivationalMessage(context);
            quoteEl.classList.remove('loading-dots');
            quoteEl.textContent = msg;
        } catch (e) {
            quoteEl.classList.remove('loading-dots');
            quoteEl.textContent = "Foco e determinação! Você consegue bater suas metas hoje!";
        }
    }

    function renderDashboardWeightChart() {
        const ctx = document.getElementById('dashboard-weight-chart').getContext('2d');
        const history = store.getWeightHistory().slice(-30); // Last 30 days
        
        if (weightChart) weightChart.destroy();

        if (history.length === 0) return;

        weightChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: history.map(h => formatDate(h.date)),
                datasets: [{
                    label: 'Peso (kg)',
                    data: history.map(h => h.weight),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#2563eb'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        suggestedMin: Math.min(...history.map(h=>h.weight)) - 2,
                        suggestedMax: Math.max(...history.map(h=>h.weight)) + 2
                    }
                }
            }
        });
    }

    // --- MEALS ---
    function renderMeals() {
        const listContainer = document.getElementById('meals-list-container');
        const meals = store.getMeals();

        listContainer.innerHTML = '';

        if (meals.length === 0) {
            listContainer.innerHTML = '<p style="color:var(--text-secondary); text-align:center;">Nenhuma refeição registrada hoje. Adicione a primeira!</p>';
            return;
        }

        const icons = {
            cafe: 'coffee',
            almoco: 'sun',
            lanche: 'apple',
            jantar: 'moon'
        };

        const labels = {
            cafe: 'Café da Manhã',
            almoco: 'Almoço',
            lanche: 'Lanche',
            jantar: 'Jantar'
        };

        meals.forEach(m => {
            const el = document.createElement('div');
            el.className = 'meal-item';
            el.innerHTML = `
                <div class="meal-info" style="display: flex; gap: 1rem; align-items: center;">
                    <div style="background:var(--emerald-100); padding: 0.5rem; border-radius:8px; color:var(--emerald-600)">
                        <i data-lucide="${icons[m.type] || 'utensils'}"></i>
                    </div>
                    <div>
                        <h4>${m.name}</h4>
                        <p>${labels[m.type]}</p>
                    </div>
                </div>
                <div class="meal-macros">
                    <span class="cal">${m.cal} kcal</span>
                    <span class="macros">P:${m.p}g | C:${m.c}g | G:${m.f}g</span>
                    <button class="icon-btn delete-meal" data-id="${m.id}" style="color:#ef4444; margin-top:0.25rem; margin-left: auto;">
                        <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(el);
        });

        // Add delete listeners
        document.querySelectorAll('.delete-meal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                store.deleteMeal(store.getTodayDateString(), id);
                renderMeals();
                // If we also want to update dashboard real-time, we could, but user navigates there later
            });
        });

        lucide.createIcons();
    }

    // --- FORMS & ACTIONS ---
    function setupForms() {
        // AI Analyze Meal Button
        const btnAnalyzeAI = document.getElementById('btn-analyze-ai');
        const manualMacros = document.getElementById('manual-macros');
        
        btnAnalyzeAI.addEventListener('click', async () => {
            const mealName = document.getElementById('meal-name').value;
            if (!mealName) {
                alert("Por favor, digite o alimento primeiro.");
                return;
            }

            const originalText = btnAnalyzeAI.innerHTML;
            btnAnalyzeAI.innerHTML = '<span class="loading-dots">Analisando</span>';
            btnAnalyzeAI.disabled = true;

            try {
                const data = await api.analyzeMeal(mealName);
                document.getElementById('meal-cal').value = data.calorias || 0;
                document.getElementById('meal-protein').value = data.proteinas || 0;
                document.getElementById('meal-carbs').value = data.carboidratos || 0;
                document.getElementById('meal-fat').value = data.gorduras || 0;
                manualMacros.classList.remove('hidden');
            } catch (e) {
                alert(e.message);
                manualMacros.classList.remove('hidden'); // show anyway so user can type
            } finally {
                btnAnalyzeAI.innerHTML = originalText;
                btnAnalyzeAI.disabled = false;
                lucide.createIcons();
            }
        });

        // Add Meal Submit
        document.getElementById('add-meal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const mealObj = {
                name: document.getElementById('meal-name').value,
                type: document.getElementById('meal-type').value,
                cal: parseInt(document.getElementById('meal-cal').value) || 0,
                p: parseInt(document.getElementById('meal-protein').value) || 0,
                c: parseInt(document.getElementById('meal-carbs').value) || 0,
                f: parseInt(document.getElementById('meal-fat').value) || 0,
            };

            store.addMeal(store.getTodayDateString(), mealObj);
            e.target.reset();
            manualMacros.classList.add('hidden');
            renderMeals();
        });

        // Add Weight
        document.getElementById('add-weight-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const w = parseFloat(document.getElementById('weight-kg').value);
            const waist = parseFloat(document.getElementById('waist-cm').value) || null;
            const hip = parseFloat(document.getElementById('hip-cm').value) || null;
            const fat = parseFloat(document.getElementById('body-fat').value) || null;

            store.addWeightRecord(w, waist, hip, fat);
            e.target.reset();
            alert("Peso registrado com sucesso!");
            renderWeightForm();
        });

        // Goals
        const btnGoalAI = document.getElementById('btn-generate-goals-ai');
        btnGoalAI.addEventListener('click', async () => {
            const profile = store.getProfile();
            const original = btnGoalAI.innerHTML;
            btnGoalAI.innerHTML = '<span class="loading-dots">Gerando</span>';
            btnGoalAI.disabled = true;

            try {
                // To get a good goal, we pass the current weight too
                const weights = store.getWeightHistory();
                const currWeight = weights.length > 0 ? weights[weights.length-1].weight : 70;
                const context = { ...profile, currentWeight: currWeight };
                
                const recs = await api.generateGoals(context);
                document.getElementById('goal-weight').value = recs.goalWeight || '';
                document.getElementById('goal-calories').value = recs.goalCalories || '';
                
            } catch(e) {
                alert(e.message);
            } finally {
                btnGoalAI.innerHTML = original;
                btnGoalAI.disabled = false;
                lucide.createIcons();
            }
        });

        document.getElementById('goals-form').addEventListener('submit', (e) => {
            e.preventDefault();
            store.updateProfile({
                goalType: document.getElementById('goal-type').value,
                goalWeight: parseFloat(document.getElementById('goal-weight').value) || store.getProfile().goalWeight,
                height: parseFloat(document.getElementById('goal-height').value) || store.getProfile().height,
                goalCalories: parseInt(document.getElementById('goal-calories').value) || store.getProfile().goalCalories
            });
            alert("Metas atualizadas!");
        });
    }

    function renderWeightForm() {
        const history = store.getWeightHistory();
        const profile = store.getProfile();
        const imcCard = document.getElementById('imc-card');
        
        if (history.length > 0 && profile.height) {
            const currentWeight = history[history.length - 1].weight;
            const heightM = profile.height / 100;
            const imc = currentWeight / (heightM * heightM);
            
            document.getElementById('imc-value').textContent = imc.toFixed(1);
            
            const classificationEl = document.getElementById('imc-classification');
            let text = '';
            let color = '';
            let bg = '';
            
            if (imc < 18.5) { text = 'Abaixo do Peso'; color = '#d97706'; bg = '#fef3c7'; }
            else if (imc < 25) { text = 'Peso Normal'; color = '#059669'; bg = '#d1fae5'; }
            else if (imc < 30) { text = 'Sobrepeso'; color = '#d97706'; bg = '#fef3c7'; }
            else { text = 'Obesidade'; color = '#dc2626'; bg = '#fee2e2'; }
            
            classificationEl.textContent = text;
            classificationEl.style.color = color;
            classificationEl.style.backgroundColor = bg;
            
            imcCard.style.display = 'block';
        } else {
            imcCard.style.display = 'none';
        }
    }

    function renderGoalsForm() {
        const profile = store.getProfile();
        document.getElementById('goal-type').value = profile.goalType;
        document.getElementById('goal-weight').value = profile.goalWeight;
        document.getElementById('goal-height').value = profile.height || '';
        document.getElementById('goal-calories').value = profile.goalCalories;
    }

    // --- HISTORY ---
    function renderHistory() {
        const ctx = document.getElementById('history-macros-chart');
        if (!ctx) return;
        
        // We'll show the last 7 days of macros
        const dates = [];
        const today = new Date();
        for(let i=6; i>=0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const tzOffset = d.getTimezoneOffset() * 60000;
            dates.push(new Date(d.getTime() - tzOffset).toISOString().split('T')[0]);
        }

        const pData = [];
        const cData = [];
        const fData = [];

        dates.forEach(d => {
            const m = store.getDailyMacros(d);
            pData.push(m.p);
            cData.push(m.c);
            fData.push(m.f);
        });

        if (historyChart) historyChart.destroy();

        historyChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: dates.map(formatDate),
                datasets: [
                    { label: 'Proteínas (g)', data: pData, backgroundColor: '#ef4444' },
                    { label: 'Carboidratos (g)', data: cData, backgroundColor: '#f59e0b' },
                    { label: 'Gorduras (g)', data: fData, backgroundColor: '#3b82f6' }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true }
                }
            }
        });
    }

    // --- CHAT WIDGET ---
    function setupChatWidget() {
        const toggleBtn = document.getElementById('chat-toggle-btn');
        const closeBtn = document.getElementById('chat-close-btn');
        const windowEl = document.getElementById('chat-window');
        const sendBtn = document.getElementById('chat-send-btn');
        const inputEl = document.getElementById('chat-input');
        const msgsEl = document.getElementById('chat-messages');

        toggleBtn.addEventListener('click', () => {
            windowEl.classList.toggle('hidden');
            renderChatHistory();
        });

        closeBtn.addEventListener('click', () => {
            windowEl.classList.add('hidden');
        });

        const sendMessage = async () => {
            const text = inputEl.value.trim();
            if (!text) return;

            // UI Add user msg
            inputEl.value = '';
            appendMessage('user', text);
            store.addChatMessage('user', text);

            // Add loading indicator
            const loadId = 'loading-' + Date.now();
            const loadEl = document.createElement('div');
            loadEl.id = loadId;
            loadEl.className = 'message assistant loading-dots';
            loadEl.textContent = 'Digitando';
            msgsEl.appendChild(loadEl);
            msgsEl.scrollTop = msgsEl.scrollHeight;

            try {
                const history = store.getChatHistory();
                const profile = store.getProfile();
                const weights = store.getWeightHistory();
                const currWeight = weights.length > 0 ? weights[weights.length-1].weight : null;
                const macros = store.getDailyMacros();

                const context = {
                    tdee_calories: profile.goalCalories,
                    current_weight: currWeight,
                    calories_consumed_today: macros.cal
                };

                const reply = await api.chatMessage(history, context, text);

                // remove loader
                document.getElementById(loadId).remove();

                appendMessage('assistant', reply);
                store.addChatMessage('assistant', reply);

            } catch (err) {
                document.getElementById(loadId).remove();
                appendMessage('assistant', err.message);
                // Don't save error to store
            }
        };

        sendBtn.addEventListener('click', sendMessage);
        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    function renderChatHistory() {
        const msgsEl = document.getElementById('chat-messages');
        const history = store.getChatHistory();
        // Clear except first greeting
        msgsEl.innerHTML = `
            <div class="message assistant">
                <p>Olá! Sou seu assistente Vitta. Como posso ajudar com sua dieta ou treino hoje?</p>
            </div>
        `;

        history.forEach(msg => {
            appendMessage(msg.role, msg.content, msgsEl);
        });
    }

    function appendMessage(role, text, container = document.getElementById('chat-messages')) {
        const el = document.createElement('div');
        el.className = `message ${role}`;
        // Simple line break support
        el.innerHTML = text.replace(/\n/g, '<br>');
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
    }

    // --- UTILS ---
    function animateCounter(id, target) {
        const el = document.getElementById(id);
        const duration = 1000;
        const start = parseInt(el.textContent) || 0;
        const diff = target - start;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // easeOutQuart
            const ease = 1 - Math.pow(1 - progress, 4);
            el.textContent = Math.floor(start + diff * ease);

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        requestAnimationFrame(update);
    }

    function formatDate(dateStr) {
        // From YYYY-MM-DD to DD/MM
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
        return dateStr;
    }
});
