const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

const dbPath = path.join(__dirname, 'database.json');

// Helper to read database state
function readDB() {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database.json:', error);
    return { citizens: [], reports: [], api_logs: [] };
  }
}

// Helper to write database state
function writeDB(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to database.json:', error);
  }
}

// Helper to record an integration log
function logApiCall(serviceName, url, method, requestHeaders, requestBody, responseStatus, responseBody) {
  const db = readDB();
  const logEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    service_name: serviceName,
    api_endpoint: url,
    http_method: method,
    request_headers: requestHeaders,
    request_body: typeof requestBody === 'object' ? JSON.stringify(requestBody, null, 2) : requestBody,
    response_status: responseStatus,
    response_body: typeof responseBody === 'object' ? JSON.stringify(responseBody, null, 2) : responseBody
  };
  
  db.api_logs = db.api_logs || [];
  db.api_logs.unshift(logEntry); // Add to beginning (latest first)
  if (db.api_logs.length > 50) {
    db.api_logs = db.api_logs.slice(0, 50); // Cap at 50 logs
  }
  writeDB(db);
  return logEntry;
}

// Helper to check if coordinates are within Kampala boundary box
function isWithinKampalaBounds(lat, lng) {
  // Rough bounding box for Greater Kampala Area
  return (lat >= 0.20 && lat <= 0.45 && lng >= 32.45 && lng <= 32.70);
}

// Helper to trigger internal HTTP loops simulating the UGHub routing
async function callMockAgencyAPI(serviceName, url, method, body, headers = {}) {
  const finalHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer mock_gov_oauth2_token_xyz_109283',
    ...headers
  };

  try {
    const response = await fetch(url, {
      method: method,
      headers: finalHeaders,
      body: body ? JSON.stringify(body) : null
    });

    const status = response.status;
    const responseText = await response.text();
    let responseBody = responseText;
    try {
      responseBody = JSON.parse(responseText);
    } catch (e) {}

    // Log the API interaction
    logApiCall(serviceName, url, method, finalHeaders, body, status, responseBody);
    return { status, body: responseBody };
  } catch (error) {
    const errText = error.message;
    logApiCall(serviceName, url, method, finalHeaders, body, 500, { error: errText });
    return { status: 500, body: { error: errText } };
  }
}


/* ==========================================
   MOCK EXTERNAL GOVERNMENT AGENCY ENDPOINTS
   ========================================== */

// 1. NIRA Citizen Identity Verification API
app.post('/api/nira/v1/verify', (req, res) => {
  const { nin, surname, given_name } = req.body;
  const db = readDB();
  
  const match = db.citizens.find(c => 
    c.nin.toUpperCase() === (nin || '').toUpperCase() &&
    c.surname.toUpperCase() === (surname || '').toUpperCase() &&
    c.given_name.toUpperCase() === (given_name || '').toUpperCase()
  );

  if (match) {
    res.status(200).json({
      status: "VERIFIED",
      verification_id: "NIRA-VAL-" + Math.floor(100000 + Math.random() * 900000) + "-X",
      timestamp: new Date().toISOString(),
      matched_fields: { nin: true, name: true, date_of_birth: true },
      demographics: { gender: "VERIFIED", district_of_birth: "KAMPALA" }
    });
  } else {
    res.status(404).json({
      status: "UNMATCHED",
      message: "No matching NIRA record found for the provided NIN and demographic details.",
      timestamp: new Date().toISOString()
    });
  }
});

// 2. KCCA Municipal Incident Intake API
app.post('/api/kcca/v1/incidents', (req, res) => {
  res.status(201).json({
    kcca_ticket_id: "KCCA-ENG-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000),
    assigned_division: "Central Division",
    triage_status: "QUEUED",
    estimated_response_hours: 48,
    created_at: new Date().toISOString()
  });
});

// 3. NWSC Utility Intake API
app.post('/api/nwsc/v1/leaks', (req, res) => {
  res.status(201).json({
    nwsc_job_no: "NWSC-JOB-" + new Date().getFullYear() + "-" + Math.floor(100000 + Math.random() * 900000),
    assigned_branch: "Kampala Metro Branch Office",
    priority: "HIGH",
    status: "DISPATCHED_PENDING",
    created_at: new Date().toISOString()
  });
});

// 4. UMEME Grid Ops API
app.post('/api/umeme/v1/faults', (req, res) => {
  res.status(201).json({
    umeme_incident_id: "UM-INC-" + new Date().getFullYear() + "-" + Math.floor(100 + Math.random() * 900),
    safety_flag: "DANGER_HIGH_VOLTAGE",
    grid_zone: "Greater Kampala Grid Control",
    response_team_notified: true,
    status: "EMERGENCY_DISPATCH",
    created_at: new Date().toISOString()
  });
});

