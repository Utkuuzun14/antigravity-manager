import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Treemap, RadialBarChart, RadialBar, ComposedChart, ZAxis, FunnelChart, Funnel, LabelList
} from 'recharts';
import {
  BarChart2, TrendingUp, PieChart as PieIcon, Activity,
  Grid, Maximize, Zap, FileJson, Image as ImageIcon, Download,
  RefreshCw, Box, BrainCircuit, Sparkles, Wand2, MessageSquare, X, Info,
  Filter, Disc, Upload, FileText, AlertCircle, Layers, AlignLeft
} from 'lucide-react';

// ==========================================
// 🔑 API AYARLARI
// ==========================================
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// ==========================================
// 🧠 YARDIMCI FONKSİYONLAR
// ==========================================

function cleanAIResponse(text) {
  if (!text) return null;
  try {
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');

    if (start !== -1 && end !== -1) {
      cleaned = cleaned.substring(start, end + 1);
    } else {
      const objStart = cleaned.indexOf('{');
      const objEnd = cleaned.lastIndexOf('}');
      if (objStart !== -1 && objEnd !== -1) {
        if (!cleaned.includes('[')) {
          cleaned = `[${cleaned.substring(objStart, objEnd + 1)}]`;
        }
      }
    }
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed) && parsed.data && Array.isArray(parsed.data)) {
      return JSON.stringify(parsed.data, null, 2);
    }

    if (Array.isArray(parsed)) return JSON.stringify(parsed, null, 2);
    return null;
  } catch (e) { console.error("JSON Clean Error", e); return null; }
}

// 1. AI Text API
const callGemini = async (prompt, systemInstruction = "") => {
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 3000,
      responseMimeType: "application/json"
    }
  };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`API Hatası: ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (error) { return null; }
};

// 2. AI Vision API
const callGeminiVision = async (base64Data, mimeType) => {
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{
      parts: [
        { text: "Sen uzman bir veri analistisin. Bu görseldeki grafiği analiz et. Verileri JSON Array olarak çıkar. Sadece JSON ver. Nesneler {name: string, value: number} formatında olsun." },
        { inlineData: { mimeType: mimeType, data: base64Data } }
      ]
    }],
    generationConfig: { responseMimeType: "application/json" }
  };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(response.status);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (error) { return null; }
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = error => reject(error);
});

// 3. Gelişmiş CSV Parser
const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const separator = lines[0].includes(';') ? ';' : ',';

  const splitCSVRow = (row) => {
    const regex = new RegExp(`(?:^|${separator})(\"(?:[^\"]+|\"\")*\"|[^${separator}]*)`, "g");
    let matches = [];
    let match;
    while (match = regex.exec(row)) {
      let val = match[1];
      if (val) val = val.replace(/^"|"$/g, '').replace(/""/g, '"');
      else val = "";
      matches.push(val.trim());
    }
    if (matches.length === 0) return row.split(separator);
    return matches;
  };

  const headers = splitCSVRow(lines[0]);
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVRow(lines[i]);
    if (cells.length >= headers.length - 1) {
      const obj = {};
      headers.forEach((h, idx) => {
        let val = cells[idx];
        if (val && !isNaN(Number(val)) && val.trim() !== '') obj[h] = Number(val);
        else obj[h] = val;
      });
      result.push(obj);
    }
  }
  return result;
};

// 4. Veri Gruplama
const aggregateData = (data, groupBy, countBy = null) => {
  const counts = {};
  data.forEach(item => {
    const key = item[groupBy];
    if (key !== undefined && key !== null) {
      if (countBy) counts[key] = (counts[key] || 0) + (Number(item[countBy]) || 0);
      else counts[key] = (counts[key] || 0) + 1;
    }
  });
  return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
};

// ==========================================
// 📊 VARSAYILAN VERİLER
// ==========================================
const DATA_SETS = {
  timeSeries: [{ name: 'Oca', value: 4000 }, { name: 'Şub', value: 3000 }, { name: 'Mar', value: 2000 }, { name: 'Nis', value: 2780 }, { name: 'May', value: 1890 }, { name: 'Haz', value: 2390 }],
  ranking: [{ name: 'Google', value: 90 }, { name: 'Youtube', value: 85 }, { name: 'Facebook', value: 70 }, { name: 'Amazon', value: 65 }, { name: 'X', value: 45 }],
  pieData: [{ name: 'Mobil', value: 60 }, { name: 'PC', value: 30 }, { name: 'Tablet', value: 10 }],
  funnelData: [{ value: 100, name: 'Görüntüleme', fill: '#8884d8' }, { value: 80, name: 'Tıklama', fill: '#83a6ed' }, { value: 50, name: 'Sepet', fill: '#8dd1e1' }, { value: 26, name: 'Sipariş', fill: '#a4de6c' }],
};

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#06b6d4', '#f97316'];

