const API_URL = '/api';
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

let jobSearchTimeout;
let jobAddressValidated = false;
const jobAddressInput = document.getElementById('jobAddress');
const jobSuggestionsDiv = document.getElementById('jobAddressSuggestions');
const jobStatusEl = document.getElementById('jobLocationStatus');

function useMyLocation() {
    jobStatusEl.textContent = 'Obteniendo ubicación...';
    
    if (!navigator.geolocation) {
        jobStatusEl.textContent = '❌ Tu navegador no soporta geolocalización';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            jobStatusEl.textContent = '✅ Obteniendo dirección...';
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
                    headers: { 'User-Agent': 'SanQuintinJobsApp/1.0' }
                });
                const data = await response.json();
                if (data && data.address) {
                    const formattedAddress = formatAddress(data.address);
                    jobAddressInput.value = formattedAddress;
                    document.getElementById('jobLatitude').value = lat;
                    document.getElementById('jobLongitude').value = lng;
                    jobStatusEl.textContent = '✅ Ubicación obtenida';
                    jobAddressValidated = true;
                }
            } catch (err) {
                console.error('Reverse geocoding failed:', err);
                jobStatusEl.textContent = '❌ Error obteniendo dirección';
            }
        },
        (error) => {
            jobStatusEl.textContent = '❌ No se pudo obtener la ubicación';
            console.error('Geolocation error:', error);
        }
    );
}

function formatAddress(address) {
    const parts = [];
    
    // Street
    if (address.road) {
        let street = address.road;
        if (address.house_number) {
            street = `${address.house_number} ${address.road}`;
        }
        parts.push(street);
    }
    
    // Neighborhood (optional)
    if (address.suburb) parts.push(address.suburb);
    else if (address.neighbourhood) parts.push(address.neighbourhood);
    
    // City
    const city = address.city || address.town || address.village || address.hamlet;
    if (city) parts.push(city);
    
    // State
    if (address.state) parts.push(address.state);
    
    return parts.join(', ');
}

jobAddressInput.addEventListener('input', function() {
    const query = this.value.trim();
    
    // Reset validation when user modifies address
    jobAddressValidated = false;
    document.getElementById('jobLatitude').value = '';
    document.getElementById('jobLongitude').value = '';
    
    clearTimeout(jobSearchTimeout);
    
    if (query.length < 3) {
        jobSuggestionsDiv.style.display = 'none';
        jobStatusEl.textContent = '';
        return;
    }
    
    jobStatusEl.textContent = 'Buscando direcciones...';
    
    jobSearchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`, {
                headers: { 'User-Agent': 'SanQuintinJobsApp/1.0' }
            });
            const results = await response.json();
            
            if (results && results.length > 0) {
                jobSuggestionsDiv.innerHTML = results.map(result => {
                    const formatted = formatAddress(result.address);
                    return `<div class="job-suggestion-item"
                         data-lat="${result.lat}" 
                         data-lon="${result.lon}" 
                         data-address="${formatted}">
                      ${formatted}
                    </div>`;
                }).join('');
                jobSuggestionsDiv.style.display = 'block';
                jobStatusEl.textContent = '';
                
                document.querySelectorAll('.job-suggestion-item').forEach(item => {
                    item.addEventListener('click', function() {
                        jobAddressInput.value = this.getAttribute('data-address');
                        document.getElementById('jobLatitude').value = this.getAttribute('data-lat');
                        document.getElementById('jobLongitude').value = this.getAttribute('data-lon');
                        
                        jobSuggestionsDiv.style.display = 'none';
                        jobStatusEl.textContent = '✅ Dirección seleccionada';
                        jobAddressValidated = true;
                    });
                });
            } else {
                jobSuggestionsDiv.innerHTML = '<div style="padding:0.75rem; color:#999;">No se encontraron direcciones</div>';
                jobSuggestionsDiv.style.display = 'block';
                jobStatusEl.textContent = '';
            }
        } catch (err) {
            console.error('Search error:', err);
            jobSuggestionsDiv.style.display = 'none';
            jobStatusEl.textContent = '❌ Error buscando direcciones';
        }
    }, 300);
});

document.addEventListener('click', function(e) {
    if (!jobAddressInput.contains(e.target) && !jobSuggestionsDiv.contains(e.target)) {
        jobSuggestionsDiv.style.display = 'none';
    }
});

// Job form
document.getElementById('jobForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const address = document.getElementById('jobAddress').value;
    const latitude = document.getElementById('jobLatitude').value;
    const longitude = document.getElementById('jobLongitude').value;

    if (!address) {
        alert('Por favor ingresa la dirección del trabajo');
        return;
    }

    if (!latitude || !longitude || !jobAddressValidated) {
        alert('Por favor selecciona una dirección de las sugerencias o usa GPS.');
        return;
    }

    const jobData = {
        title: document.getElementById('title').value,
        location: address,
        address: address,
        latitude: latitude || null,
        longitude: longitude || null,
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
            document.getElementById('jobLocationStatus').textContent = '';
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
                <div class="job-info" style="flex: 1;">
                    <h3>${job.title}</h3>
                    <div class="job-detail">📍 ${job.location}</div>
                    <div class="job-detail">💰 $${job.pay_rate} ${job.pay_type}</div>
                    <div class="job-detail">📅 ${new Date(job.date).toLocaleDateString('es-MX')}</div>
                    <div class="job-detail">⏱️ ${job.duration} horas</div>
                    ${job.transport_provided ? '<div class="tag">🚌 Transporte incluido</div>' : ''}
                </div>
                <div class="job-actions" style="margin-left: 15px;">
                    <button onclick="deleteJob(${job.id})" class="danger" style="width: auto; padding: 8px 16px;">Eliminar</button>
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