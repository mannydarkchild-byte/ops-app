import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
window.__SUPABASE__ = supabase;
let db = null;
try {
  import('dexie').then((module) => {
    const Dexie = module.default;
    db = new Dexie('OPS_Warrior2100');
    db.version(1).stores({
      profiles: 'id, pin, name, role, machine_id',
      shifts: 'id, machine_id, operator_name, status, started_at, start_odometer, end_odometer, date',
      events: 'id, shift_id, machine_id, type, reason, photo, note, timestamp',
      expenses: 'id, machine_id, operator_name, category, amount, vendor, date',
      issues: 'id, machine_id, operator_name, area, priority, description, status',
      inspections: 'id, machine_id, operator_name, type, results, pass_count, fail_count',
      inventory: 'id, machine_id, name, quantity, min_quantity, unit, location'
    });
  });
} catch (e) { console.log("Dexie skipped"); }

// ====== DIAGNOSTIC SYNC ENGINE ======
const syncToSupabase = async () => {
  if (!navigator.onLine) return;

  console.log("🟡 Starting sync process...");

  const syncTable = async (tableName, localData) => {
    for (const record of localData) {
      const { id, ...cleanRecord } = record;
      console.log(`📤 Attempting to send to ${tableName}:`, cleanRecord);
      
      const { data, error } = await supabase.from(tableName).insert([cleanRecord]);

      if (error) {
        console.error(`❌ ERROR SYNCING ${tableName}:`, error);
        console.error(`❌ Full error details:`, JSON.stringify(error, null, 2));
      } else {
        console.log(`✅ Successfully synced to ${tableName}:`, data);
      }
    }
  };

  const localProfiles = await db.profiles.toArray();
  await syncTable('profiles', localProfiles);

  const localShifts = await db.shifts.toArray();
  await syncTable('shifts', localShifts);

  const localExpenses = await db.expenses.toArray();
  await syncTable('expenses', localExpenses);

  const localIssues = await db.issues.toArray();
  await syncTable('issues', localIssues);

  const localInventory = await db.inventory.toArray();
  await syncTable('inventory', localInventory);

  const localInspections = await db.inspections.toArray();
  await syncTable('inspections', localInspections);

  console.log("🟢 Sync process finished.");
};

window.addEventListener('online', () => {
  console.log("🔵 Back online! Triggering sync...");
  syncToSupabase();
});