// ==========================================
// 🧱 BİLEŞENLER
// ==========================================

// Özel Treemap İçeriği
const CustomTreemapContent = (props) => {
  const { root, depth, x, y, width, height, index, payload, colors, rank, name, value } = props;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: COLORS[index % COLORS.length],
          stroke: '#fff',
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
      />
      {width > 30 && height > 30 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 7} textAnchor="middle" fill="#fff" fontSize={12} fontWeight="bold">
            {name}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 7} textAnchor="middle" fill="#fff" fontSize={10}>
            {value}
          </text>
        </>
      )}
    </g>
  );
};

function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-[#0f172a] border-b border-slate-800">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Activity className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight leading-none">
            Antigravity <span className="text-indigo-400 font-light">Manager</span>
          </h1>
          <p className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold mt-1">AI-Powered Data Engine v5.0</p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-full border border-slate-700 text-xs text-indigo-300">
          <BrainCircuit size={14} /> Gemini 2.5 Connected
        </div>
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border-2 border-slate-800 shadow-xl"></div>
      </div>
    </header>
  );
}

function InsightPanel({ insights, loading, onClose }) {
  return (
    <div className="absolute top-20 right-6 w-80 bg-[#1e293b]/95 backdrop-blur-md border border-indigo-500/30 shadow-2xl rounded-xl z-20 overflow-hidden animate-in slide-in-from-right-10 fade-in duration-300">
      <div className="bg-indigo-600/20 p-4 border-b border-indigo-500/20 flex justify-between items-center">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Sparkles size={16} className="text-yellow-400" /> AI Analiz Raporu
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={16} /></button>
      </div>
      <div className="p-5 min-h-[150px] max-h-[400px] overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-3 py-8">
            <BrainCircuit className="w-8 h-8 text-indigo-400 animate-pulse" />
            <p className="text-xs text-indigo-300 animate-pulse">Veriler inceleniyor...</p>
          </div>
        ) : (
          <div className="text-sm text-slate-300 space-y-3 leading-relaxed">
            {insights ? insights.split('\n').map((line, i) => <p key={i}>{line}</p>) : <p className="text-red-400">Analiz oluşturulamadı.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function DataGenModal({ isOpen, onClose, onGenerate, loading }) {
  const [prompt, setPrompt] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-6">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Wand2 className="text-indigo-400" /> AI Veri Sihirbazı</h3>
          <p className="text-xs text-slate-400 mb-4">Ne üretilsin? (Örn: "2025 yılı aylık Bitcoin tahmini")</p>
          <textarea
            className="w-full bg-[#0b1121] border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-32"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">İptal</button>
            <button onClick={() => onGenerate(prompt)} disabled={loading || !prompt.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg flex items-center gap-2">{loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />} Üret</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 🚀 ANA UYGULAMA
// ==========================================
export default function AntigravityManager() {
  const [activeData, setActiveData] = useState(DATA_SETS.timeSeries);
  const [dataInput, setDataInput] = useState(JSON.stringify(DATA_SETS.timeSeries, null, 2));
  const [chartType, setChartType] = useState('area');
  const [chartKeys, setChartKeys] = useState({ x: 'name', y: 'value' });
  const [dataDescription, setDataDescription] = useState('');

  // UI States
  const [showInsightPanel, setShowInsightPanel] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);
  const [genLoading, setGenLoading] = useState(false);

  // Vision & File
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageAnalysisMessage, setImageAnalysisMessage] = useState('');
  const [imagePreview, setImagePreview] = useState(null);

  const fileInputRef = useRef(null);
  const dataFileInputRef = useRef(null);

  // --- ANALİZ MOTORU ---
  const analyzeAndSetData = (rawData) => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return;

    let dataToShow = rawData;
    const firstItem = rawData[0];
    const keys = Object.keys(firstItem);

    // Büyük Veri Kontrolü (Aggregation)
    if (rawData.length > 20) {
      const catKey = keys.find(k => typeof firstItem[k] === 'string') || keys[0];
      const numKey = keys.find(k => typeof firstItem[k] === 'number');
      dataToShow = aggregateData(rawData, catKey, numKey).slice(0, 20);
    }

    const processedFirst = dataToShow[0];
    const pKeys = Object.keys(processedFirst);
    let newX = pKeys.find(k => typeof processedFirst[k] === 'string') || 'name';
    let newY = pKeys.find(k => typeof processedFirst[k] === 'number') || 'value';

    if (pKeys.includes('name')) newX = 'name';
    if (pKeys.includes('value')) newY = 'value';

    // Composed Chart için ekstra veri
    if (!pKeys.includes('uv') && typeof processedFirst[newY] === 'number') {
      dataToShow = dataToShow.map(item => ({
        ...item,
        uv: Math.round(item[newY] * (0.8 + Math.random() * 0.4))
      }));
    }

    setChartKeys({ x: newX, y: newY });
    setActiveData(dataToShow);

    const maxVal = Math.max(...dataToShow.map(d => d[newY] || 0));
    const minVal = Math.min(...dataToShow.map(d => d[newY] || 0));
    setDataDescription(`Bu grafik, **${newX}** kategorisine göre **${newY}** değerlerinin dağılımını göstermektedir. Görüntülenen veri setinde en yüksek değer **${maxVal}**, en düşük değer ise **${minVal}** olarak tespit edilmiştir. Toplam **${dataToShow.length}** veri noktası analiz edilmiştir.`);
  };

  useEffect(() => {
    try {
      const parsed = JSON.parse(dataInput);
      analyzeAndSetData(parsed);
    } catch (e) { }
  }, [dataInput]);

  // --- HANDLERS ---
  const handleGenerateInsight = async () => {
    setShowInsightPanel(true);
    setInsightLoading(true);
    const prompt = `Veri analisti olarak şu JSON verisini yorumla: ${JSON.stringify(activeData).slice(0, 1000)}... Türkçe 3 madde yaz.`;
    try {
      const result = await callGemini(prompt);
      setInsights(result || "Analiz başarısız.");
    } catch (e) { setInsights("Hata."); } finally { setInsightLoading(false); }
  };

  // AI VERİ ÜRETME
  const handleGenerateData = async (userPrompt) => {
    setGenLoading(true);
    try {
      let raw = await callGemini(userPrompt, "JSON Array formatında veri seti üret. Anahtarlar (keys) İngilizce ve tutarlı olsun (örn: name, value, date, category). Değerler sayısal veya metin olabilir. Markdown kullanma.");
      const cleaned = cleanAIResponse(raw);
      if (cleaned) { setDataInput(cleaned); setShowGenModal(false); }
      else alert("Veri formatı anlaşılamadı.");
    } catch (e) { alert("Üretilemedi."); } finally { setGenLoading(false); }
  };

  const handleFileUpload = async (e) => { // VISION
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImagePreview(URL.createObjectURL(file));
    setIsAnalyzingImage(true);
    setImageAnalysisMessage('Görsel taranıyor...');
    try {
      const base64 = await fileToBase64(file);
      let raw = await callGeminiVision(base64, file.type);
      const cleaned = cleanAIResponse(raw);
      if (cleaned) { setDataInput(cleaned); }
      else { alert("Görsel okundu ama veri çıkarılamadı."); }
    } catch (e) { alert("Hata oluştu."); } finally { setIsAnalyzingImage(false); }
  };

  const handleDataFileUpload = (e) => { // CSV/JSON
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      try {
        if (file.name.endsWith('.json')) {
          JSON.parse(content);
          setDataInput(content);
        } else {
          const csvData = parseCSV(content);
          if (csvData.length > 0) setDataInput(JSON.stringify(csvData, null, 2));
          else alert("Dosya boş veya format hatalı.");
        }
      } catch (err) { console.error(err); alert("Dosya okunamadı."); }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const clearImage = (e) => { e.stopPropagation(); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  // --- RENDERERS (ETİKETLİ) ---
  const renderChart = () => {
    const { x, y } = chartKeys;
    const CommonAxis = () => (<> <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} /> <XAxis dataKey={x} stroke="#94a3b8" tick={{ fontSize: 11 }} dy={10} /> <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} dx={-10} /> <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }} /> <Legend wrapperStyle={{ paddingTop: '20px' }} /> </>);
    const labelStyle = { fill: '#e2e8f0', fontSize: 10, fontWeight: 500 };

    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={activeData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
            <CommonAxis />
            <Bar dataKey={y} fill="#6366f1" radius={[4, 4, 0, 0]} name="Değer">
              <LabelList dataKey={y} position="top" style={labelStyle} />
            </Bar>
          </BarChart>
        );
      case 'bar-hor':
        return (
          <BarChart layout="vertical" data={activeData} margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" stroke="#94a3b8" />
            <YAxis dataKey={x} type="category" stroke="#94a3b8" width={80} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b' }} />
            <Bar dataKey={y} fill="#8b5cf6" radius={[0, 4, 4, 0]}>
              <LabelList dataKey={y} position="right" style={labelStyle} />
            </Bar>
          </BarChart>
        );
      case 'bar-stack':
        return (
          <BarChart data={activeData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
            <CommonAxis />
            <Bar dataKey={y} stackId="a" fill="#6366f1">
              <LabelList dataKey={y} position="center" style={{ ...labelStyle, fill: '#fff' }} />
            </Bar>
            <Bar dataKey="uv" stackId="a" fill="#3b82f6" name="Tahmin">
              <LabelList dataKey="uv" position="top" style={labelStyle} />
            </Bar>
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={activeData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
            <CommonAxis />
            <Line type="monotone" dataKey={y} stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }}>
              <LabelList dataKey={y} position="top" style={labelStyle} offset={10} />
            </Line>
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={activeData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
            <defs><linearGradient id="cV" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
            <CommonAxis />
            <Area type="monotone" dataKey={y} stroke="#6366f1" fill="url(#cV)">
              <LabelList dataKey={y} position="top" style={labelStyle} />
            </Area>
          </AreaChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie data={activeData} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey={y} nameKey={x} label>
              {activeData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        );
      case 'donut':
        return (
          <PieChart>
            <Pie data={activeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} fill="#8884d8" dataKey={y} nameKey={x} paddingAngle={5} label>
              {activeData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        );
      case 'radial':
        return (
          <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" barSize={20} data={activeData}>
            <RadialBar minAngle={15} label={{ position: 'insideStart', fill: '#fff' }} background clockWise dataKey={y} />
            <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
            <Tooltip />
          </RadialBarChart>
        );
      case 'funnel':
        return (
          <FunnelChart>
            <Tooltip />
            <Funnel data={activeData} dataKey={y} nameKey={x} isAnimationActive>
              <LabelList position="right" fill="#fff" stroke="none" dataKey={x} />
              <LabelList position="center" fill="#000" stroke="none" dataKey={y} />
            </Funnel>
          </FunnelChart>
        );
      case 'composed':
        return (
          <ComposedChart data={activeData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
            <CommonAxis />
            <Area type="monotone" dataKey="uv" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.2} />
            <Bar dataKey={y} barSize={20} fill="#6366f1">
              <LabelList dataKey={y} position="top" style={labelStyle} />
            </Bar>
            <Line type="monotone" dataKey={y} stroke="#ff7300" />
          </ComposedChart>
        );
      // Diğer grafikler (Scatter/Treemap için özelleştirilmiş)
      case 'treemap':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap data={activeData} dataKey={y || 'size'} nameKey={x || 'name'} aspectRatio={4 / 3} stroke="#0f172a" fill="#8884d8" content={<CustomTreemapContent />} />
          </ResponsiveContainer>
        );
      default: return <div className="text-white flex items-center justify-center h-full">Grafik Seçilmedi</div>;
    }
  };

  const chartTypes = [
    { id: 'bar', l: 'Bar', icon: BarChart2 }, { id: 'bar-hor', l: 'Yatay Bar', icon: AlignLeft }, { id: 'bar-stack', l: 'Yığınlı Bar', icon: Layers },
    { id: 'line', l: 'Line', icon: TrendingUp }, { id: 'area', l: 'Area', icon: Activity }, { id: 'composed', l: 'Karma', icon: Grid },
    { id: 'pie', l: 'Pie', icon: PieIcon }, { id: 'donut', l: 'Donut', icon: Disc }, { id: 'radial', l: 'Radial', icon: RefreshCw },
    { id: 'funnel', l: 'Funnel', icon: Filter }
  ];

  return (
    <div className="min-h-screen bg-[#0b1121] text-slate-200 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <Header />
      {showInsightPanel && <InsightPanel insights={insights} loading={insightLoading} onClose={() => setShowInsightPanel(false)} />}
      <DataGenModal isOpen={showGenModal} onClose={() => setShowGenModal(false)} onGenerate={handleGenerateData} loading={genLoading} />

      <main className="p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-80px)] overflow-hidden">

        {/* SOL PANEL */}
        <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 pb-10 custom-scrollbar">
          {/* VISION */}
          <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl p-1 backdrop-blur-sm">
            <div className="bg-[#0f172a] rounded-xl p-5 border border-slate-800">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide"><Zap className="text-yellow-400 w-4 h-4" /> AI Vision & ML</h2>
              {imagePreview ? (
                <div className="relative w-full h-40 group animate-in fade-in zoom-in duration-300">
                  <img src={imagePreview} alt="Analiz" className="w-full h-full object-cover rounded-xl border border-indigo-500/50" />
                  {isAnalyzingImage && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center"><RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-2" /><span className="text-xs text-indigo-300 font-mono animate-pulse">{imageAnalysisMessage}</span></div>}
                  <button onClick={clearImage} className="absolute top-2 right-2 bg-slate-900/80 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-red-500 transition-colors border border-slate-700"><X size={14} /></button>
                </div>
              ) : (
                <div className="relative group border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-slate-800/50 rounded-xl transition-all cursor-pointer h-32 flex flex-col items-center justify-center" onClick={() => fileInputRef.current?.click()}>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-lg shadow-black/50"><ImageIcon className="text-slate-400 w-5 h-5 group-hover:text-white" /></div>
                  <p className="text-xs text-slate-400 font-medium">Görsel Yükle / Analiz Et</p>
                </div>
              )}
            </div>
          </div>

          {/* DATA INPUT */}
          <div className="flex-1 flex flex-col bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl p-1 backdrop-blur-sm">
            <div className="flex-1 bg-[#0f172a] rounded-xl p-5 border border-slate-800 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide"><FileJson className="text-indigo-400 w-4 h-4" /> Veri Kaynağı</h2>
                <div className="flex gap-2">
                  <input type="file" ref={dataFileInputRef} className="hidden" accept=".json,.csv,.txt" onChange={handleDataFileUpload} />
                  <button onClick={() => dataFileInputRef.current?.click()} className="text-[10px] px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-1 transition-all hover:scale-105"><Upload size={10} /> Dosya</button>
                  <button onClick={() => setShowGenModal(true)} className="text-[10px] px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center gap-1 shadow-lg shadow-indigo-600/20 transition-all hover:scale-105"><Wand2 size={10} /> AI Üret</button>
                </div>
              </div>
              <div className="flex gap-1 mb-2 overflow-x-auto pb-1 custom-scrollbar">
                {Object.keys(DATA_SETS).map(key => <button key={key} onClick={() => setDataInput(JSON.stringify(DATA_SETS[key], null, 2))} className="text-[10px] px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:text-white whitespace-nowrap">{key}</button>)}
              </div>
              <div className="relative flex-1 group">
                <textarea className="w-full h-full bg-[#0b1121] border border-slate-700 rounded-lg p-3 font-mono text-xs text-green-400 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed" value={dataInput} onChange={(e) => setDataInput(e.target.value)} spellCheck="false" />
              </div>
            </div>
          </div>
        </div>

        {/* SAĞ PANEL */}
        <div className="lg:col-span-8 flex flex-col gap-6 h-full overflow-hidden">
          <div className="flex-1 bg-[#1e293b]/30 border border-slate-700/50 rounded-3xl p-1 relative backdrop-blur-sm shadow-2xl">
            <div className="h-full bg-[#0f172a] rounded-[20px] border border-slate-800 p-6 flex flex-col relative">
              <div className="flex justify-between items-start mb-6">
                <div><h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">{chartType.toUpperCase()} <span className="text-slate-500 text-sm font-normal self-end mb-1">/ Önizleme</span></h2></div>
                <div className="flex gap-2">
                  <button onClick={handleGenerateInsight} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center gap-2 transition-all shadow-lg hover:shadow-indigo-600/50"><MessageSquare size={14} /> ✨ AI Analiz</button>
                  <button className="p-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 text-white"><Maximize size={18} /></button>
                </div>
              </div>

              <div className="flex-1 w-full min-h-[300px] bg-gradient-to-b from-[#0b1121] to-[#0f172a] rounded-xl border border-slate-800 p-4 relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">{renderChart()}</ResponsiveContainer>
              </div>

              {/* GRAFİK AÇIKLAMA KARTI */}
              <div className="mt-4 p-4 bg-indigo-950/30 border border-indigo-500/20 rounded-lg flex items-start gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg"><Info className="text-indigo-400" size={18} /></div>
                <div>
                  <h4 className="text-sm font-semibold text-indigo-200 mb-1">Veri Görünümü Özeti</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {dataDescription || "Veri yükleniyor..."}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-semibold">Grafik Motoru Modları (10 Tür)</p>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {chartTypes.map((type) => (
                    <button key={type.id} onClick={() => setChartType(type.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${chartType === type.id ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg scale-105' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'}`}>
                      <type.icon size={16} /> {type.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}