// API Configurations
const API_BASE = '/api/v1';
const MOCK_BASE = '/api';

// App State
let selectedLat = null;
let selectedLng = null;
let citizenMap = null;
let citizenMarker = null;
let adminMap = null;
let adminMarkersGroup = null;
let verifiedCitizen = null;
let activeLogTimer = null;
let currentWizardStep = 0;

// Default Map Centers (Kampala Central)
const KAMPALA_LAT = 0.313611;
const KAMPALA_LNG = 32.581111;

// Image Preset Mock URLs
const PHOTO_PRESETS = {
  water: "https://images.unsplash.com/photo-1542013936693-8848e574047a?auto=format&fit=crop&q=80&w=400",
  pothole: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=400",
  power: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80&w=400"
};

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initCitizenMap();
  initAdminMap();
  setupEventListeners();
  
  // Initial data fetch
  refreshData();
  
  // Start background log polling
  activeLogTimer = setInterval(fetchLogs, 1500);
});

// ==========================================================================
// MAP FUNCTIONS
// ==========================================================================
function initCitizenMap() {
  citizenMap = L.map('citizen-map').setView([KAMPALA_LAT, KAMPALA_LNG], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(citizenMap);

  citizenMap.on('click', (e) => {
    updateCitizenMarker(e.latlng.lat, e.latlng.lng);
  });
}

function updateCitizenMarker(lat, lng) {
  selectedLat = lat;
  selectedLng = lng;
  document.getElementById('coord-lat').textContent = lat.toFixed(6);
  document.getElementById('coord-lng').textContent = lng.toFixed(6);

  if (citizenMarker) {
    citizenMarker.setLatLng([lat, lng]);
  } else {
    citizenMarker = L.marker([lat, lng], { draggable: true }).addTo(citizenMap);
    citizenMarker.on('dragend', function (event) {
      const position = citizenMarker.getLatLng();
      updateCitizenMarker(position.lat, position.lng);
    });
  }
}

function initAdminMap() {
  adminMap = L.map('admin-map').setView([KAMPALA_LAT, KAMPALA_LNG], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(adminMap);
  adminMarkersGroup = L.layerGroup().addTo(adminMap);
}

// Draw colored markers for admin map
function updateAdminMapMarkers(reports) {
  adminMarkersGroup.clearLayers();
  
  reports.forEach(r => {
    if (!r.latitude || !r.longitude) return;
    
    // Choose marker color based on status
    let color = 'red';
    if (r.status === 'In Progress') color = 'orange';
    if (r.status === 'Resolved') color = 'green';
    
    // Custom icon matching style colors
    const iconHtml = `<div style="
      background-color: ${color === 'red' ? '#EF4444' : color === 'orange' ? '#F59E0B' : '#10B981'}; 
      width: 12px; height: 12px; border-radius: 50%; 
      border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5);"></div>`;
    
    const customIcon = L.divIcon({
      html: iconHtml,
      className: 'custom-map-marker',
      iconSize: [12, 12]
    });
    
    const marker = L.marker([r.latitude, r.longitude], { icon: customIcon }).addTo(adminMarkersGroup);
    
    const popupContent = `
      <div style="font-family: sans-serif; font-size: 11px; color:#1e293b;">
        <b style="font-family: monospace;">${r.tracking_number}</b><br>
        <b>Category:</b> ${r.category.replace('_', ' ')}<br>
        <b>Status:</b> ${r.status}<br>
        <a href="#" onclick="selectTicketCard('${r.tracking_number}'); return false;" style="color:#FFD100; font-weight:bold; display:block; margin-top:5px;">View Details</a>
      </div>
    `;
    
    marker.bindPopup(popupContent);
  });
}

// Helper to select and scroll to a ticket card
window.selectTicketCard = function(trackingNumber) {
  const cards = document.querySelectorAll('.ticket-card');
  cards.forEach(c => {
    c.classList.remove('selected');
    if (c.getAttribute('data-id') === trackingNumber) {
      c.classList.add('selected');
      c.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
};

// ==========================================================================
// CORE API CALLS
// ==========================================================================
async function refreshData() {
  await fetchReports();
  await fetchLogs();
}

async function fetchReports() {
  try {
    const response = await fetch(`${API_BASE}/admin/reports`);
    if (!response.ok) throw new Error('Failed to fetch reports');
    const reports = await response.json();
    
    renderReportsList(reports);
    updateStats(reports);
    updateAdminMapMarkers(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
  }
}

async function fetchLogs() {
  try {
    const response = await fetch(`${API_BASE}/admin/logs`);
    if (!response.ok) throw new Error('Failed to fetch logs');
    const logs = await response.json();
    renderLogsList(logs);
  } catch (error) {
    console.error('Error fetching API logs:', error);
  }
}

// Render administrative tickets list
function renderReportsList(reports) {
  const container = document.getElementById('reports-list-container');
  if (reports.length === 0) {
    container.innerHTML = '<div class="empty-state">No tickets registered yet.</div>';
    return;
  }
  
  // Sort latest first
  reports.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  
  container.innerHTML = reports.map(r => {
    const isWater = r.category === 'WATER_LEAK';
    const isInfrastructure = r.category === 'BROKEN_INFRASTRUCTURE';
    const chipClass = isWater ? 'chip-water' : (isInfrastructure ? 'chip-infrastructure' : 'chip-failure');
    const cleanCategory = r.category.replace('_', ' ');

    return `
      <div class="ticket-card" data-id="${r.tracking_number}" onclick="toggleTicketSelection(this)">
        <div class="ticket-top">
          <span class="ticket-id">${r.tracking_number}</span>
          <span class="category-chip ${chipClass}">${cleanCategory}</span>
          <span class="status-chip status-${r.status.replace(' ', '-')}">${r.status}</span>
        </div>
        <div class="ticket-mid">
          <div class="ticket-photo">
            <img src="${r.photo_url}" alt="Evidence">
          </div>
          <div class="ticket-details">
            <p class="ticket-desc">${r.description}</p>
            <div class="ticket-loc">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              ${r.street_address}
            </div>
          </div>
        </div>
        <div class="ticket-drawer">
          <div class="drawer-info-grid">
            <div class="info-item">
              <span>Citizen NIN</span>
              <span>${r.citizen_nin}</span>
            </div>
            <div class="info-item">
              <span>Coordinates</span>
              <span>${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}</span>
            </div>
            <div class="info-item" style="grid-column: span 2;">
              <span>Assigned Division/Team</span>
              <span>${r.assigned_team || 'Not assigned yet'}</span>
            </div>
            ${r.resolution_remarks ? `
              <div class="info-item" style="grid-column: span 2;">
                <span>Resolution Remarks</span>
                <span style="color:var(--color-resolved);">${r.resolution_remarks}</span>
              </div>
            ` : ''}
          </div>
          
          <div class="drawer-actions" onclick="event.stopPropagation()">
            ${r.status === 'Received' ? `
              <div class="form-group" style="margin-bottom:0;">
                <label>Assign to Local Team</label>
                <div class="form-row-btn">
                  <input type="text" id="assign-input-${r.tracking_number}" placeholder="e.g. KCCA Central Division Crew A">
                  <button class="btn btn-primary btn-small" onclick="handleAssignTeam('${r.tracking_number}')">Assign</button>
                </div>
              </div>
            ` : ''}
            
            ${r.status === 'In Progress' ? `
              <div class="form-group" style="margin-bottom:0;">
                <label>Resolution Remarks & Complete</label>
                <textarea id="resolve-input-${r.tracking_number}" rows="2" placeholder="Describe the repairs done..."></textarea>
                <button class="btn btn-success btn-small btn-full" style="margin-top:6px;" onclick="handleResolveTicket('${r.tracking_number}')">Resolve and Notify Citizen</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Update stats header counts
function updateStats(reports) {
  const received = reports.filter(r => r.status === 'Received').length;
  const progress = reports.filter(r => r.status === 'In Progress').length;
  const resolved = reports.filter(r => r.status === 'Resolved').length;

  document.getElementById('count-received').textContent = received;
  document.getElementById('count-progress').textContent = progress;
  document.getElementById('count-resolved').textContent = resolved;
}

// Handle collapsible ticket selection
function toggleTicketSelection(card) {
  const isSelected = card.classList.contains('selected');
  document.querySelectorAll('.ticket-card').forEach(c => c.classList.remove('selected'));
  if (!isSelected) {
    card.classList.add('selected');
    // Zoom map to selection
    const trackingNumber = card.getAttribute('data-id');
    const reports = readDBReportsLocalCache();
    const report = reports.find(r => r.tracking_number === trackingNumber);
    if (report) {
      adminMap.setView([report.latitude, report.longitude], 14);
    }
  }
}

// Read database from cache to navigate maps (non-blocking)
function readDBReportsLocalCache() {
  const items = [];
  document.querySelectorAll('.ticket-card').forEach(card => {
    const tracking_number = card.getAttribute('data-id');
    const desc = card.querySelector('.ticket-desc').textContent;
    const loc = card.querySelector('.ticket-loc').textContent.trim();
    const coordsStr = card.querySelector('.drawer-info-grid .info-item:nth-child(2) span:last-child').textContent;
    const [lat, lng] = coordsStr.split(',').map(parseFloat);
    items.push({ tracking_number, description: desc, street_address: loc, latitude: lat, longitude: lng });
  });
  return items;
}

// Render dynamic colored integration traffic in Console
function renderLogsList(logs) {
  const container = document.getElementById('console-logs-container');
  if (logs.length === 0) {
    container.innerHTML = '<div class="console-empty-msg">No API transactions captured yet. Trigger actions in the portal to stream HTTP logs.</div>';
    return;
  }

  container.innerHTML = logs.map(log => {
    const isSuccess = log.response_status < 400;
    const cleanEndpoint = log.api_endpoint.replace('http://localhost:3000', '');

    return `
      <div class="log-item" id="log-card-${log.id}">
        <div class="log-item-header" onclick="toggleLogDrawer('${log.id}')">
          <span class="log-method log-method-${log.http_method}">${log.http_method}</span>
          <span class="log-endpoint" title="${cleanEndpoint}">${cleanEndpoint}</span>
          <span class="log-service">${log.service_name}</span>
          <span class="log-status ${isSuccess ? 'success' : 'failed'}">${log.response_status}</span>
        </div>
        <div class="log-drawer" id="log-drawer-${log.id}">
          <div>
            <div class="log-section-title">Request Body</div>
            <pre class="log-payload-box">${log.request_body || '(empty)'}</pre>
          </div>
          <div>
            <div class="log-section-title">Response Payload</div>
            <pre class="log-payload-box">${log.response_body || '(empty)'}</pre>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleLogDrawer(id) {
  const item = document.getElementById(`log-card-${id}`);
  item.classList.toggle('open');
}

// ==========================================================================
// CITIZEN FLOW HANDLERS
// ==========================================================================
async function handleVerifyIdentity() {
  const nin = document.getElementById('nin-input').value.trim();
  const surname = document.getElementById('surname-input').value.trim();
  const given = document.getElementById('given-input').value.trim();
  const statusMsg = document.getElementById('identity-status-message');

  if (!nin || !surname || !given) {
    showStatusMsg(statusMsg, 'Please fill in all identity verification fields.', 'error');
    return;
  }

  try {
    const response = await fetch(`${MOCK_BASE}/nira/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nin, surname, given_name: given })
    });

    const result = await response.json();

    if (response.ok) {
      verifiedCitizen = { nin, surname, given };
      showStatusMsg(statusMsg, `Identity Verified! Token: ${result.verification_id}`, 'success');
      
      // Unlock complaint section
      document.getElementById('sec-complaint-form').classList.remove('disabled');
      
      // Force map recalculation
      setTimeout(() => { citizenMap.invalidateSize(); }, 200);
      
      refreshData();
    } else {
      verifiedCitizen = null;
      showStatusMsg(statusMsg, result.message || 'NIRA identity check failed.', 'error');
      document.getElementById('sec-complaint-form').classList.add('disabled');
    }
  } catch (error) {
    showStatusMsg(statusMsg, 'Network error verifying identity.', 'error');
  }
}

async function handleSubmitReport() {
  const category = document.getElementById('category-select').value;
  const description = document.getElementById('desc-textarea').value.trim();
  const address = document.getElementById('address-input').value.trim();
  const photo = document.getElementById('photo-url-input').value;

  if (!verifiedCitizen) {
    alert("Verify identity first.");
    return;
  }

  if (!category || !description || !address || !selectedLat || !selectedLng) {
    alert("Please fill in all report fields, snap a photo, and select a location map coordinate.");
    return;
  }

  const payload = {
    citizen_nin: verifiedCitizen.nin,
    citizen_surname: verifiedCitizen.surname,
    citizen_given_name: verifiedCitizen.given,
    category,
    description,
    latitude: selectedLat,
    longitude: selectedLng,
    street_address: address,
    photo: photo
  };

  try {
    const response = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      alert(`Report submitted successfully! Tracking Number: ${result.tracking_number}. A GovSMS has been sent to your verified phone.`);
      
      // Reset inputs & locks
      document.getElementById('desc-textarea').value = '';
      document.getElementById('address-input').value = '';
      document.getElementById('photo-url-input').value = '';
      document.getElementById('photo-preview-box').innerHTML = '<p>No photo selected</p>';
      document.querySelectorAll('.btn-photo-preset').forEach(btn => btn.classList.remove('active'));
      
      if (citizenMarker) {
        citizenMap.removeLayer(citizenMarker);
        citizenMarker = null;
      }
      document.getElementById('coord-lat').textContent = '--';
      document.getElementById('coord-lng').textContent = '--';
      selectedLat = null;
      selectedLng = null;
      
      // Auto fill tracking input to show track flow
      document.getElementById('tracking-input').value = result.tracking_number;
      handleTrackReport();
      
      // Relock form
      document.getElementById('sec-complaint-form').classList.add('disabled');
      verifiedCitizen = null;
      document.getElementById('nin-input').value = '';
      document.getElementById('surname-input').value = '';
      document.getElementById('given-input').value = '';
      document.getElementById('identity-status-message').style.display = 'none';

      refreshData();
    } else {
      const err = await response.json();
      alert('Error: ' + err.message);
    }
  } catch (error) {
    alert('Network error submitting report.');
  }
}

async function handleTrackReport() {
  const trackingNumber = document.getElementById('tracking-input').value.trim();
  const box = document.getElementById('tracking-results-box');

  if (!trackingNumber) {
    box.style.display = 'none';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/reports/${trackingNumber}`);
    if (!response.ok) {
      box.innerHTML = '<div class="status-msg status-msg-error">Tracking number not found. Check digits and retry.</div>';
      box.style.display = 'block';
      return;
    }

    const report = await response.json();
    box.style.display = 'flex';
    
    // Build steps timeline
    const isReceived = true;
    const isProgress = report.status === 'In Progress' || report.status === 'Resolved';
    const isResolved = report.status === 'Resolved';

    box.innerHTML = `
      <div class="track-main-info">
        <b>Status Monitor</b>
        <span class="track-status-badge status-${report.status.replace(' ', '-')}">${report.status}</span>
      </div>
      
      <div class="track-timeline">
        <div class="timeline-step active">
          <b>Ticket Received</b>
          <div class="timeline-time">${new Date(report.created_at).toLocaleString()}</div>
          <p style="margin-top:2px; font-size:10px; color:var(--color-text-muted);">Queued in systems and dispatched to regional operations center.</p>
        </div>
        <div class="timeline-step ${isProgress ? 'active' : ''}">
          <b>In Progress (Assigned)</b>
          ${isProgress ? `
            <div class="timeline-time">${new Date(report.updated_at).toLocaleString()}</div>
            <p style="margin-top:2px; font-size:10px; color:var(--color-text-muted);">Assigned Team: <b>${report.assigned_team}</b></p>
          ` : '<p style="margin-top:2px; font-size:10px; color:var(--color-text-muted);">Pending team allocation.</p>'}
        </div>
        <div class="timeline-step ${isResolved ? 'active' : ''}">
          <b>Resolved</b>
          ${isResolved ? `
            <div class="timeline-time">${new Date(report.updated_at).toLocaleString()}</div>
            <p style="margin-top:4px; font-size:10.5px; color:var(--color-resolved); background:rgba(16,185,129,0.06); padding:6px; border-radius:4px; border:1px solid rgba(16,185,129,0.15);">
              <b>Remarks:</b> ${report.resolution_remarks}
            </p>
          ` : '<p style="margin-top:2px; font-size:10px; color:var(--color-text-muted);">Updates will be posted once resolved.</p>'}
        </div>
      </div>
    `;
  } catch (error) {
    box.innerHTML = '<div class="status-msg status-msg-error">Connection tracking error.</div>';
    box.style.display = 'block';
  }
}

// ==========================================================================
// ADMIN DASHBOARD HANDLERS
// ==========================================================================
async function handleAssignTeam(trackingNumber) {
  const teamInput = document.getElementById(`assign-input-${trackingNumber}`);
  const team = teamInput.value.trim();

  if (!team) {
    alert("Please type a response team name.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/admin/reports/${trackingNumber}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_team: team })
    });

    if (response.ok) {
      alert("Team successfully assigned. Incident status transitioned to 'In Progress'.");
      refreshData();
      
      // Update tracking card if it's currently viewed
      const currentlyTracking = document.getElementById('tracking-input').value.trim();
      if (currentlyTracking.toUpperCase() === trackingNumber.toUpperCase()) {
        handleTrackReport();
      }
    } else {
      alert("Failed to assign team.");
    }
  } catch (error) {
    alert("Network error updating ticket.");
  }
}

async function handleResolveTicket(trackingNumber) {
  const remarksInput = document.getElementById(`resolve-input-${trackingNumber}`);
  const remarks = remarksInput.value.trim();

  if (!remarks) {
    alert("Please provide resolution details/remarks.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/admin/reports/${trackingNumber}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution_remarks: remarks })
    });

    if (response.ok) {
      alert("Incident marked as 'Resolved'. Citizen notified via GovSMS.");
      refreshData();
      
      // Update tracking card if it's currently viewed
      const currentlyTracking = document.getElementById('tracking-input').value.trim();
      if (currentlyTracking.toUpperCase() === trackingNumber.toUpperCase()) {
        handleTrackReport();
      }
    } else {
      alert("Failed to resolve ticket.");
    }
  } catch (error) {
    alert("Network error updating ticket.");
  }
}

// ==========================================================================
// SYSTEM CONTROL HANDLERS
// ==========================================================================
async function handleResetDemo() {
  if (!confirm("Are you sure you want to restore the prototype database to its default demo state?")) return;
  try {
    const response = await fetch(`${API_BASE}/admin/reset`, { method: 'POST' });
    if (response.ok) {
      // Clear logs
      await fetch(`${API_BASE}/admin/logs/clear`, { method: 'DELETE' });
      
      alert("Prototype database reset complete.");
      
      // Reset variables & view state
      verifiedCitizen = null;
      document.getElementById('nin-input').value = '';
      document.getElementById('surname-input').value = '';
      document.getElementById('given-input').value = '';
      document.getElementById('identity-status-message').style.display = 'none';
      document.getElementById('sec-complaint-form').classList.add('disabled');
      document.getElementById('desc-textarea').value = '';
      document.getElementById('address-input').value = '';
      document.getElementById('photo-url-input').value = '';
      document.getElementById('photo-preview-box').innerHTML = '<p>No photo selected</p>';
      document.querySelectorAll('.btn-photo-preset').forEach(btn => btn.classList.remove('active'));
      
      if (citizenMarker) {
        citizenMap.removeLayer(citizenMarker);
        citizenMarker = null;
      }
      document.getElementById('coord-lat').textContent = '--';
      document.getElementById('coord-lng').textContent = '--';
      selectedLat = null;
      selectedLng = null;
      
      document.getElementById('tracking-input').value = '';
      document.getElementById('tracking-results-box').style.display = 'none';
      
      // Clear wizard status
      document.getElementById('wizard-bubble').classList.add('hidden');
      currentWizardStep = 0;

      refreshData();
    }
  } catch (error) {
    alert("Reset failed.");
  }
}

async function handleClearLogs() {
  try {
    const response = await fetch(`${API_BASE}/admin/logs/clear`, { method: 'DELETE' });
    if (response.ok) {
      fetchLogs();
    }
  } catch (error) {
    console.error(error);
  }
}

// ==========================================================================
// DEMO WIZARD ENGINE
// ==========================================================================
const WIZARD_STEPS_CONFIG = [
  {
    step: 0,
    instruction: "Welcome to the Ministry of ICT Demo! We will guide you step-by-step through a complete citizen service loop. Click 'Next' to begin Case 1: Verification.",
    autofill: () => {}
  },
  {
    step: 1,
    instruction: "<b>Use Case 1: Citizen Identity Verification (NIRA e-KYC API)</b><br>Click 'Autofill' to load John Mugisha's National ID details, then click the 'Verify with NIRA' button.",
    autofill: () => {
      document.getElementById('nin-input').value = 'CM98012345XYZD';
      document.getElementById('surname-input').value = 'MUGISHA';
      document.getElementById('given-input').value = 'JOHN';
      highlightElement('sec-identity');
    }
  },
  {
    step: 2,
    instruction: "<b>Use Case 2: Geolocated Incident Submission (NWSC Utility Category)</b><br>Identity verified! Now click 'Autofill' to select category 'Water Leak', snap a photo, address the street, and drop a coordinates pin on the map. Then hit 'Submit Citizen Report'.",
    autofill: () => {
      document.getElementById('category-select').value = 'WATER_LEAK';
      
      // Select preset photo
      document.querySelector('[data-photo="water"]').click();
      
      // Populate details
      document.getElementById('desc-textarea').value = "A water pipe burst near the roundabout, flooding the local shops.";
      document.getElementById('address-input').value = "Wandegeya Roundabout, Kampala";
      
      // Select mock coordinates and set marker
      const mockLat = 0.329400;
      const mockLng = 32.571400;
      citizenMap.setView([mockLat, mockLng], 14);
      updateCitizenMarker(mockLat, mockLng);
      
      highlightElement('sec-complaint-form');
    }
  },
  {
    step: 3,
    instruction: "<b>Use Case 3: Inspect Real-Time API Logs (UGHub / WSO2 Backend Logs)</b><br>Observe the 'Live API Console' column. You will see JSON blocks documenting the NIRA verify post, NWSC dispatch, and GovSMS confirmation message. Expand any log card to inspect payload structures.",
    autofill: () => {
      highlightElement('console-logs-container');
    }
  },
  {
    step: 4,
    instruction: "<b>Use Case 4: Admin Triage Dashboard (Status -> 'In Progress')</b><br>Locate your ticket in the 'Government Triage Dashboard' (Center Column). Click 'Autofill' to select it on the map, expand the triage drawer, type a maintenance crew name, and click 'Assign'.",
    autofill: async () => {
      const response = await fetch(`${API_BASE}/admin/reports`);
      const reports = await response.json();
      const latest = reports.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
      
      if (latest) {
        selectTicketCard(latest.tracking_number);
        const assignInput = document.getElementById(`assign-input-${latest.tracking_number}`);
        if (assignInput) {
          assignInput.value = "NWSC Kampala Metro Maintenance Team B";
        }
      }
      highlightElement('reports-list-container');
    }
  },
  {
    step: 5,
    instruction: "<b>Use Case 5: Action Resolution (Status -> 'Resolved' & SMS Notification)</b><br>The status moved to 'In Progress'. Now, click 'Autofill' to draft completion logs, click 'Resolve and Notify', then watch the API console dispatch the final SMS confirmation payload.",
    autofill: async () => {
      const response = await fetch(`${API_BASE}/admin/reports`);
      const reports = await response.json();
      const latest = reports.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
      
      if (latest) {
        selectTicketCard(latest.tracking_number);
        const resolveInput = document.getElementById(`resolve-input-${latest.tracking_number}`);
        if (resolveInput) {
          resolveInput.value = "Leaking joint repaired and pipe valve replaced. Supply restored.";
        }
      }
      highlightElement('reports-list-container');
    }
  }
];

function runWizardStep(stepNum) {
  if (stepNum < 0 || stepNum >= WIZARD_STEPS_CONFIG.length) return;
  currentWizardStep = stepNum;

  const config = WIZARD_STEPS_CONFIG[stepNum];
  
  document.getElementById('wizard-current-step').textContent = stepNum;
  document.getElementById('wizard-instruction').innerHTML = config.instruction;
  
  document.getElementById('btn-wizard-prev').disabled = stepNum === 0;
  
  if (stepNum === WIZARD_STEPS_CONFIG.length - 1) {
    document.getElementById('btn-wizard-next').textContent = "Finish";
  } else {
    document.getElementById('btn-wizard-next').textContent = "Next";
  }
}

function highlightElement(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.outline = "2px solid #FFD100";
  el.style.boxShadow = "0 0 20px rgba(255, 209, 0, 0.3)";
  setTimeout(() => {
    el.style.outline = "none";
    el.style.boxShadow = "none";
  }, 3000);
}

// ==========================================================================
// HELPERS
// ==========================================================================
function showStatusMsg(element, message, type) {
  element.textContent = message;
  element.className = 'status-msg';
  element.classList.add(type === 'success' ? 'status-msg-success' : 'status-msg-error');
}

function setupEventListeners() {
  // Reset
  document.getElementById('btn-reset-demo').addEventListener('click', handleResetDemo);
  
  // Clear Console
  document.getElementById('btn-clear-logs').addEventListener('click', handleClearLogs);

  // Identity Verify
  document.getElementById('btn-verify-identity').addEventListener('click', handleVerifyIdentity);

  // Submit Report
  document.getElementById('btn-submit-report').addEventListener('click', handleSubmitReport);

  // Track Report
  document.getElementById('btn-track-report').addEventListener('click', handleTrackReport);

  // Photo presets
  document.querySelectorAll('.btn-photo-preset').forEach(btn => {
    // Style presets with backgrounds for premium rendering
    const type = btn.getAttribute('data-photo');
    btn.style.backgroundImage = `url(${PHOTO_PRESETS[type]})`;
    
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-photo-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const imgUrl = PHOTO_PRESETS[type];
      document.getElementById('photo-url-input').value = imgUrl;
      
      const preview = document.getElementById('photo-preview-box');
      preview.innerHTML = `<img src="${imgUrl}" alt="Incident Selection">`;
    });
  });

  // Wizard Floating bubble toggle
  document.getElementById('btn-start-wizard').addEventListener('click', () => {
    document.getElementById('wizard-bubble').classList.remove('hidden');
    runWizardStep(1);
  });

  document.getElementById('btn-close-wizard').addEventListener('click', () => {
    document.getElementById('wizard-bubble').classList.add('hidden');
  });

  document.getElementById('btn-wizard-next').addEventListener('click', () => {
    if (currentWizardStep === WIZARD_STEPS_CONFIG.length - 1) {
      document.getElementById('wizard-bubble').classList.add('hidden');
      alert("Wizard Complete! You have successfully demoed a complete Uganda service loop to the Ministry of ICT.");
      currentWizardStep = 0;
    } else {
      runWizardStep(currentWizardStep + 1);
    }
  });

  document.getElementById('btn-wizard-prev').addEventListener('click', () => {
    runWizardStep(currentWizardStep - 1);
  });

  document.getElementById('btn-wizard-autofill').addEventListener('click', () => {
    WIZARD_STEPS_CONFIG[currentWizardStep].autofill();
  });
}
