/**
 * VitaTrack Data Store Management (Using LocalStorage)
 */

const USERS_DB_KEY = 'vitatrack_users';
const SESSION_KEY = 'vitatrack_session';

class Store {
    constructor() {
        this.users = this.loadUsers();
        this.currentUserEmail = localStorage.getItem(SESSION_KEY);
        this.data = this.currentUserEmail ? this.users[this.currentUserEmail] : null;

        // Try to handle old data migration if someone complains
        const oldData = localStorage.getItem('vitatrack_data');
        if (oldData && !this.users['legacy_user@vitatrack.com']) {
            try {
                const parsed = JSON.parse(oldData);
                parsed.password = '123456'; 
                this.users['legacy_user@vitatrack.com'] = parsed;
                this.saveUsers();
            } catch(e){}
            localStorage.removeItem('vitatrack_data');
        }
    }

    loadUsers() {
        try {
            const raw = localStorage.getItem(USERS_DB_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.error("Failed to parse localStorage", e);
        }
        return {};
    }

    saveUsers() {
        if (this.currentUserEmail && this.data) {
            this.users[this.currentUserEmail] = this.data;
        }
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(this.users));
    }

    saveData() {
        this.saveUsers();
    }

    // --- Auth Methods ---
    login(email, password) {
        const user = this.users[email];
        if (!user) throw new Error('Usuário não encontrado');
        if (user.password !== password) throw new Error('Senha incorreta');
        
        this.currentUserEmail = email;
        this.data = user;
        localStorage.setItem(SESSION_KEY, email);
    }

    register(name, email, password) {
        if (this.users[email]) throw new Error('E-mail já está em uso');
        
        this.users[email] = {
            password: password,
            profile: {
                name: name,
                goalType: 'lose',
                goalWeight: 75,
                height: 170,
                goalCalories: 2000,
                goalProtein: 150,
                goalCarbs: 200,
                goalFat: 60,
            },
            weightHistory: [],
            meals: {},
            messages: []
        };
        
        this.currentUserEmail = email;
        this.data = this.users[email];
        localStorage.setItem(SESSION_KEY, email);
        this.saveUsers();
    }

    logout() {
        this.currentUserEmail = null;
        this.data = null;
        localStorage.removeItem(SESSION_KEY);
    }

    isLoggedIn() {
        return !!this.currentUserEmail;
    }

    getTodayDateString() {
        const d = new Date();
        const tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
    }

    // Profile & Goals
    getProfile() {
        return this.data.profile;
    }

    updateProfile(updates) {
        this.data.profile = { ...this.data.profile, ...updates };
        this.saveData();
    }

    // Weight
    getWeightHistory() {
        return this.data.weightHistory;
    }

    addWeightRecord(weight, waist, hip, bodyFat) {
        const today = this.getTodayDateString();
        // Check if today already has a record, if so update it
        const existingIndex = this.data.weightHistory.findIndex(r => r.date === today);
        const record = { date: today, weight, waist, hip, bodyFat };
        
        if (existingIndex >= 0) {
            this.data.weightHistory[existingIndex] = record;
        } else {
            this.data.weightHistory.push(record);
            // Sort by date
            this.data.weightHistory.sort((a, b) => a.date.localeCompare(b.date));
        }
        this.saveData();
    }

    // Meals
    getMeals(dateStr = this.getTodayDateString()) {
        return this.data.meals[dateStr] || [];
    }

    addMeal(dateStr, mealObj) {
        if (!this.data.meals[dateStr]) {
            this.data.meals[dateStr] = [];
        }
        mealObj.id = Date.now().toString();
        this.data.meals[dateStr].push(mealObj);
        this.saveData();
    }

    deleteMeal(dateStr, id) {
        if (this.data.meals[dateStr]) {
            this.data.meals[dateStr] = this.data.meals[dateStr].filter(m => m.id !== id);
            this.saveData();
        }
    }

    getDailyMacros(dateStr = this.getTodayDateString()) {
        const meals = this.getMeals(dateStr);
        return meals.reduce((acc, meal) => {
            acc.cal += meal.cal || 0;
            acc.p += meal.p || 0;
            acc.c += meal.c || 0;
            acc.f += meal.f || 0;
            return acc;
        }, { cal: 0, p: 0, c: 0, f: 0 });
    }

    // Chat History
    getChatHistory() {
        return this.data.messages || [];
    }

    addChatMessage(role, content) {
        if (!this.data.messages) this.data.messages = [];
        this.data.messages.push({ role, content });
        this.saveData();
    }

    resetData() {
        localStorage.removeItem(STORAGE_KEY);
        this.data = this.loadData();
    }
}

const store = new Store();