// 5. GovSMS Gateway (MoICT standard)
app.post('/api/sms/v1/send', (req, res) => {
  res.status(200).json({
    sms_gateway_ref: "SMS-GW-" + Math.floor(10000 + Math.random() * 90000) + "-XYZ",
    status: "SENT",
    recipient: req.body.recipient_phone,
    credits_charged: 1,
    timestamp: new Date().toISOString()
  });
});


/* ==========================================
   CORE PORTAL APPLICATION ENDPOINTS
   ========================================== */

// CITIZEN: Submit a new report (includes identity validation and routing)
app.post('/api/v1/reports', async (req, res) => {
  const { citizen_nin, citizen_surname, citizen_given_name, category, description, latitude, longitude, street_address, photo } = req.body;

  // 1. Verify Identity against Mock NIRA API via Loopback HTTP Request
  const niraUrl = `http://localhost:${PORT}/api/nira/v1/verify`;
  const niraPayload = { nin: citizen_nin, surname: citizen_surname, given_name: citizen_given_name };
  
  const niraResult = await callMockAgencyAPI('NIRA (e-KYC)', niraUrl, 'POST', niraPayload);

  if (niraResult.status !== 200) {
    return res.status(400).json({
      error: "Identity verification failed.",
      message: "The NIRA registry could not verify your NIN with the name provided. Please double check details."
    });
  }

  // 2. Generate Tracking ID
  const trackingNumber = "UG-CIT-" + new Date().getFullYear() + "-" + Math.floor(10000 + Math.random() * 90000);

  // 3. Determine Routing / Triage agency
  let targetMDA = 'KCCA';
  let mdaEndpoint = `http://localhost:${PORT}/api/kcca/v1/incidents`;
  let mdaPayload = { title: category, description, latitude, longitude, street_address, citizen_reference: trackingNumber };

  if (category === 'WATER_LEAK') {
    targetMDA = 'NWSC';
    mdaEndpoint = `http://localhost:${PORT}/api/nwsc/v1/leaks`;
    mdaPayload = { leak_type: "PIPE_BURST", area: "KAMPALA_METRO", nearest_landmark: street_address, coordinates: { lat: latitude, lng: longitude }, citizen_reference: trackingNumber };
  } else if (category === 'PUBLIC_SERVICE_FAILURE') {
    // If it's public service fail (like power outages/faults), route to UMEME
    targetMDA = 'UMEME';
    mdaEndpoint = `http://localhost:${PORT}/api/umeme/v1/faults`;
    mdaPayload = { fault_category: "POWER_OUTAGE", severity: "STANDARD", location_details: street_address, coordinates: { lat: latitude, lng: longitude }, citizen_reference: trackingNumber };
  } else {
    // Check coordinates bounding box
    if (!isWithinKampalaBounds(latitude, longitude)) {
      targetMDA = 'District Council';
      mdaEndpoint = `http://localhost:${PORT}/api/kcca/v1/incidents`; // maps to standard incident route
    }
  }

  // Dispatch details to target Agency via Mock HTTP API
  const mdaResult = await callMockAgencyAPI(`${targetMDA} (Dispatch)`, mdaEndpoint, 'POST', mdaPayload);
  const ticketRef = mdaResult.status === 201 ? (mdaResult.body.kcca_ticket_id || mdaResult.body.nwsc_job_no || mdaResult.body.umeme_incident_id) : 'PENDING';

  // 4. Create local database entry
  const db = readDB();
  const newReport = {
    tracking_number: trackingNumber,
    citizen_nin,
    category,
    description,
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    street_address,
    photo_url: photo || "https://images.unsplash.com/photo-1542013936693-8848e574047a?auto=format&fit=crop&q=80&w=400",
    status: "Received",
    assigned_team: null,
    resolution_remarks: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.reports.push(newReport);
  writeDB(db);

  // 5. Trigger GovSMS Notification to reporter
  const citizenPhone = niraResult.body.demographics ? "256772123456" : "256701987654"; // mock phone lookup
  const smsUrl = `http://localhost:${PORT}/api/sms/v1/send`;
  const smsPayload = {
    recipient_phone: citizenPhone,
    message: `Ndugu, your report ${trackingNumber} has been received and routed to ${targetMDA}. Use this tracking code to check status. Thank you.`,
    sender_id: "GovUganda"
  };
  await callMockAgencyAPI('GovSMS Gateway', smsUrl, 'POST', smsPayload);

  res.status(201).json(newReport);
});

// CITIZEN: Track specific complaint status
app.get('/api/v1/reports/:trackingNumber', (req, res) => {
  const db = readDB();
  const report = db.reports.find(r => r.tracking_number.toUpperCase() === req.params.trackingNumber.toUpperCase());
  if (report) {
    res.status(200).json(report);
  } else {
    res.status(404).json({ error: "Report not found" });
  }
});

// TRIAGE: Retrieve all reports
app.get('/api/v1/admin/reports', (req, res) => {
  const db = readDB();
  res.status(200).json(db.reports);
});

// TRIAGE: Assign a team to a report (Transitions status to "In Progress")
app.post('/api/v1/admin/reports/:trackingNumber/assign', async (req, res) => {
  const { assigned_team } = req.body;
  const db = readDB();
  const index = db.reports.findIndex(r => r.tracking_number.toUpperCase() === req.params.trackingNumber.toUpperCase());

  if (index !== -1) {
    const report = db.reports[index];
    report.status = "In Progress";
    report.assigned_team = assigned_team;
    report.updated_at = new Date().toISOString();
    writeDB(db);

    // Trigger dispatch notification via SMS
    const smsUrl = `http://localhost:${PORT}/api/sms/v1/send`;
    const smsPayload = {
      recipient_phone: "256772123456",
      message: `Ndugu, your report ${report.tracking_number} status is now: In Progress. Assigned team: ${assigned_team}.`,
      sender_id: "GovUganda"
    };
    await callMockAgencyAPI('GovSMS Gateway', smsUrl, 'POST', smsPayload);

    res.status(200).json(report);
  } else {
    res.status(404).json({ error: "Report not found" });
  }
});

// TRIAGE: Resolve a report (Transitions status to "Resolved")
app.post('/api/v1/admin/reports/:trackingNumber/resolve', async (req, res) => {
  const { resolution_remarks } = req.body;
  const db = readDB();
  const index = db.reports.findIndex(r => r.tracking_number.toUpperCase() === req.params.trackingNumber.toUpperCase());

  if (index !== -1) {
    const report = db.reports[index];
    report.status = "Resolved";
    report.resolution_remarks = resolution_remarks;
    report.updated_at = new Date().toISOString();
    writeDB(db);

    // Trigger resolution notification via SMS
    const smsUrl = `http://localhost:${PORT}/api/sms/v1/send`;
    const smsPayload = {
      recipient_phone: "256772123456",
      message: `Ndugu, your report ${report.tracking_number} has been Resolved. Remarks: ${resolution_remarks}.`,
      sender_id: "GovUganda"
    };
    await callMockAgencyAPI('GovSMS Gateway', smsUrl, 'POST', smsPayload);

    res.status(200).json(report);
  } else {
    res.status(404).json({ error: "Report not found" });
  }
});

// CONSOLE: Retrieve live HTTP logs
app.get('/api/v1/admin/logs', (req, res) => {
  const db = readDB();
  res.status(200).json(db.api_logs || []);
});

// CONSOLE: Clear live logs
app.delete('/api/v1/admin/logs/clear', (req, res) => {
  const db = readDB();
  db.api_logs = [];
  writeDB(db);
  res.status(200).json({ status: "success", message: "Logs cleared" });
});

// CONSOLE: Revert database and logs to fresh demo state
app.post('/api/v1/admin/reset', (req, res) => {
  const initialDB = {
    citizens: [
      { nin: "CM98012345XYZD", surname: "MUGISHA", given_name: "JOHN", date_of_birth: "1998-05-12", phone_number: "256772123456" },
      { nin: "CF99023456ABCD", surname: "NAMUBIRU", given_name: "SARAH", date_of_birth: "1999-11-20", phone_number: "256701987654" },
      { nin: "CM01034567EFGH", surname: "OKECH", given_name: "MOSES", date_of_birth: "2001-03-15", phone_number: "256782555666" },
      { nin: "CF02045678IJKL", surname: "CHEMUTAI", given_name: "ESTHER", date_of_birth: "2002-07-28", phone_number: "256755444333" }
    ],
    reports: [
      {
        tracking_number: "UG-CIT-2026-10001",
        citizen_nin: "CF99023456ABCD",
        category: "WATER_LEAK",
        description: "A massive pipe burst is spilling thousands of liters of clean water into the road near Wandegeya Market.",
        latitude: 0.329400,
        longitude: 32.571400,
        street_address: "Wandegeya Market Road, Kampala",
        photo_url: "https://images.unsplash.com/photo-1542013936693-8848e574047a?auto=format&fit=crop&q=80&w=400",
        status: "Received",
        assigned_team: null,
        resolution_remarks: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        tracking_number: "UG-CIT-2026-10002",
        citizen_nin: "CM01034567EFGH",
        category: "BROKEN_INFRASTRUCTURE",
        description: "Large, deep pothole in the middle of Kampala Road near the Post Office, causing traffic jams.",
        latitude: 0.313611,
        longitude: 32.581111,
        street_address: "Kampala Road, Central Division, Kampala",
        photo_url: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=400",
        status: "In Progress",
        assigned_team: "KCCA Central Engineering Team A",
        resolution_remarks: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    api_logs: []
  };
  
  writeDB(initialDB);
  res.status(200).json({ status: "success", message: "Database reset to defaults" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`UgCitizen Resolve Portal Backend running on port ${PORT}`);
  console.log(`=================================================`);
});
