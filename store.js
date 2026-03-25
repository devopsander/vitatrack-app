/**
 * VitaTrack Data Store Management (Using Firebase Firestore)
 */
import { db, auth } from './firebase-config.js';
import { 
    doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

class Store {
    constructor() {
        this.currentUserEmail = null;
        this.data = null;
        this.onUserLoaded = null; // Callback for app initialization

        // Listen for Auth changes
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUserEmail = user.email;
                this.data = await this.loadUserData(user.email);
                if (this.onUserLoaded) this.onUserLoaded(user);
            } else {
                this.currentUserEmail = null;
                this.data = null;
                if (this.onUserLoaded) this.onUserLoaded(null);
            }
        });
    }

    async loadUserData(email) {
        const userDoc = await getDoc(doc(db, 'users', email));
        if (userDoc.exists()) {
            return userDoc.data();
        }
        return null;
    }

    async saveData() {
        if (this.currentUserEmail && this.data) {
            await setDoc(doc(db, 'users', this.currentUserEmail), this.data);
        }
    }

    // --- Auth Methods ---
    async logout() {
        await signOut(auth);
        this.currentUserEmail = null;
        this.data = null;
    }

    isLoggedIn() {
        return !!this.currentUserEmail;
    }

    isAdmin() {
        // Define admin emails here
        const admins = ['mouraandersonsilva@gmail.com']; 
        return this.currentUserEmail && admins.includes(this.currentUserEmail);
    }

    getTodayDateString() {
        const d = new Date();
        const tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
    }

    // Profile & Goals
    getProfile() {
        return this.data ? this.data.profile : null;
    }

    async updateProfile(updates) {
        if (!this.data) return;
        this.data.profile = { ...this.data.profile, ...updates };
        await this.saveData();
    }

    // Weight
    getWeightHistory() {
        return this.data ? this.data.weightHistory : [];
    }

    async addWeightRecord(weight, waist, hip, bodyFat, photoFront = null, photoProfile = null) {
        if (!this.data) return;
        const today = this.getTodayDateString();
        const existingIndex = this.data.weightHistory.findIndex(r => r.date === today);
        const record = { date: today, weight, waist, hip, bodyFat, photoFront, photoProfile };
        
        if (existingIndex >= 0) {
            this.data.weightHistory[existingIndex] = { ...this.data.weightHistory[existingIndex], ...record };
        } else {
            this.data.weightHistory.push(record);
            this.data.weightHistory.sort((a, b) => a.date.localeCompare(b.date));
        }
        await this.saveData();
    }

    async deleteWeightRecord(date) {
        if (!this.data) return;
        this.data.weightHistory = this.data.weightHistory.filter(r => r.date !== date);
        await this.saveData();
    }

    // Meals
    getMeals(dateStr = this.getTodayDateString()) {
        return this.data && this.data.meals ? (this.data.meals[dateStr] || []) : [];
    }

    async addMeal(dateStr, mealObj) {
        if (!this.data) return;
        if (!this.data.meals) this.data.meals = {};
        if (!this.data.meals[dateStr]) {
            this.data.meals[dateStr] = [];
        }
        mealObj.id = Date.now().toString();
        this.data.meals[dateStr].push(mealObj);
        await this.saveData();
    }

    async deleteMeal(dateStr, id) {
        if (this.data && this.data.meals && this.data.meals[dateStr]) {
            this.data.meals[dateStr] = this.data.meals[dateStr].filter(m => m.id !== id);
            await this.saveData();
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
        return this.data ? (this.data.messages || []) : [];
    }

    async addChatMessage(role, content) {
        if (!this.data) return;
        if (!this.data.messages) this.data.messages = [];
        this.data.messages.push({ role, content });
        await this.saveData();
    }

    // Admin Stats
    async getAdminStats() {
        if (!this.isAdmin()) return null;
        
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const users = [];
            usersSnap.forEach(doc => {
                users.push({ email: doc.id, ...doc.data() });
            });

            const totalUsers = users.length;
            const today = this.getTodayDateString();
            
            // Logic for "Active Today" (count users who have a meal or weight record today)
            const activeToday = users.filter(u => {
                const updatedToday = (u.meals && u.meals[today]) || 
                                     (u.weightHistory && u.weightHistory.some(r => r.date === today));
                return updatedToday;
            }).length;

            return {
                totalUsers,
                activeToday,
                usersList: users.map(u => ({
                    name: u.profile.name,
                    email: u.email,
                    goal: u.profile.goalType
                }))
            };
        } catch (e) {
            console.error("Error fetching admin stats", e);
            return null;
        }
    }
}

const store = new Store();
export default store;
window.store = store; // Expose globally for legacy scripts
