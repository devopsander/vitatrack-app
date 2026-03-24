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
    let isDashboardRendering = false; // Guard for async dashboard render

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

        // Reset scroll position to top
        document.querySelector('.main-content').scrollTop = 0;

        switch(viewName) {
            case 'dashboard':
                renderDashboard();
                break;
            case 'meals':
                renderMeals();
                break;
            case 'weight':
                renderWeightForm();
                renderWeightHistoryTable();
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
        if (isDashboardRendering) return;
        isDashboardRendering = true;

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

        isDashboardRendering = false;
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
        const container = document.getElementById('meals-list-container');
        const meals = store.getMeals();
        
        if (meals.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary); text-align:center;">Nenhuma refeição registrada hoje.</p>';
            return;
        }

        container.innerHTML = meals.map(m => `
            <div class="meal-item card" style="margin-bottom: 1rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                <div class="meal-info" style="display: flex; gap: 1rem; align-items: center;">
                    ${m.image ? `<div class="meal-img-thumbnail" style="width: 50px; height: 50px; border-radius: 8px; overflow: hidden;"><img src="${m.image}" style="width:100%; height:100%; object-fit:cover;"></div>` : ''}
                    <div>
                        <span class="meal-type-tag" style="font-size: 0.7rem; background: var(--bg-color); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary); text-transform: uppercase;">${m.type}</span>
                        <h4 style="margin: 0.25rem 0;">${m.name}</h4>
                        <p style="font-size: 0.85rem; color: var(--text-secondary);">${m.cal} kcal • P:${m.p}g C:${m.c}g G:${m.f}g</p>
                    </div>
                </div>
                <div class="meal-actions" style="display: flex; gap: 0.5rem;">
                    ${m.details && Object.keys(m.details).length > 0 ? 
                        `<button class="icon-btn btn-nutrition" data-id="${m.id}" title="Tabela Nutricional" style="color: var(--emerald-600);"><i data-lucide="info"></i></button>` : ''}
                    <button class="icon-btn btn-delete-meal" data-id="${m.id}" style="color: #ef4444;"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        `).join('');

        // Delete meal handlers
        document.querySelectorAll('.btn-delete-meal').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Excluir esta refeição?')) {
                    store.deleteMeal(store.getTodayDateString(), btn.dataset.id);
                    renderMeals();
                }
            });
        });

        // Nutrition info handlers
        document.querySelectorAll('.btn-nutrition').forEach(btn => {
            btn.addEventListener('click', () => {
                const meal = meals.find(m => m.id === btn.dataset.id);
                showNutritionModal(meal);
            });
        });

        lucide.createIcons();
        // Only update dashboard if we are actually ON the dashboard
        if (currentView === 'dashboard') {
            renderDashboard();
        }
    }

    function showNutritionModal(meal) {
        const modal = document.getElementById('nutrition-modal');
        const details = document.getElementById('nutrition-details');
        const d = meal.details || {};

        details.innerHTML = `
            <div class="nutrition-table" style="font-family: sans-serif;">
                <div class="nutrient-row main"><span>Calorias</span><span>${meal.cal} kcal</span></div>
                <div class="nutrient-row main"><span>Proteínas</span><span>${meal.p} g</span></div>
                <div class="nutrient-row main"><span>Gorduras Totais</span><span>${meal.f} g</span></div>
                <div class="nutrient-row sub"><span>Gorduras Saturadas</span><span>${d.gorduras_saturadas || 0} g</span></div>
                <div class="nutrient-row main"><span>Carboidratos</span><span>${meal.c} g</span></div>
                <div class="nutrient-row sub"><span>Açúcares</span><span>${d.acucar || 0} g</span></div>
                <div class="nutrient-row sub"><span>Fibras</span><span>${d.fibras || 0} g</span></div>
                <div class="nutrient-row main"><span>Sódio</span><span>${d.sodio_mg || 0} mg</span></div>
                <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--border-color);">
                <div class="nutrient-row"><span>Vitamina C</span><span>${d.vitamina_c_mg || 0} mg</span></div>
                <div class="nutrient-row"><span>Ferro</span><span>${d.ferro_mg || 0} mg</span></div>
                <div class="nutrient-row"><span>Cálcio</span><span>${d.calcio_mg || 0} mg</span></div>
                <p style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-secondary); font-style: italic;">${d.comentarios || ''}</p>
            </div>
        `;
        modal.classList.remove('hidden');
    }

    // Modal close behavior (move to setupForms or separate)
    document.getElementById('close-nutrition-modal').addEventListener('click', () => {
        document.getElementById('nutrition-modal').classList.add('hidden');
    });

    // Removed redundant updateDashboardMacros as it's now handled inline in renderMeals if needed.

    // --- FORMS & ACTIONS ---
    function setupForms() {
        // AI Analyze Meal Button
        const btnAnalyzeAI = document.getElementById('btn-analyze-ai');
        const manualMacros = document.getElementById('manual-macros');
        
        // --- MEAL PHOTO UPLOAD ---
        const btnUploadMealPhoto = document.getElementById('btn-upload-meal-photo');
        const mealPhotoInput = document.getElementById('meal-photo-input');
        const mealPhotoPreview = document.getElementById('meal-photo-preview');
        let currentMealPhotoBase64 = null;

        btnUploadMealPhoto.addEventListener('click', () => mealPhotoInput.click());

        mealPhotoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    currentMealPhotoBase64 = event.target.result.split(',')[1];
                    mealPhotoPreview.innerHTML = `<img src="${event.target.result}">`;
                    mealPhotoPreview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });

        btnAnalyzeAI.addEventListener('click', async () => {
            const mealName = document.getElementById('meal-name').value;
            // Analysis can be text-only OR image-based
            if (!mealName && !currentMealPhotoBase64) {
                alert("Por favor, digite o alimento ou suba uma foto.");
                return;
            }

            const originalText = btnAnalyzeAI.innerHTML;
            btnAnalyzeAI.innerHTML = '<span class="loading-dots">Analisando</span>';
            btnAnalyzeAI.disabled = true;

            try {
                const data = await api.analyzeMeal(mealName || "esta refeição", currentMealPhotoBase64);
                
                if (!mealName && data.nome) {
                    document.getElementById('meal-name').value = data.nome;
                }
                
                document.getElementById('meal-cal').value = data.calorias || 0;
                document.getElementById('meal-protein').value = data.proteinas || 0;
                document.getElementById('meal-carbs').value = data.carboidratos || 0;
                document.getElementById('meal-fat').value = data.gorduras || 0;
                
                // Store detailed nutrition in a temporary attribute or hidden field if needed
                btnAnalyzeAI.dataset.nutrition = JSON.stringify(data);
                
                manualMacros.classList.remove('hidden');
            } catch (e) {
                alert("Erro na análise: " + e.message);
                manualMacros.classList.remove('hidden'); 
            } finally {
                btnAnalyzeAI.innerHTML = originalText;
                btnAnalyzeAI.disabled = false;
                lucide.createIcons();
            }
        });

        // Add Meal Submit
        document.getElementById('add-meal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const nutritionData = btnAnalyzeAI.dataset.nutrition ? JSON.parse(btnAnalyzeAI.dataset.nutrition) : {};
            const mealObj = {
                name: document.getElementById('meal-name').value,
                type: document.getElementById('meal-type').value,
                cal: parseInt(document.getElementById('meal-cal').value) || 0,
                p: parseInt(document.getElementById('meal-protein').value) || 0,
                c: parseInt(document.getElementById('meal-carbs').value) || 0,
                f: parseInt(document.getElementById('meal-fat').value) || 0,
                image: currentMealPhotoBase64 ? `data:image/jpeg;base64,${currentMealPhotoBase64}` : null,
                details: nutritionData
            };

            store.addMeal(store.getTodayDateString(), mealObj);
            e.target.reset();
            currentMealPhotoBase64 = null;
            mealPhotoPreview.classList.add('hidden');
            manualMacros.classList.add('hidden');
            delete btnAnalyzeAI.dataset.nutrition;
            renderMeals();
        });

        // --- WEIGHT PHOTOS ---
        let currentWeightPhotos = { front: null, profile: null };
        document.querySelectorAll('.btn-photo').forEach(btn => {
            btn.addEventListener('click', () => {
                const inputId = btn.dataset.target;
                document.getElementById(inputId).click();
            });
        });

        document.getElementById('photo-front').addEventListener('change', (e) => handleWeightPhoto(e, 'front'));
        document.getElementById('photo-profile').addEventListener('change', (e) => handleWeightPhoto(e, 'profile'));

        function handleWeightPhoto(e, type) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target.result;
                    currentWeightPhotos[type] = base64;
                    document.getElementById(`img-preview-${type}`).src = base64;
                    document.getElementById('weight-photos-preview').classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        }

        // Add Weight
        document.getElementById('add-weight-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const w = parseFloat(document.getElementById('weight-kg').value);
            const waist = parseFloat(document.getElementById('waist-cm').value) || null;
            const hip = parseFloat(document.getElementById('hip-cm').value) || null;
            const fat = parseFloat(document.getElementById('body-fat').value) || null;

            store.addWeightRecord(w, waist, hip, fat, currentWeightPhotos.front, currentWeightPhotos.profile);
            e.target.reset();
            currentWeightPhotos = { front: null, profile: null };
            document.getElementById('weight-photos-preview').classList.add('hidden');
            alert("Peso e medidas registrados!");
            renderWeightForm();
        });

        // TDEE Calculator
        document.getElementById('tdee-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const age = parseInt(document.getElementById('tdee-age').value);
            const gender = document.getElementById('tdee-gender').value;
            const activity = parseFloat(document.getElementById('tdee-activity').value);
            const profile = store.getProfile();
            const history = store.getWeightHistory();
            const weight = history.length > 0 ? history[history.length-1].weight : profile.goalWeight;
            const height = profile.height || 170;

            if (!age || !height || !weight) {
                alert("Por favor, preencha idade, altura (em Metas) e registre seu peso primeiro.");
                return;
            }

            // Mifflin-St Jeor Equation
            let bmr;
            if (gender === 'male') {
                bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
            } else {
                bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
            }

            const tdee = Math.round(bmr * activity);
            document.getElementById('tdee-val').textContent = tdee;
            document.getElementById('tdee-result').classList.remove('hidden');
        });

        document.getElementById('btn-use-tdee').addEventListener('click', () => {
            const tdee = parseInt(document.getElementById('tdee-val').textContent);
            store.updateProfile({ goalCalories: tdee });
            alert("Meta de calorias atualizada para " + tdee + " kcal!");
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

    function renderWeightHistoryTable() {
        const history = store.getWeightHistory().slice().reverse(); // Show latest first
        const tbody = document.getElementById('weight-history-body');
        const profile = store.getProfile();
        
        tbody.innerHTML = history.map(h => {
            let imc = '--';
            if (profile.height) {
                const hm = profile.height / 100;
                imc = (h.weight / (hm * hm)).toFixed(1);
            }

            return `
                <tr>
                    <td>${formatDate(h.date)}</td>
                    <td><strong>${h.weight} kg</strong></td>
                    <td>${h.waist || '--'} cm</td>
                    <td>
                        <div style="display:flex; gap: 4px;">
                            ${h.photoFront ? `<img src="${h.photoFront}" style="width:24px; height:24px; border-radius:4px; cursor:pointer;" onclick="window.open('${h.photoFront}')">` : ''}
                            ${h.photoProfile ? `<img src="${h.photoProfile}" style="width:24px; height:24px; border-radius:4px; cursor:pointer;" onclick="window.open('${h.photoProfile}')">` : ''}
                        </div>
                    </td>
                    <td>
                        <button class="icon-btn delete-weight" data-date="${h.date}" style="color:#ef4444;"><i data-lucide="trash-2" style="width:16px;"></i></button>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.delete-weight').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Excluir este registro?')) {
                    store.deleteWeightRecord(btn.dataset.date);
                    renderWeightForm();
                    renderWeightHistoryTable();
                }
            });
        });

        lucide.createIcons();
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
