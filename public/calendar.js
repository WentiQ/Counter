// --- Imports ---
import {
    auth,
    db
} from './firebase-config.js';

import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    doc,
    getDoc
} from 'firebase/firestore';

import {
    onAuthStateChanged,
    signOut
} from 'firebase/auth';

// --- DOM Elements ---
const loadingOverlay = document.getElementById('loading-overlay');
const templeName = document.getElementById('temple-name');
const templeId = document.getElementById('temple-id');
const currentMonthDisplay = document.getElementById('current-month');
const calendarGrid = document.getElementById('calendar-grid');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const logsModal = document.getElementById('logs-modal');
const modalDate = document.getElementById('modal-date');
const logsTableBody = document.getElementById('logs-table-body');
const closeModalBtn = document.getElementById('close-modal');
const exportExcelBtn = document.getElementById('export-excel');
const logoutBtn = document.getElementById('logout-btn');

// --- Global Variables ---
let currentDate = new Date();
let currentUserTempleId = null;

// --- Helper Functions ---
function setLoading(isLoading) {
    loadingOverlay.style.display = isLoading ? 'flex' : 'none';
}

function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}

function formatTime(timestamp) {
    return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }).format(new Date(timestamp));
}

// --- Calendar Functions ---
function generateCalendar(year, month) {
    calendarGrid.innerHTML = '';
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    // Update month display
    currentMonthDisplay.textContent = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long'
    }).format(firstDay);

    // Add empty cells for padding
    for (let i = 0; i < startPadding; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'aspect-square p-2 bg-gray-50 rounded-lg';
        calendarGrid.appendChild(emptyCell);
    }

    // Add calendar days
    for (let day = 1; day <= totalDays; day++) {
        const dateCell = document.createElement('div');
        dateCell.className = 'aspect-square p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors';
        
        const dateNum = document.createElement('div');
        dateNum.className = 'text-lg font-semibold text-gray-700';
        dateNum.textContent = day;
        
        const countDisplay = document.createElement('div');
        countDisplay.className = 'mt-2 text-sm text-blue-600 font-semibold count-display';
        countDisplay.dataset.date = `${year}-${month + 1}-${day}`;
        countDisplay.textContent = '...';
        
        dateCell.appendChild(dateNum);
        dateCell.appendChild(countDisplay);
        
        // Add click handler
        dateCell.addEventListener('click', () => {
            const clickedDate = new Date(year, month, day);
            showDailyLogs(clickedDate);
        });
        
        calendarGrid.appendChild(dateCell);
    }
}

async function fetchDailyTotals(year, month) {
    if (!currentUserTempleId) return;

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    
    try {
        const logsRef = collection(db, 'temples', currentUserTempleId, 'logs');
        const q = query(
            logsRef,
            where('timestamp', '>=', startDate.toISOString()),
            where('timestamp', '<=', endDate.toISOString())
        );
        
        const snapshot = await getDocs(q);
        const dailyTotals = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp.split('T')[0];
            dailyTotals[date] = (dailyTotals[date] || 0) + data.count;
        });
        
        // Update count displays
        const countDisplays = document.querySelectorAll('.count-display');
        countDisplays.forEach(display => {
            const [y, m, d] = display.dataset.date.split('-');
            const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            display.textContent = dailyTotals[date] || '0';
        });
        
    } catch (error) {
        console.error('Error fetching daily totals:', error);
    }
}

async function showDailyLogs(date) {
    if (!currentUserTempleId) return;
    
    setLoading(true);
    modalDate.textContent = formatDate(date);
    logsTableBody.innerHTML = '';
    
    try {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        const logsRef = collection(db, 'temples', currentUserTempleId, 'logs');
        const q = query(
            logsRef,
            where('timestamp', '>=', startOfDay.toISOString()),
            where('timestamp', '<=', endOfDay.toISOString()),
            orderBy('timestamp', 'desc') // Most recent first
        );
        
        const snapshot = await getDocs(q);
        let dailyLogs = [];
        
        snapshot.forEach(doc => {
            dailyLogs.push(doc.data());
        });

        // Add total row at the top
        const totalCount = dailyLogs.reduce((sum, log) => sum + log.count, 0);
        const totalRow = document.createElement('tr');
        totalRow.className = 'bg-blue-50 font-bold';
        totalRow.innerHTML = `
            <td class="px-6 py-4" colspan="2">TOTAL</td>
            <td class="px-6 py-4">${totalCount}</td>
        `;
        logsTableBody.appendChild(totalRow);

        // Add separator row
        const separatorRow = document.createElement('tr');
        separatorRow.innerHTML = '<td colspan="3" class="border-t-2 border-gray-300"></td>';
        logsTableBody.appendChild(separatorRow);

        // Add individual logs
        dailyLogs.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${formatTime(log.timestamp)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${log.servantName}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${log.count}
                </td>
            `;
            logsTableBody.appendChild(row);
        });
        
        logsModal.style.display = 'flex';
    } catch (error) {
        console.error('Error fetching daily logs:', error);
    } finally {
        setLoading(false);
    }
}

function exportToExcel() {
    const dateStr = modalDate.textContent;
    const rows = Array.from(logsTableBody.querySelectorAll('tr'));
    let csvContent = 'Time,Servant,Plates Count\n';
    
    rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length === 3) {
            // Regular row
            csvContent += `${cells[0].textContent},${cells[1].textContent},${cells[2].textContent}\n`;
        } else if (cells.length === 2) {
            // Total row
            csvContent += `TOTAL,,${cells[1].textContent}\n`;
        }
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prasad_count_${dateStr.replace(/[, ]/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// --- Event Listeners ---
prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    generateCalendar(currentDate.getFullYear(), currentDate.getMonth());
    fetchDailyTotals(currentDate.getFullYear(), currentDate.getMonth());
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    generateCalendar(currentDate.getFullYear(), currentDate.getMonth());
    fetchDailyTotals(currentDate.getFullYear(), currentDate.getMonth());
});

closeModalBtn.addEventListener('click', () => {
    logsModal.style.display = 'none';
});

exportExcelBtn.addEventListener('click', exportToExcel);

// Back to dashboard handler
const backToDashboard = document.getElementById('back-to-dashboard');
backToDashboard.addEventListener('click', () => {
    const userRole = document.getElementById('user-role').value;
    // Store auth state in session storage
    sessionStorage.setItem('lastUserRole', userRole);
    window.location.href = 'index.html';
});

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    sessionStorage.clear(); // Clear any stored auth state
    window.location.href = 'index.html';
});

// Click outside modal to close
logsModal.addEventListener('click', (e) => {
    if (e.target === logsModal) {
        logsModal.style.display = 'none';
    }
});

// --- Authentication State Listener ---
onAuthStateChanged(auth, async (user) => {
    setLoading(true);
    
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
            window.location.href = 'index.html';
            return;
        }
        
        const userData = userDocSnap.data();
        currentUserTempleId = userData.temple_id;
        
        // Store user role
        document.getElementById('user-role').value = userData.role;
        
        // Update temple info
        templeName.textContent = userData.temple_name || 'Temple';
        templeId.textContent = currentUserTempleId;
        
        // Initialize calendar
        generateCalendar(currentDate.getFullYear(), currentDate.getMonth());
        fetchDailyTotals(currentDate.getFullYear(), currentDate.getMonth());
        
    } catch (error) {
        console.error('Error fetching user data:', error);
        window.location.href = 'index.html';
    } finally {
        setLoading(false);
    }
});