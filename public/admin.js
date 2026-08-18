const ADMIN_API_URL = '/api/admin';

// Utilities
function showAlert(msg, isError = false) {
    const box = document.getElementById('alert-box');
    const msgEl = document.getElementById('alert-msg');
    if (!box || !msgEl) return;
    
    msgEl.textContent = msg;
    box.className = `rounded-xl p-4 mb-4 text-sm font-medium shadow-lg transition-all duration-300 transform translate-y-0 opacity-100 ${
        isError ? 'bg-red-900/60 text-red-200 border border-red-500/50' : 'bg-green-900/60 text-green-200 border border-green-500/50'
    }`;
    box.classList.remove('hidden');

    setTimeout(() => {
        box.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => box.classList.add('hidden'), 300);
    }, 4000);
}

function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    };
}

// Initialization
async function initAdmin() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        const emailEl = document.getElementById('admin-email');
        if (emailEl) emailEl.textContent = user.email;
    }
    
    await Promise.all([
        fetchConfigs(),
        fetchUsers()
    ]);
}

// Fetch and Render Configs
async function fetchConfigs() {
    try {
        const res = await fetch(`${ADMIN_API_URL}/config/tiers`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch configs');
        const data = await res.json();
        
        const container = document.getElementById('configs-container');
        if (!container) return;
        container.innerHTML = '';
        
        data.configs.forEach(config => {
            const el = document.createElement('div');
            el.className = 'glass-panel p-6 flex flex-col space-y-4 relative border border-white/10 hover:border-purple-400/40 transition-colors duration-300';
            
            // Badge for tier
            const badgeColor = config.tierName === 'PRO' 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                : 'bg-blue-500/20 text-blue-300 border-blue-500/40';
            
            el.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <h3 class="font-bold text-lg tracking-tight">${config.tierName} Tier</h3>
                    <span class="px-3 py-1 text-xs font-bold rounded-full border ${badgeColor}">${config.tierName}</span>
                </div>
                
                <div class="space-y-4 flex-grow">
                    <div>
                        <label class="block text-xs font-semibold opacity-75 uppercase tracking-wider mb-1.5">Max Requests</label>
                        <input type="number" id="limit-${config.id}" value="${config.requestLimit}" class="w-full glass-input rounded-lg px-3.5 py-2 text-sm">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold opacity-75 uppercase tracking-wider mb-1.5">Time Window (ms)</label>
                        <input type="number" id="window-${config.id}" value="${config.windowMs}" class="w-full glass-input rounded-lg px-3.5 py-2 text-sm">
                        <p class="text-xs opacity-50 mt-1">${config.windowMs / 1000} seconds</p>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold opacity-75 uppercase tracking-wider mb-1.5">Max API Keys</label>
                        <input type="number" id="keys-${config.id}" value="${config.maxApiKeys || 2}" class="w-full glass-input rounded-lg px-3.5 py-2 text-sm">
                    </div>
                </div>
                
                <button onclick="updateConfig('${config.id}')" class="mt-4 w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg flex justify-center items-center">
                    <span>Save Changes</span>
                </button>
            `;
            container.appendChild(el);
        });
    } catch (error) {
        showAlert(error.message, true);
    }
}

async function updateConfig(id) {
    const limit = document.getElementById(`limit-${id}`).value;
    const windowMs = document.getElementById(`window-${id}`).value;
    const maxApiKeys = document.getElementById(`keys-${id}`).value;
    
    try {
        const res = await fetch(`${ADMIN_API_URL}/config/tiers/${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ requestLimit: limit, windowMs, maxApiKeys })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update tier');
        
        showAlert('Tier configuration updated successfully. Changes take up to 5 mins.');
        fetchConfigs();
    } catch (error) {
        showAlert(error.message, true);
    }
}

let lastUsersStr = '';

// Fetch and Render Users
async function fetchUsers() {
    try {
        const res = await fetch(`${ADMIN_API_URL}/users`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch users');
        const data = await res.json();
        
        const newStr = JSON.stringify(data.users);
        if (newStr === lastUsersStr && document.getElementById('users-tbody').children.length > 0) return;
        lastUsersStr = newStr;

        const badge = document.getElementById('user-count-badge');
        if (badge) badge.textContent = `${data.users.length} Users Total`;
        
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (data.users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center opacity-60 text-sm">No users found.</td></tr>`;
            return;
        }
        
        data.users.forEach(u => {
            const tr = document.createElement('tr');
            
            const isBanned = u.isBanned;
            const rowClass = isBanned ? 'bg-red-950/20 opacity-80' : 'hover:bg-white/5 transition-colors';
            tr.className = rowClass;
            
            const banBtnClass = isBanned 
                ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                : 'bg-red-900/40 hover:bg-red-900/80 text-red-300 border border-red-800/50';
                
            const banBtnText = isBanned ? 'Unban User' : 'Ban User';
            
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10 rounded-full bg-black/20 flex items-center justify-center opacity-80 border border-white/10 font-bold">
                            ${u.email.charAt(0).toUpperCase()}
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium ${isBanned ? 'line-through text-red-400' : ''}">${u.email}</div>
                            <div class="text-xs opacity-50 font-mono" title="${u.id}">ID: ${u.id.substring(0,8)}...</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-semibold mb-1 opacity-90">${u.role}</div>
                    <div class="text-xs opacity-60 flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                        ${u.apiKeysCount} Keys
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <select onchange="updateRole('${u.id}', this.value)" class="glass-input text-xs rounded-md block p-1.5 cursor-pointer font-semibold outline-none mb-1.5" ${isBanned ? 'disabled' : ''}>
                        <option value="USER" ${u.role === 'USER' ? 'selected' : ''} class="bg-slate-800 text-white">USER</option>
                        <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''} class="bg-slate-800 text-white">ADMIN</option>
                    </select>
                    <select onchange="updateTier('${u.id}', this.value)" class="glass-input text-xs rounded-md block p-1.5 cursor-pointer font-semibold outline-none ${u.tier === 'PRO' ? 'text-amber-400 font-bold' : ''}" ${isBanned ? 'disabled' : ''}>
                        <option value="FREE" ${u.tier === 'FREE' ? 'selected' : ''} class="bg-slate-800 text-white">FREE</option>
                        <option value="PRO" ${u.tier === 'PRO' ? 'selected' : ''} class="bg-slate-800 text-white">PRO</option>
                    </select>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="toggleBan('${u.id}', ${!isBanned})" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${banBtnClass}">
                        ${banBtnText}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        showAlert(error.message, true);
    }
}

async function updateTier(userId, tier) {
    try {
        const res = await fetch(`${ADMIN_API_URL}/users/${userId}/tier`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ tier })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update tier');
        
        showAlert('User tier updated successfully.');
        fetchUsers();
    } catch (error) {
        showAlert(error.message, true);
        fetchUsers();
    }
}

async function updateRole(userId, role) {
    try {
        const res = await fetch(`${ADMIN_API_URL}/users/${userId}/role`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ role })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update role');
        
        showAlert('User role updated successfully.');
        fetchUsers();
    } catch (error) {
        showAlert(error.message, true);
        fetchUsers();
    }
}

async function toggleBan(userId, shouldBan) {
    const action = shouldBan ? 'ban' : 'unban';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    
    try {
        const res = await fetch(`${ADMIN_API_URL}/users/${userId}/ban`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ isBanned: shouldBan })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to ${action} user`);
        
        showAlert(data.message);
        fetchUsers();
    } catch (error) {
        showAlert(error.message, true);
    }
}

window.initAdmin = initAdmin;
window.updateConfig = updateConfig;
window.fetchUsers = fetchUsers;
window.updateTier = updateTier;
window.updateRole = updateRole;
window.toggleBan = toggleBan;