export default function App() {
  // ====== CORE STATE ======
  const [user, setUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [isMachineRunning, setIsMachineRunning] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [history, setHistory] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [note, setNote] = useState('');
  const [isListening, setIsListening] = useState(false);

  // ====== SHIFT ODOMETER STATE ======
  const [showStartShiftModal, setShowStartShiftModal] = useState(false);
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [startOdo, setStartOdo] = useState('');
  const [endOdo, setEndOdo] = useState('');
  const [startOdoPhoto, setStartOdoPhoto] = useState(null);
  const [endOdoPhoto, setEndOdoPhoto] = useState(null);
  
  // ====== HOURS TRACKING ======
  const [totalMonthHours, setTotalMonthHours] = useState(0);
  const [todayHours, setTodayHours] = useState(0);
  const [weekHours, setWeekHours] = useState(0);
  const [currentShiftStart, setCurrentShiftStart] = useState(null);
  const [hoursView, setHoursView] = useState('daily');
  const MONTHLY_TARGET = 150;

  // ====== SETTINGS STATE ======
  const [operators, setOperators] = useState([]);
  const [newOpName, setNewOpName] = useState('');
  const [newOpPin, setNewOpPin] = useState('');
  const [newOpRole, setNewOpRole] = useState('operator');

  // ====== EXPENSES STATE ======
  const [expenses, setExpenses] = useState([]);
  const [expCat, setExpCat] = useState('Fuel');
  const [expVendor, setExpVendor] = useState('ELB Equipment');
  const [expAmount, setExpAmount] = useState('');

  // ====== ISSUES STATE ======
  const [issues, setIssues] = useState([]);
  const [issueArea, setIssueArea] = useState('Screen Box');
  const [issuePriority, setIssuePriority] = useState('Medium');
  const [issueDesc, setIssueDesc] = useState('');

  // ====== INVENTORY STATE ======
  const [inventory, setInventory] = useState([]);
  const [invName, setInvName] = useState('');
  const [invQty, setInvQty] = useState('');
  const [invMin, setInvMin] = useState('5');
  const [invUnit, setInvUnit] = useState('pcs');
  const [invLocation, setInvLocation] = useState('Site Container');

  // ====== INSPECTIONS STATE ======
  const [inspectionResults, setInspectionResults] = useState({});
  
  // REAL POWERSREEN WARRIOR 2100 OEM INSPECTION SPEC
  const inspectionItems = {
    'Engine & Hydraulics': ['Engine oil level', 'Coolant level', 'Hydraulic oil level', 'Fuel level', 'Exhaust system integrity'],
    'Screen Box': ['Screen panels (top deck)', 'Screen panels (bottom deck)', 'Tension bolts', 'Cross beams', 'Rubber suspension'],
    'Conveyor System': ['Belt tension', 'Belt tracking', 'Return rollers', 'Impact bars', 'Drive pulley'],
    'Tracks & Undercarriage': ['Track tension', 'Track pads', 'Sprockets', 'Idlers', 'Grease points'],
    'Electrical & Controls': ['Control panel warning lights', 'Emergency stops', 'Wiring looms', 'Beacons/alarms'],
    'Safety & Housekeeping': ['Guards/covers', 'Fire extinguisher', 'Handrails', 'Cleanliness']
  };

  // ====== SEED DATA ======
  useEffect(() => {
    const existingUsers = localStorage.getItem('OPS_Warrior2100_profiles');
    if (!existingUsers) {
      const defaultUsers = [
        { id: '1', pin: '0000', name: 'Admin', role: 'admin', machine_id: 'W2100-001' },
        { id: '2', pin: '1111', name: 'Supervisor', role: 'supervisor', machine_id: 'W2100-001' },
        { id: '3', pin: '1234', name: 'Manny Middleton', role: 'operator', machine_id: 'W2100-001' }
      ];
      localStorage.setItem('OPS_Warrior2100_profiles', JSON.stringify(defaultUsers));
      setOperators(defaultUsers);
    } else {
      setOperators(JSON.parse(existingUsers));
    }

    const storedHours = localStorage.getItem('OPS_MonthlyHours');
    if (storedHours) setTotalMonthHours(parseFloat(storedHours));
    const storedWeek = localStorage.getItem('OPS_WeekHours');
    if (storedWeek) setWeekHours(parseFloat(storedWeek));
    const storedInv = localStorage.getItem('OPS_Inventory');
    if (storedInv) setInventory(JSON.parse(storedInv));
  }, []);

  // ====== HELPERS ======
  const addHistory = (action, details = '') => {
    const time = new Date().toLocaleTimeString();
    setHistory(prev => [{ action, details, time }, ...prev]);
  };

  const handleLogin = () => {
    const allUsers = JSON.parse(localStorage.getItem('OPS_Warrior2100_profiles') || '[]');
    const foundUser = allUsers.find(u => u.pin === pin);
    if (foundUser) {
      setUser(foundUser); localStorage.setItem('active_operator', JSON.stringify(foundUser)); setError('');
    } else { setError('Invalid PIN'); setPin(''); }
  };

  const handleLogout = () => {
    setUser(null); setPin(''); setIsShiftActive(false); setIsMachineRunning(false);
    localStorage.removeItem('active_operator'); setHistory([]);
  };

  const stopReasons = ['Mechanical Breakdown', 'Electrical Issue', 'Hydraulic Problem', 'Screen Blockage', 'Conveyor Jam', 'Feeder Issue', 'Safety Stop', 'Weather', 'No Material', 'Operator Break', 'Maintenance', 'Refueling', 'Other'];
  const expenseCats = ['Fuel', 'Parts', 'Consumables', 'Transport', 'Labour', 'Tools', 'Other'];
  const vendors = ['ELB Equipment', 'Makro', 'Adendorff', 'Espach', 'Junior Worx', 'Other'];
  const issueAreas = ['Screen Box', 'Conveyor System', 'Engine & Hydraulics', 'Tracks & Undercarriage', 'Electrical & Controls', 'Safety & Housekeeping'];
  const invLocations = ['Site Container', 'Workshop', 'Truck Toolbox'];

  // ====== VOICE & CAMERA ======
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Voice not supported.");
    const recognition = new SpeechRecognition(); recognition.lang = 'en-US';
    setIsListening(true); recognition.start();
    recognition.onresult = (e) => { setNote(prev => prev + " " + e.results[0][0].transcript); setIsListening(false); };
    recognition.onerror = () => { setIsListening(false); };
  };

  const handleCamera = (setter) => {
    try {
      const stream = navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video'); video.srcObject = stream; video.play();
      setTimeout(() => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        setter(canvas.toDataURL('image/jpeg'));
        stream.getTracks().forEach(track => track.stop());
      }, 1000);
    } catch { alert("Camera access denied."); }
  };

  // ====== SHIFT LOGIC ======
  const confirmStartShift = () => {
    if (!startOdo) return alert("Please enter the starting odometer hours.");
    setIsShiftActive(true);
    setCurrentShiftStart(parseFloat(startOdo));
    addHistory('Shift Started', `Start Odo: ${startOdo}h`);
    setShowStartShiftModal(false);
    setStartOdoPhoto(null);
    syncToSupabase();
  };

  const confirmEndShift = () => {
    if (!endOdo) return alert("Please enter the ending odometer hours.");
    const start = currentShiftStart || 0;
    const end = parseFloat(endOdo);
    const hoursRun = end - start;
    
    setTodayHours(prev => prev + hoursRun);
    setWeekHours(prev => prev + hoursRun);
    const newTotal = totalMonthHours + hoursRun;
    setTotalMonthHours(newTotal);
    localStorage.setItem('OPS_MonthlyHours', newTotal.toString());
    localStorage.setItem('OPS_WeekHours', (weekHours + hoursRun).toString());

    addHistory('Shift Ended', `End Odo: ${endOdo}h | Runtime: ${hoursRun.toFixed(1)}h`);
    setIsShiftActive(false);
    setIsMachineRunning(false);
    setShowEndShiftModal(false);
    setEndOdoPhoto(null);
    setStartOdo('');
    setEndOdo('');
    syncToSupabase();
  };

  // ====== DATA ACTIONS ======
  const addExpense = () => {
    if (!expAmount) return alert("Enter an amount");
    const newExp = { id: Date.now(), machine_id: 'W2100-001', operator_name: user.name, category: expCat, amount: parseFloat(expAmount), vendor: expVendor, date: new Date().toISOString() };
    setExpenses([newExp, ...expenses]); setExpAmount(''); addHistory('Expense Logged', `${expCat} - R${expAmount}`);
    syncToSupabase();
  };

  const addIssue = () => {
    const newIssue = { id: Date.now(), machine_id: 'W2100-001', operator_name: user.name, area: issueArea, priority: issuePriority, description: issueDesc || 'Reported issue', status: 'open' };
    setIssues([newIssue, ...issues]); setIssueDesc(''); addHistory('Issue Reported', `${issueArea} (${issuePriority})`);
    syncToSupabase();
  };

  const addInspection = () => {
    const pass = Object.values(inspectionResults).filter(v => v === 'pass').length;
    const fail = Object.values(inspectionResults).filter(v => v === 'fail').length;
    const na = Object.values(inspectionResults).filter(v => v === 'na').length;
    if (pass + fail + na === 0) return alert("Complete at least one item");
    addHistory('Inspection Completed', `Pass: ${pass}, Fail: ${fail}`);
    setInspectionResults({});
    syncToSupabase();
  };

  // ====== INVENTORY ACTIONS ======
  const addInventoryItem = () => {
    if (!invName || !invQty) return alert("Enter name and quantity");
    const newItem = { id: Date.now(), machine_id: 'W2100-001', name: invName, quantity: parseInt(invQty), min_quantity: parseInt(invMin), unit: invUnit, location: invLocation };
    const updated = [newItem, ...inventory];
    setInventory(updated);
    localStorage.setItem('OPS_Inventory', JSON.stringify(updated));
    setInvName(''); setInvQty('');
    alert("Inventory item added");
    syncToSupabase();
  };

  const updateInventoryQty = (id, change) => {
    const updated = inventory.map(item => {
      if (item.id === id) return { ...item, quantity: Math.max(0, item.quantity + change) };
      return item;
    });
    setInventory(updated);
    localStorage.setItem('OPS_Inventory', JSON.stringify(updated));
  };

  // ====== SETTINGS ======
  const addOperator = () => {
    if (!newOpName || newOpPin.length !== 4) return alert("Name and 4-digit PIN required");
    const updated = [...operators, { id: Date.now().toString(), pin: newOpPin, name: newOpName, role: newOpRole, machine_id: 'W2100-001' }];
    setOperators(updated);
    localStorage.setItem('OPS_Warrior2100_profiles', JSON.stringify(updated));
    setNewOpName(''); setNewOpPin(''); setNewOpRole('operator');
    alert("Operator added!");
    syncToSupabase();
  };

  // ====== REPORTS ENGINE ======
  const generateReportHTML = () => {
    const date = new Date().toLocaleDateString();
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const openIssues = issues.filter(i => i.status === 'open');
    const tonnage = totalMonthHours * 2.5 * 120;
    
    return `
      <html><head><style>
        body { font-family: Arial, sans-serif; color: #000; background: #fff; padding: 40px; }
        h1 { color: #0A0A0A; border-bottom: 4px solid #F5C518; padding-bottom: 10px; }
        h2 { color: #00A4A6; margin-top: 30px; font-size: 18px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat-box { border: 1px solid #ccc; padding: 15px; flex: 1; text-align: center; }
        .stat-box span { display: block; font-size: 24px; font-weight: bold; color: #0A0A0A; }
        .footer { margin-top: 50px; font-size: 12px; color: #666; border-top: 1px solid #ccc; padding-top: 20px; }
      </style></head><body>
        <h1>OPS · WARRIOR 2100</h1>
        <p><strong>Site:</strong> Malekaskraal | <strong>Machine ID:</strong> W2100-001 | <strong>Date:</strong> ${date}</p>
        <p><strong>Operator:</strong> ${user.name} (${user.role})</p>
        
        <div class="stats">
          <div class="stat-box"><span>${totalMonthHours.toFixed(1)}h</span>Month Hours</div>
          <div class="stat-box"><span>${todayHours.toFixed(1)}h</span>Today's Hours</div>
          <div class="stat-box"><span>${tonnage.toFixed(0)}t</span>Est. Tonnage</div>
        </div>

        <h2>Activity History</h2>
        <table><tr><th>Time</th><th>Action</th><th>Details</th></tr>
        ${history.map(h => `<tr><td>${h.time}</td><td>${h.action}</td><td>${h.details || '-'}</td></tr>`).join('')}
        </table>

        <h2>Expenses Breakdown</h2>
        <table><tr><th>Category</th><th>Vendor</th><th>Amount (R)</th></tr>
        ${expenses.map(e => `<tr><td>${e.category}</td><td>${e.vendor}</td><td>${e.amount.toFixed(2)}</td></tr>`).join('')}
        ${expenses.length === 0 ? '<tr><td colspan="3" style="text-align:center;">No expenses recorded.</td></tr>' : ''}
        </table>

        <h2>Open Issues</h2>
        <table><tr><th>Area</th><th>Priority</th><th>Description</th></tr>
        ${openIssues.map(i => `<tr><td>${i.area}</td><td>${i.priority}</td><td>${i.description}</td></tr>`).join('')}
        ${openIssues.length === 0 ? '<tr><td colspan="3" style="text-align:center;">No open issues.</td></tr>' : ''}
        </table>

        <div class="footer">Generated by OPS Warrior 2100 Control App · Confidential</div>
      </body></html>
    `;
  };

  const handlePrintPDF = () => {
    const win = window.open('', '_blank');
    win.document.write(generateReportHTML());
    win.document.close();
    win.print();
  };

  const handleShare = async () => {
    const html = generateReportHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const file = new File([blob], `OPS_Report_${Date.now()}.html`, { type: 'text/html' });
    if (navigator.share) {
      try { await navigator.share({ title: 'OPS Warrior 2100 Report', text: 'Operations report from Malekaskraal site.', files: [file] }); } 
      catch (err) { if (err.name !== 'AbortError') alert('Share cancelled or not supported.'); }
    } else { alert('Native sharing not supported on this browser. Use the Print/PDF button.'); }
  };

  // ====== LOGIN SCREEN ======
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 w-96 h-96 bg-[#F5C518] opacity-5 blur-[100px] rounded-full pointer-events-none"></div>
        <img src="/logo.png" alt="OPS" className="w-72 mb-8 drop-shadow-[0_0_30px_rgba(245,197,24,0.3)]" />
        <div className="w-full max-w-sm bg-[#141414] border-2 border-[#2A2A2A] rounded-2xl p-8 shadow-2xl relative z-10">
          <h2 className="font-logo text-[#00A4A6] text-center mb-6 text-2xl tracking-widest">OPERATOR ACCESS</h2>
          <div className="relative mb-4">
            <input type="password" maxLength="4" placeholder="●●●●" className="w-full p-4 bg-[#0A0A0A] border-2 border-[#2A2A2A] rounded-xl text-center text-4xl tracking-[0.6em] text-[#F2F0EA] focus:border-[#F5C518] outline-none transition-all placeholder:text-[#4A4A4A] font-mono" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} autoFocus />
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#F5C518] to-transparent opacity-0 focus-within:opacity-100 transition-opacity"></div>
          </div>
          {error && <p className="text-[#EF4444] text-sm mt-2 text-center font-logo tracking-wider">{error}</p>}
          <button onClick={handleLogin} className="w-full bg-gradient-to-b from-[#F5C518] to-[#d4a514] text-[#0A0A0A] font-logo font-bold p-4 rounded-xl text-2xl tracking-wider hover:scale-[1.02] active:scale-95 transition-all shadow-[0_4px_0_#8a6900,0_6px_15px_rgba(245,197,24,0.2)]">ACCESS OPS</button>
        </div>
      </div>
    );
  }

  // ====== DASHBOARD TAB ======
  const renderDashboard = () => {
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
    const openIssues = issues.filter(i => i.status === 'open').length;
    const progressPercent = Math.min((totalMonthHours / MONTHLY_TARGET) * 100, 100);
    
    let displayHours = 0;
    if (hoursView === 'daily') displayHours = todayHours;
    else if (hoursView === 'weekly') displayHours = weekHours;
    else if (hoursView === 'monthly') displayHours = totalMonthHours;

    const tonnage = totalMonthHours * 2.5 * 120;

    return (
      <div>
        <div className="flex flex-col items-center justify-center mb-6 border-b border-[#2A2A2A] pb-6 relative">
          <img src="/logo.png" alt="OPS" className="w-16 h-16 rounded-lg border-2 border-[#F5C518] mb-2 shadow-[0_0_15px_rgba(245,197,24,0.2)]" />
          <h1 className="font-logo text-3xl text-[#F5C518] tracking-[0.15em] leading-none">WARRIOR 2100</h1>
          <div className="flex gap-4 mt-2 text-sm font-logo tracking-wider">
            <span className="text-[#00A4A6]">{user.name}</span><span className="text-[#2A2A2A]">|</span>
            <span className={`uppercase ${user.role === 'admin' ? 'text-[#EF4444]' : user.role === 'supervisor' ? 'text-[#F5C518]' : 'text-[#22C55E]'}`}>{user.role}</span>
          </div>
          <button onClick={handleLogout} className="absolute top-0 right-0 font-logo text-sm text-[#EF4444] border-2 border-[#EF4444] px-4 py-1.5 rounded hover:bg-[#EF4444] hover:text-black transition-all mt-2">LOGOUT</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-[#141414] p-4 rounded-xl border border-[#2A2A2A] flex flex-col justify-between">
            <div><p className="text-xs text-[#F2F0EA]/50 font-logo tracking-wider">SHIFT STATUS</p><p className={`font-bold font-logo ${isShiftActive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{isShiftActive ? '● ACTIVE' : '● OFFLINE'}</p></div>
            {!isShiftActive ? 
              <button onClick={() => setShowStartShiftModal(true)} className="font-logo bg-gradient-to-b from-[#22C55E] to-[#1a9c48] text-black font-bold px-6 py-2 rounded shadow-[0_3px_0_#0f5c2a] hover:scale-105 active:scale-95 transition-all">START SHIFT</button> 
            : <button onClick={() => setShowEndShiftModal(true)} className="font-logo bg-gradient-to-b from-[#EF4444] to-[#b91c1c] text-white font-bold px-6 py-2 rounded shadow-[0_3px_0_#7a1a1a] hover:scale-105 active:scale-95 transition-all">END SHIFT</button>}
          </div>

          <div className="bg-[#141414] p-4 rounded-xl border border-[#2A2A2A] flex flex-col justify-between">
            <div><p className="text-xs text-[#F2F0EA]/50 font-logo tracking-wider">ENGINE STATUS</p><p className={`font-bold font-logo ${isMachineRunning ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{isMachineRunning ? '● RUNNING' : '● STOPPED'}</p></div>
            {isShiftActive && (user.role === 'admin' || user.role === 'supervisor' || user.role === 'operator') ? (
              !isMachineRunning ? 
              <button onClick={() => { setIsMachineRunning(true); addHistory('Machine Started'); }} className="w-full bg-gradient-to-b from-[#22C55E] to-[#15803d] text-black font-logo font-bold py-2 rounded shadow-[0_3px_0_#0f5c2a] hover:scale-105 active:scale-95">START ENGINE</button>
              : <button onClick={() => setShowStopModal(true)} className="w-full bg-gradient-to-b from-[#EF4444] to-[#b91c1c] text-white font-logo font-bold py-2 rounded shadow-[0_3px_0_#7a1a1a] hover:scale-105 active:scale-95">STOP ENGINE</button>
            ) : <p className="text-[#F2F0EA]/40 text-xs text-center py-2">Shift required to operate</p>}
          </div>
        </div>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 mb-6">
          <h3 className="font-logo text-[#F5C518] text-sm tracking-wider mb-3">MACHINE HOURS</h3>
          <div className="flex gap-2 mb-4">
            {['daily', 'weekly', 'monthly'].map(view => (
              <button key={view} onClick={() => setHoursView(view)} className={`flex-1 py-1 px-2 rounded border font-logo text-xs ${hoursView === view ? 'bg-[#00A4A6] border-[#F5C518] text-black' : 'bg-[#0A0A0A] border-[#2A2A2A] text-[#F2F0EA]/50'}`}>
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-2">
            <div className="bg-[#0A0A0A] p-3 rounded border border-[#2A2A2A]">
              <p className="text-[10px] text-[#F2F0EA]/50 font-logo">{hoursView.toUpperCase()}</p>
              <p className="font-logo text-xl text-[#00A4A6]">{displayHours.toFixed(1)}h</p>
            </div>
            <div className="bg-[#0A0A0A] p-3 rounded border border-[#2A2A2A]">
              <p className="text-[10px] text-[#F2F0EA]/50 font-logo">MONTHLY TARGET</p>
              <p className="font-logo text-xl text-[#F5C518]">{totalMonthHours.toFixed(1)}h / {MONTHLY_TARGET}h</p>
            </div>
          </div>
          <div className="w-full bg-[#2A2A2A] h-2 rounded-full overflow-hidden">
            <div className="bg-[#F5C518] h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <p className="text-xs text-[#F2F0EA]/50 mt-1 text-right font-logo">{progressPercent.toFixed(0)}% Complete</p>
        </div>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 mb-6 text-center">
          <p className="text-[10px] text-[#F2F0EA]/50 font-logo tracking-wider">ESTIMATED TONNAGE (MONTH)</p>
          <p className="font-logo text-3xl text-[#F5C518]">{tonnage.toFixed(0)} <span className="text-sm text-[#F2F0EA]/50">tons</span></p>
          <p className="text-[10px] text-[#F2F0EA]/50 mt-1 font-logo">Based on {totalMonthHours.toFixed(1)}h @ 2.5t/bucket · 120 buckets/h</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#141414] p-4 rounded-lg border border-[#2A2A2A] text-center">
            <p className="text-xs text-[#F2F0EA]/50 font-logo tracking-wider">EXPENSES</p>
            <p className="font-logo text-2xl text-[#F5C518]">R{totalExp.toFixed(0)}</p>
          </div>
          <div className="bg-[#141414] p-4 rounded-lg border border-[#2A2A2A] text-center">
            <p className="text-xs text-[#F2F0EA]/50 font-logo tracking-wider">OPEN ISSUES</p>
            <p className="font-logo text-2xl text-[#EF4444]">{openIssues}</p>
          </div>
        </div>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">
          <h3 className="font-logo text-[#00A4A6] text-sm tracking-wider mb-3 border-b border-[#2A2A2A] pb-2">RECENT ACTIVITY</h3>
          {history.length === 0 ? <p className="text-[#F2F0EA]/40 text-xs text-center py-4 font-logo">No activity recorded yet.</p> : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {history.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-[#0A0A0A] p-3 rounded-lg border border-[#2A2A2A]">
                  <div><p className="font-logo text-sm text-[#F2F0EA]">{item.action}</p><p className="text-[#F2F0EA]/50 text-[10px] font-logo tracking-wider">{item.details}</p></div>
                  <span className="font-logo text-[10px] text-[#F2F0EA]/40">{item.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ====== START SHIFT MODAL ======
  const startShiftModal = (
    showStartShiftModal && (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
        <div className="bg-[#141414] border-2 border-[#2A2A2A] rounded-2xl p-6 max-w-md w-full shadow-2xl">
          <h3 className="font-logo text-[#00A4A6] text-xl font-bold mb-4 text-center tracking-wider">START SHIFT</h3>
          <p className="text-center text-[#F2F0EA]/60 text-xs mb-4 font-logo">Date: {new Date().toLocaleDateString()}</p>
          <div className="mb-4">
            <button onClick={() => handleCamera(setStartOdoPhoto)} className="w-full bg-[#0A0A0A] border-2 border-[#2A2A2A] hover:border-[#00A4A6] p-4 rounded-xl text-[#F2F0EA] font-logo text-sm transition-all flex items-center justify-center gap-2 mb-2">📸 TAKE ODOMETER PHOTO</button>
            {startOdoPhoto && <p className="text-[#22C55E] text-xs text-center mb-2 font-logo">✓ Photo Captured</p>}
            <input type="number" placeholder="Enter Odometer Hours" className="w-full bg-[#0A0A0A] border-2 border-[#2A2A2A] rounded-xl p-3 text-[#F2F0EA] text-center text-xl focus:border-[#F5C518] outline-none transition-all font-logo" value={startOdo} onChange={(e) => setStartOdo(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowStartShiftModal(false); setStartOdo(''); setStartOdoPhoto(null); }} className="flex-1 font-logo text-[#F2F0EA]/50 text-sm underline underline-offset-4 hover:text-white transition">CANCEL</button>
            <button onClick={confirmStartShift} className="flex-1 bg-gradient-to-b from-[#22C55E] to-[#1a9c48] text-black font-logo font-bold p-3 rounded-xl text-sm tracking-wider shadow-[0_3px_0_#0f5c2a] hover:scale-[1.02] active:scale-95 transition-all">CONFIRM START</button>
          </div>
        </div>
      </div>
    )
  );

  // ====== END SHIFT MODAL ======
  const endShiftModal = (
    showEndShiftModal && (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
        <div className="bg-[#141414] border-2 border-[#2A2A2A] rounded-2xl p-6 max-w-md w-full shadow-2xl">
          <h3 className="font-logo text-[#EF4444] text-xl font-bold mb-4 text-center tracking-wider">END SHIFT</h3>
          <p className="text-center text-[#F2F0EA]/60 text-xs mb-4 font-logo">Date: {new Date().toLocaleDateString()}</p>
          <div className="mb-4">
            <button onClick={() => handleCamera(setEndOdoPhoto)} className="w-full bg-[#0A0A0A] border-2 border-[#2A2A2A] hover:border-[#EF4444] p-4 rounded-xl text-[#F2F0EA] font-logo text-sm transition-all flex items-center justify-center gap-2 mb-2">📸 TAKE ODOMETER PHOTO</button>
            {endOdoPhoto && <p className="text-[#22C55E] text-xs text-center mb-2 font-logo">✓ Photo Captured</p>}
            <input type="number" placeholder="Enter Ending Odometer Hours" className="w-full bg-[#0A0A0A] border-2 border-[#2A2A2A] rounded-xl p-3 text-[#F2F0EA] text-center text-xl focus:border-[#EF4444] outline-none transition-all font-logo" value={endOdo} onChange={(e) => setEndOdo(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowEndShiftModal(false); setEndOdo(''); setEndOdoPhoto(null); }} className="flex-1 font-logo text-[#F2F0EA]/50 text-sm underline underline-offset-4 hover:text-white transition">CANCEL</button>
            <button onClick={confirmEndShift} className="flex-1 bg-gradient-to-b from-[#EF4444] to-[#b91c1c] text-white font-logo font-bold p-3 rounded-xl text-sm tracking-wider shadow-[0_3px_0_#7a1a1a] hover:scale-[1.02] active:scale-95 transition-all">CONFIRM END</button>
          </div>
        </div>
      </div>
    )
  );

  // ====== EXPENSES ======
  const renderExpenses = () => (
    <div className="pt-2">
      <h2 className="font-logo text-[#F5C518] text-xl tracking-wider mb-4">LOG EXPENSE</h2>
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 mb-6">
        <select className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] mb-3 font-logo" value={expCat} onChange={(e) => setExpCat(e.target.value)}>{expenseCats.map(c => <option key={c}>{c}</option>)}</select>
        <select className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] mb-3 font-logo" value={expVendor} onChange={(e) => setExpVendor(e.target.value)}>{vendors.map(v => <option key={v}>{v}</option>)}</select>
        <input type="number" placeholder="Amount (R)" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] mb-3 font-logo" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
        <button onClick={() => handleCamera(setPhoto)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] mb-3 font-logo hover:border-[#00A4A6]">📸 ADD RECEIPT PHOTO</button>
        {photo && <p className="text-[#22C55E] text-xs mb-3 font-logo">✓ Photo attached</p>}
        <button onClick={addExpense} className="w-full bg-gradient-to-b from-[#00A4A6] to-[#007a7c] text-white font-logo font-bold p-3 rounded shadow-[0_3px_0_#004a4c] hover:scale-[1.02] active:scale-95 transition-all">SAVE EXPENSE</button>
      </div>
      <h3 className="font-logo text-[#00A4A6] text-sm tracking-wider mb-3">RECENT EXPENSES</h3>
      {expenses.length === 0 ? <p className="text-[#F2F0EA]/40 text-xs text-center py-4 font-logo">No expenses logged yet.</p> : (
        <div className="space-y-2">{expenses.map(e => <div key={e.id} className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-lg flex justify-between"><span className="font-logo text-sm">{e.category} - {e.vendor}</span><span className="font-logo text-[#F5C518]">R{e.amount}</span></div>)}</div>
      )}
    </div>
  );

  // ====== ISSUES ======
  const renderIssues = () => (
    <div className="pt-2">
      <h2 className="font-logo text-[#F5C518] text-xl tracking-wider mb-4">REPORT ISSUE</h2>
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 mb-6">
        <select className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] mb-3 font-logo" value={issueArea} onChange={(e) => setIssueArea(e.target.value)}>{issueAreas.map(a => <option key={a}>{a}</option>)}</select>
        <div className="flex gap-2 mb-3">
          {['Low', 'Medium', 'High', 'Critical'].map(p => (
            <button key={p} onClick={() => setIssuePriority(p)} className={`flex-1 p-2 rounded border-2 font-logo text-xs ${issuePriority === p ? `border-[#F5C518] bg-[#2A2A2A]` : 'border-[#2A2A2A] bg-[#0A0A0A]'}`}>{p}</button>
          ))}
        </div>
        <textarea placeholder="Describe the issue (or tap mic)" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] mb-2 font-logo h-20 resize-none" value={issueDesc} onChange={(e) => setIssueDesc(e.target.value)} />
        <button onClick={handleVoiceInput} className={`w-full p-2 rounded mb-3 font-logo ${isListening ? 'bg-[#EF4444] animate-pulse' : 'bg-[#0A0A0A] border border-[#2A2A2A]'}`}>🎤 {isListening ? 'LISTENING...' : 'VOICE INPUT'}</button>
        <button onClick={addIssue} className="w-full bg-gradient-to-b from-[#F5C518] to-[#d4a514] text-[#0A0A0A] font-logo font-bold p-3 rounded shadow-[0_3px_0_#8a6900] hover:scale-[1.02] active:scale-95 transition-all">REPORT ISSUE</button>
      </div>
      <h3 className="font-logo text-[#00A4A6] text-sm tracking-wider mb-3">OPEN ISSUES</h3>
      {issues.length === 0 ? <p className="text-[#F2F0EA]/40 text-xs text-center py-4 font-logo">No open issues.</p> : (
        <div className="space-y-2">{issues.map(i => <div key={i.id} className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-lg"><p className="font-logo text-sm">{i.area}</p><p className="text-xs text-[#F2F0EA]/60">{i.description}</p></div>)}</div>
      )}
    </div>
  );

  // ====== INVENTORY ======
  const renderInventory = () => (
    <div className="pt-2 pb-8">
      <h2 className="font-logo text-[#F5C518] text-xl tracking-wider mb-4">INVENTORY</h2>
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 mb-6">
        <h3 className="font-logo text-[#00A4A6] text-sm tracking-wider mb-3 border-b border-[#2A2A2A] pb-2">ADD ITEM</h3>
        <input placeholder="Item Name" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] mb-2 font-logo" value={invName} onChange={(e) => setInvName(e.target.value)} />
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input type="number" placeholder="Qty" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] font-logo" value={invQty} onChange={(e) => setInvQty(e.target.value)} />
          <input type="number" placeholder="Min Qty" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] font-logo" value={invMin} onChange={(e) => setInvMin(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <select className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] font-logo" value={invUnit} onChange={(e) => setInvUnit(e.target.value)}><option value="pcs">pcs</option><option value="kg">kg</option><option value="L">L</option><option value="m">m</option></select>
          <select className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] font-logo" value={invLocation} onChange={(e) => setInvLocation(e.target.value)}>{invLocations.map(l => <option key={l}>{l}</option>)}</select>
        </div>
        <button onClick={addInventoryItem} className="w-full bg-gradient-to-b from-[#00A4A6] to-[#007a7c] text-white font-logo font-bold p-3 rounded shadow-[0_3px_0_#004a4c] hover:scale-[1.02] active:scale-95 transition-all">ADD TO INVENTORY</button>
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">
        <h3 className="font-logo text-[#00A4A6] text-sm tracking-wider mb-3 border-b border-[#2A2A2A] pb-2">CURRENT STOCK</h3>
        {inventory.length === 0 ? <p className="text-[#F2F0EA]/40 text-xs text-center py-4 font-logo">No inventory items.</p> : (
          <div className="space-y-2">
            {inventory.map(item => (
              <div key={item.id} className={`flex justify-between items-center bg-[#0A0A0A] p-3 rounded-lg border ${item.quantity <= item.min_quantity ? 'border-[#EF4444]' : 'border-[#2A2A2A]'}`}>
                <div>
                  <p className="font-logo text-sm">{item.name}</p>
                  <p className="text-[10px] text-[#F2F0EA]/50 font-logo">{item.location} · Min: {item.min_quantity}{item.unit}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-logo text-lg">{item.quantity}</p>
                    <p className="text-[10px] text-[#F2F0EA]/50 font-logo">{item.unit}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => updateInventoryQty(item.id, 1)} className="bg-[#22C55E] text-black px-2 rounded text-xs font-bold">+</button>
                    <button onClick={() => updateInventoryQty(item.id, -1)} className="bg-[#EF4444] text-white px-2 rounded text-xs font-bold">-</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ====== INSPECTIONS ======
  const renderInspections = () => (
    <div className="pt-2">
      <h2 className="font-logo text-[#F5C518] text-xl tracking-wider mb-4">PRE-START INSPECTION</h2>
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 mb-6">
        {Object.entries(inspectionItems).map(([category, items]) => (
          <div key={category} className="mb-4 border-b border-[#2A2A2A] pb-2 last:border-0">
            <h4 className="font-logo text-[#00A4A6] text-sm tracking-wider mb-2">{category}</h4>
            {items.map(item => (
              <div key={item} className="flex justify-between items-center py-2 border-b border-[#2A2A2A]/50 last:border-0">
                <span className="font-logo text-xs">{item}</span>
                <div className="flex gap-2">
                  {['pass', 'fail', 'na'].map(status => (
                    <button key={status} onClick={() => setInspectionResults({ ...inspectionResults, [item]: status })} className={`px-2 py-1 rounded border font-logo text-[10px] ${inspectionResults[item] === status ? (status === 'pass' ? 'bg-[#22C55E] text-black border-[#22C55E]' : status === 'fail' ? 'bg-[#EF4444] text-white border-[#EF4444]' : 'bg-[#2A2A2A] text-[#F2F0EA] border-[#2A2A2A]') : 'bg-[#0A0A0A] border-[#2A2A2A] text-[#F2F0EA]/50'}`}>{status.toUpperCase()}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
        <button onClick={addInspection} className="w-full mt-4 bg-gradient-to-b from-[#00A4A6] to-[#007a7c] text-white font-logo font-bold p-3 rounded shadow-[0_3px_0_#004a4c] hover:scale-[1.02] active:scale-95 transition-all">COMPLETE INSPECTION</button>
      </div>
    </div>
  );

  // ====== SETTINGS (ADMIN ONLY) ======
  const renderSettings = () => {
    if (user.role !== 'admin') return (
      <div className="pt-2 pb-8 text-center">
        <p className="font-logo text-[#EF4444] text-lg">Access Denied.</p>
        <p className="text-[#F2F0EA]/50 text-sm mt-2">Only Administrators can access Settings.</p>
      </div>
    );

    return (
      <div className="pt-2 pb-8">
        <h2 className="font-logo text-[#F5C518] text-xl tracking-wider mb-4">SETTINGS</h2>
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 mb-6">
          <h3 className="font-logo text-[#00A4A6] text-sm tracking-wider mb-3 border-b border-[#2A2A2A] pb-2">ADD OPERATOR</h3>
          <input placeholder="Full Name" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] mb-2 font-logo" value={newOpName} onChange={(e) => setNewOpName(e.target.value)} />
          <input type="password" maxLength="4" placeholder="4-Digit PIN" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] mb-2 font-logo" value={newOpPin} onChange={(e) => setNewOpPin(e.target.value)} />
          <select className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] mb-3 font-logo" value={newOpRole} onChange={(e) => setNewOpRole(e.target.value)}><option value="operator">Operator</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select>
          <button onClick={addOperator} className="w-full bg-gradient-to-b from-[#F5C518] to-[#d4a514] text-[#0A0A0A] font-logo font-bold p-3 rounded shadow-[0_3px_0_#8a6900] hover:scale-[1.02] active:scale-95 transition-all">ADD OPERATOR</button>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">
          <h3 className="font-logo text-[#00A4A6] text-sm tracking-wider mb-3 border-b border-[#2A2A2A] pb-2">CURRENT OPERATORS</h3>
          {operators.map(op => <div key={op.id} className="flex justify-between items-center border-b border-[#2A2A2A] py-2 last:border-0"><span className="font-logo text-sm">{op.name}</span><span className="text-xs text-[#F2F0EA]/50 uppercase">{op.role}</span></div>)}
        </div>
      </div>
    );
  };

  // ====== REPORTS TAB ======
  const renderReports = () => (
    <div className="pt-2 pb-8">
      <h2 className="font-logo text-[#F5C518] text-xl tracking-wider mb-4">REPORTS</h2>
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-6 mb-6 text-center">
        <div className="mb-4 border-b border-[#2A2A2A] pb-4">
          <h3 className="font-logo text-[#00A4A6] text-sm tracking-wider">REPORT SUMMARY</h3>
          <p className="text-xs text-[#F2F0EA]/60 mt-1">Malekaskraal · W2100-001 · {user.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#0A0A0A] p-3 rounded border border-[#2A2A2A]">
            <p className="text-[10px] text-[#F2F0EA]/50 font-logo">MONTH HOURS</p>
            <p className="font-logo text-lg">{totalMonthHours.toFixed(1)}h</p>
          </div>
          <div className="bg-[#0A0A0A] p-3 rounded border border-[#2A2A2A]">
            <p className="text-[10px] text-[#F2F0EA]/50 font-logo">TODAY</p>
            <p className="font-logo text-lg text-[#00A4A6]">{todayHours.toFixed(1)}h</p>
          </div>
          <div className="bg-[#0A0A0A] p-3 rounded border border-[#2A2A2A]">
            <p className="text-[10px] text-[#F2F0EA]/50 font-logo">EXPENSES</p>
            <p className="font-logo text-lg text-[#F5C518]">R{expenses.reduce((s, e) => s + e.amount, 0).toFixed(0)}</p>
          </div>
          <div className="bg-[#0A0A0A] p-3 rounded border border-[#2A2A2A]">
            <p className="text-[10px] text-[#F2F0EA]/50 font-logo">OPEN ISSUES</p>
            <p className="font-logo text-lg text-[#EF4444]">{issues.filter(i => i.status === 'open').length}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={handlePrintPDF} className="w-full bg-gradient-to-b from-[#F2F0EA] to-[#d4d4d4] text-[#0A0A0A] font-logo font-bold p-3 rounded shadow-[0_3px_0_#999] hover:scale-[1.02] active:scale-95 transition-all">📄 PRINT / SAVE AS PDF</button>
          <button onClick={handleShare} className="w-full bg-gradient-to-b from-[#00A4A6] to-[#007a7c] text-white font-logo font-bold p-3 rounded shadow-[0_3px_0_#004a4c] hover:scale-[1.02] active:scale-95 transition-all">📤 SHARE (WhatsApp / Email)</button>
        </div>
      </div>
    </div>
  );

  // ====== STOP MODALS ======
  const stopModals = (
    <>
      {showStopModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] border-2 border-[#2A2A2A] rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <h3 className="font-logo text-[#F5C518] text-xl font-bold mb-6 text-center tracking-wider">SELECT STOP REASON</h3>
            <div className="grid grid-cols-2 gap-3">
              {stopReasons.map((reason) => (
                <button key={reason} onClick={() => { setSelectedReason(reason); setShowStopModal(false); setShowReportModal(true); }} className="font-logo bg-[#0A0A0A] border-2 border-[#2A2A2A] hover:border-[#EF4444] hover:bg-[#1a0a0a] text-[#F2F0EA] p-4 rounded-xl text-sm tracking-wide transition-all">{reason}</button>
              ))}
            </div>
            <button onClick={() => setShowStopModal(false)} className="mt-6 w-full font-logo text-[#F2F0EA]/50 text-sm underline underline-offset-4 hover:text-white transition">CANCEL</button>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] border-2 border-[#2A2A2A] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="font-logo text-[#00A4A6] text-xl font-bold mb-2 text-center tracking-wider">STOP REPORT</h3>
            <p className="text-center text-[#F2F0EA]/60 text-sm mb-4 font-logo tracking-wide">Reason: <span className="text-[#F5C518]">{selectedReason}</span></p>
            <div className="mb-4"><button onClick={() => handleCamera(setPhoto)} className="w-full bg-[#0A0A0A] border-2 border-[#2A2A2A] hover:border-[#00A4A6] p-4 rounded-xl text-[#F2F0EA] font-logo text-sm transition-all flex items-center justify-center gap-2">📸 TAKE PHOTO</button>{photo && <p className="text-[#22C55E] text-xs text-center mt-2 font-logo">✓ Photo Captured</p>}</div>
            <div className="mb-4 relative">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Enter notes or tap microphone to speak..." className="w-full bg-[#0A0A0A] border-2 border-[#2A2A2A] rounded-xl p-3 text-[#F2F0EA] text-sm h-24 resize-none focus:border-[#00A4A6] outline-none transition-all font-logo" />
              <button onClick={handleVoiceInput} className={`absolute bottom-3 right-3 p-2 rounded-full transition-all ${isListening ? 'bg-[#EF4444] animate-pulse text-white' : 'bg-[#2A2A2A] text-[#F2F0EA] hover:bg-[#00A4A6]'}`}>{isListening ? '🎙️' : '🎤'}</button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowReportModal(false)} className="flex-1 font-logo text-[#F2F0EA]/50 text-sm underline underline-offset-4 hover:text-white transition">CANCEL</button>
              <button onClick={finalizeStop} className="flex-1 bg-gradient-to-b from-[#EF4444] to-[#b91c1c] text-white font-logo font-bold p-3 rounded-xl text-sm tracking-wider shadow-[0_3px_0_#7a1a1a] hover:scale-[1.02] active:scale-95 transition-all">CONFIRM STOP</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const finalizeStop = () => {
    setIsMachineRunning(false); setShowReportModal(false);
    addHistory('Machine Stopped', `${selectedReason}${note ? ` | Note: ${note}` : ''}`);
    setSelectedReason(''); setPhoto(null); setNote('');
  };

  // ====== OFFLINE STATUS ======
  const offlineStatus = () => {
    if (!navigator.onLine) return <span className="text-[#EF4444] ml-2 text-[10px] font-logo">● OFFLINE (Sync Pending)</span>;
    return <span className="text-[#22C55E] ml-2 text-[10px] font-logo">● ONLINE</span>;
  };

  // ====== MAIN RENDER ======
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F2F0EA] pb-20">
      <div className="fixed top-0 right-0 p-2 z-50 bg-[#141414] border-l border-b border-[#2A2A2A] rounded-bl-lg">
        {offlineStatus()}
      </div>

      <div className="p-4 pt-8">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'expenses' && renderExpenses()}
        {activeTab === 'issues' && renderIssues()}
        {activeTab === 'inventory' && renderInventory()}
        {activeTab === 'inspections' && renderInspections()}
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'reports' && renderReports()}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#141414] border-t border-[#2A2A2A] p-2 flex justify-around items-center z-40">
        {[
          { id: 'dashboard', label: 'DASHBOARD', icon: '📊' },
          { id: 'expenses', label: 'EXPENSES', icon: '💰' },
          { id: 'issues', label: 'ISSUES', icon: '⚠️' },
          { id: 'inventory', label: 'INVENTORY', icon: '📦' },
          { id: 'inspections', label: 'INSPECT', icon: '🔍' },
          { id: 'reports', label: 'REPORTS', icon: '📄' },
          ...(user.role === 'admin' ? [{ id: 'settings', label: 'SETTINGS', icon: '⚙️' }] : [])
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center p-2 rounded-lg transition-all ${activeTab === tab.id ? 'text-[#F5C518] bg-[#0A0A0A]' : 'text-[#F2F0EA]/50 hover:text-[#F2F0EA]'}`}>
            <span className="text-lg">{tab.icon}</span>
            <span className="font-logo text-[10px] tracking-wider mt-1">{tab.label}</span>
          </button>
        ))}
      </div>

      {startShiftModal}
      {endShiftModal}
      {stopModals}
    </div>
  );
}