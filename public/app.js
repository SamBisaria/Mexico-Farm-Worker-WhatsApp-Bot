const API_URL = 'https://dictatorially-untaunting-taren.ngrok-free.dev/api';
let authToken = null;

// Check if already logged in
window.onload = () => {
    authToken = localStorage.getItem('authToken');
    if (authToken) {
        showDashboard();
        loadJobs();
    }
};

// Login form
document.getElementById('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('companyName', data.company_name);
            showDashboard();
            loadJobs();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert(error);
    }
});

// Register form
document.getElementById('register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const company_name = document.getElementById('companyName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, company_name })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Registro exitoso. Por favor inicia sesión.');
            showLogin();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Error de conexión');
    }
});

// Job form
document.getElementById('jobForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const jobData = {
        title: document.getElementById('title').value,
        location: document.getElementById('location').value,
        pay_rate: document.getElementById('payRate').value,
        pay_type: document.getElementById('payType').value,
        transport_provided: document.getElementById('transport').checked ? 1 : 0,
        duration: document.getElementById('duration').value,
        date: document.getElementById('date').value,
        description: document.getElementById('description').value
    };

    try {
        const response = await fetch(`${API_URL}/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(jobData)
        });

        const data = await response.json();
        if (response.ok) {
            alert('Trabajo publicado exitosamente');
            document.getElementById('jobForm').reset();
            loadJobs();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Error de conexión');
    }
});

// Load jobs
async function loadJobs() {
    try {
        const response = await fetch(`${API_URL}/jobs`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const jobs = await response.json();
        const jobsList = document.getElementById('jobsList');
        
        if (jobs.length === 0) {
            jobsList.innerHTML = '<p>No hay trabajos publicados</p>';
            return;
        }

        jobsList.innerHTML = jobs.map(job => `
            <div class="job-card">
                <div class="job-info">
                    <h4>${job.title}</h4>
                    <p>📍 ${job.location}</p>
                    <p>💰 $${job.pay_rate} ${job.pay_type}</p>
                    <p>📅 ${new Date(job.date).toLocaleDateString('es-MX')}</p>
                    <p>⏱️ ${job.duration}</p>
                    ${job.transport_provided ? '<p>🚌 Transporte incluido</p>' : ''}
                </div>
                <div class="job-actions">
                    <button onclick="deleteJob(${job.id})">Eliminar</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading jobs:', error);
    }
}

// Delete job
async function deleteJob(jobId) {
    if (!confirm('¿Estás seguro de eliminar este trabajo?')) return;

    try {
        const response = await fetch(`${API_URL}/jobs/${jobId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            loadJobs();
        } else {
            alert('Error al eliminar el trabajo');
        }
    } catch (error) {
        alert('Error de conexión');
    }
}

// UI functions
function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('companyDisplay').textContent = localStorage.getItem('companyName');
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('companyName');
    authToken = null;
    showLogin();
}