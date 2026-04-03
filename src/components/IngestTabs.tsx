'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Send, Link as LinkIcon, Mail, Loader2, CheckCircle, AlertCircle,
  Upload, FileText, X, FileUp, Globe, BookMarked, Plus, Search
} from 'lucide-react';

type Tab = 'zoho' | 'pdf';
type Status = 'idle' | 'loading' | 'success' | 'error';

export default function IngestTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('zoho');

  // ─── Zoho state ───
  const [links, setLinks] = useState('');
  const [email, setEmail] = useState('');
  const [zohoStatus, setZohoStatus] = useState<Status>('idle');
  const [zohoError, setZohoError] = useState('');

  // ─── PDF state ───
  const [file, setFile] = useState<File | null>(null);
  const [pdfUser, setPdfUser] = useState('');
  const [manual, setManual] = useState('Ecuador');
  const [customManual, setCustomManual] = useState('');
  const [articuloName, setArticuloName] = useState('');
  const [pdfStatus, setPdfStatus] = useState<Status>('idle');
  const [pdfError, setPdfError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  // ─── Autocomplete state ───
  const [existingArticulos, setExistingArticulos] = useState<{articulo: string; manual: string}[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<{articulo: string; manual: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const MANUAL_OPTIONS = ['Ecuador', 'Colombia', 'Panamá', 'Symphony', 'Opera'];

  // ─── Fetch existing articles ───
  useEffect(() => {
    const fetchArticles = async () => {
      setIsFetchingSuggestions(true);
      try {
        const res = await fetch('/api/db/rag-collections');
        if (res.ok) {
          const json = await res.json();
          const flatList: {articulo: string; manual: string}[] = [];
          
          if (json.data && Array.isArray(json.data)) {
            json.data.forEach((group: any) => {
              if (group.articulos && Array.isArray(group.articulos)) {
                group.articulos.forEach((art: any) => {
                  flatList.push({
                    articulo: art.articulo,
                    manual: group.manual
                  });
                });
              }
            });
          }
          // Eliminar duplicados exactos si los hay
          const uniqueList = flatList.filter((v, i, a) => 
            a.findIndex(t => (t.articulo === v.articulo && t.manual === v.manual)) === i
          );
          setExistingArticulos(uniqueList);
        }
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      } finally {
        setIsFetchingSuggestions(false);
      }
    };

    fetchArticles();
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleArticuloChange = (val: string) => {
    setArticuloName(val);
    if (val.length > 1) {
      const filtered = existingArticulos.filter(item => 
        item.articulo.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 8); // Limitar a 8 sugerencias
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (item: {articulo: string; manual: string}) => {
    setArticuloName(item.articulo);
    
    // Si el manual está en las opciones estándar, seleccionarlo
    if (MANUAL_OPTIONS.includes(item.manual)) {
      setManual(item.manual);
      setCustomManual('');
    } else {
      // Si no, ponerlo como custom
      setManual('custom');
      setCustomManual(item.manual);
    }
    
    setShowSuggestions(false);
  };

  // ─── Zoho validation ───
  const ZOHO_LEARN_DOMAINS = [
    'learn.zoho.com',
    'learn.zohopublic.com',
    'learncustomer.zoho.com',
  ];

  const isValidZohoLink = (url: string): boolean => {
    try {
      const parsed = new URL(url.trim());
      return ZOHO_LEARN_DOMAINS.some(domain => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain));
    } catch {
      return false;
    }
  };

  const validateZohoLinks = (raw: string): { valid: boolean; invalidLinks: string[] } => {
    const urls = raw.split(',').map(l => l.trim()).filter(l => l.length > 0);
    if (urls.length === 0) return { valid: false, invalidLinks: [] };
    const invalidLinks = urls.filter(url => !isValidZohoLink(url));
    return { valid: invalidLinks.length === 0, invalidLinks };
  };

  // ─── PDF validation ───
  const isValidPdf = (f: File): boolean => {
    const hasValidExtension = f.name.toLowerCase().endsWith('.pdf');
    const hasValidMime = f.type === 'application/pdf';
    return hasValidExtension && hasValidMime;
  };

  // ─── Zoho handlers ───
  const handleZohoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setZohoStatus('loading');
    setZohoError('');

    // Validar que todos los links sean de Zoho Learn
    const { valid, invalidLinks } = validateZohoLinks(links);
    if (!valid) {
      setZohoStatus('error');
      if (invalidLinks.length > 0) {
        setZohoError(`Los siguientes links no son de Zoho Learn: ${invalidLinks.join(', ')}`);
      } else {
        setZohoError('Ingresa al menos un link válido de Zoho Learn.');
      }
      return;
    }

    try {
      const payload = [{
        "Links de Zoho Learn": links,
        "Correo del responsable": email,
        "submittedAt": new Date().toISOString(),
        "formMode": "production"
      }];

      const res = await fetch('https://sara.mysatcomla.com/webhook/ingesta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Error: ${res.statusText}`);

      setZohoStatus('success');
      setLinks('');
      setTimeout(() => setZohoStatus('idle'), 3000);
    } catch (error: any) {
      setZohoStatus('error');
      setZohoError(error.message || 'Error desconocido');
    }
  };

  // ─── PDF handlers ───
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && isValidPdf(droppedFile)) {
      setFile(droppedFile);
    } else {
      setPdfError('Solo se permiten archivos PDF (.pdf).');
      setPdfStatus('error');
      setTimeout(() => setPdfStatus('idle'), 3000);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && isValidPdf(selected)) {
      setFile(selected);
      setPdfStatus('idle');
      setPdfError('');
    } else if (selected) {
      setPdfError('Solo se permiten archivos PDF (.pdf). El archivo seleccionado no es válido.');
      setPdfStatus('error');
      setTimeout(() => setPdfStatus('idle'), 3000);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handlePdfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    if (!pdfUser.trim() || !pdfUser.includes('@')) {
      setPdfStatus('error');
      setPdfError('Ingresa un correo electrónico válido.');
      return;
    }

    setPdfStatus('loading');
    setPdfError('');

    try {
      const finalManual = manual === 'custom' ? customManual : manual;
      
      if (!finalManual.trim()) {
        setPdfStatus('error');
        setPdfError('Por favor selecciona o ingresa un manual.');
        return;
      }

      if (!articuloName.trim()) {
        setPdfStatus('error');
        setPdfError('Por favor ingresa el nombre del artículo.');
        return;
      }

      const formData = new FormData();
      formData.append('data', file, file.name);
      formData.append('user', pdfUser.trim());
      formData.append('manual', finalManual.trim());
      formData.append('articulo', articuloName.trim());

      const res = await fetch('https://sara.mysatcomla.com/webhook/ingesta-documentos', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`Error: ${res.statusText}`);

      setPdfStatus('success');
      setFile(null);
      setPdfUser('');
      setArticuloName('');
      setCustomManual('');
      if (inputRef.current) inputRef.current.value = '';
      setTimeout(() => setPdfStatus('idle'), 4000);
    } catch (error: any) {
      setPdfStatus('error');
      setPdfError(error.message || 'Error desconocido al subir el archivo');
    }
  };

  // ─── Shared status banner ───
  const StatusBanner = ({ status, error, successMsg }: { status: Status; error: string; successMsg: string }) => (
    <>
      {status === 'error' && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {status === 'success' && (
        <div className="mb-4 p-3 bg-[#71BF44]/10 border border-[#71BF44]/20 rounded-lg flex items-center gap-3 text-[#71BF44] text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}
    </>
  );

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
      {/* ─── Tab bar ─── */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('zoho')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-all relative
            ${activeTab === 'zoho'
              ? 'text-[#71BF44]'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
        >
          <Globe className="w-4 h-4" />
          Zoho Learn
          {activeTab === 'zoho' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#71BF44] rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('pdf')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-all relative
            ${activeTab === 'pdf'
              ? 'text-[#71BF44]'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
        >
          <FileUp className="w-4 h-4" />
          Subir PDF
          {activeTab === 'pdf' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#71BF44] rounded-t-full" />
          )}
        </button>
      </div>

      {/* ─── Tab content ─── */}
      <div className="p-6">
        {activeTab === 'zoho' ? (
          /* ─── Zoho Learn Form ─── */
          <form onSubmit={handleZohoSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-neutral-400" />
                Links de Zoho Learn
              </label>
              <textarea
                required
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder="https://learn.zohopublic.com/..., https://learn.zohopublic.com/..."
                className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/50 dark:text-white transition-all h-24 resize-none"
              />
              <p className="text-xs text-neutral-500 mt-1.5 ml-1">Separa los links por comas si son varios artículos.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-neutral-400" />
                Correo del responsable
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.correo@satcomla.com"
                className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/50 dark:text-white transition-all"
              />
            </div>

            <div className="pt-2">
              <StatusBanner status={zohoStatus} error={zohoError} successMsg="La ingesta se ha iniciado correctamente." />
              <button
                type="submit"
                disabled={zohoStatus === 'loading'}
                className="w-full bg-[#71BF44] hover:bg-[#60A339] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(113,191,68,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {zohoStatus === 'loading' ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Enviando a SARA...</>
                ) : (
                  <>Iniciar Ingesta <Send className="w-4 h-4 ml-1" /></>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* ─── PDF Upload Form ─── */
          <form onSubmit={handlePdfSubmit} className="space-y-5">
            {/* Drop zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !file && inputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200
                ${dragActive
                  ? 'border-[#71BF44] bg-[#71BF44]/10'
                  : file
                    ? 'border-[#71BF44]/40 bg-[#71BF44]/5'
                    : 'border-neutral-300 dark:border-neutral-700 hover:border-[#71BF44]/50 hover:bg-neutral-50 dark:hover:bg-neutral-900'
                }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-semibold dark:text-white truncate">{file.name}</p>
                      <p className="text-xs text-neutral-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFile(); }}
                    className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4 text-neutral-500" />
                  </button>
                </div>
              ) : (
                <div className="py-2">
                  <div className="w-12 h-12 rounded-full bg-[#71BF44]/10 flex items-center justify-center mx-auto mb-3">
                    <Upload className={`w-6 h-6 ${dragActive ? 'text-[#71BF44]' : 'text-neutral-400'} transition-colors`} />
                  </div>
                  <p className="text-sm font-medium dark:text-neutral-300 mb-1">
                    {dragActive ? 'Suelta el archivo aquí' : 'Arrastra un PDF o haz clic para seleccionar'}
                  </p>
                  <p className="text-xs text-neutral-500">Solo archivos .pdf</p>
                </div>
              )}
            </div>

            {/* Manual Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
                  <BookMarked className="w-4 h-4 text-neutral-400" />
                  Manual
                </label>
                <select
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/50 dark:text-white transition-all appearance-none cursor-pointer"
                >
                  {MANUAL_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="custom">+ Agregar más...</option>
                </select>
              </div>

              {manual === 'custom' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-[#71BF44]" />
                    Nombre del nuevo manual
                  </label>
                  <input
                    type="text"
                    required
                    value={customManual}
                    onChange={(e) => setCustomManual(e.target.value)}
                    placeholder="Eje: Manual de Logística"
                    className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/50 dark:text-white transition-all"
                  />
                </div>
              )}
            </div>

            {/* Article Name field */}
            <div className="relative">
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-neutral-400" />
                  Nombre del artículo
                </span>
                {isFetchingSuggestions && (
                  <span className="text-[10px] text-[#71BF44] animate-pulse">Sincronizando sugerencias...</span>
                )}
              </label>
              <div className="group relative">
                <input
                  type="text"
                  required
                  value={articuloName}
                  onChange={(e) => handleArticuloChange(e.target.value)}
                  onFocus={() => articuloName.length > 1 && filteredSuggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Ej: Guía de instalación rápida"
                  className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/50 dark:text-white transition-all pl-10"
                />
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-[#71BF44] transition-colors" />
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && (
                <div 
                  ref={suggestionRef}
                  className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                >
                  <div className="p-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-[#131313]">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-2">Artículos Sugeridos</p>
                  </div>
                  <div className="max-h-60 overflow-y-auto cursor-pointer">
                    {filteredSuggestions.map((item, idx) => (
                      <div
                        key={`${item.articulo}-${idx}`}
                        onClick={() => selectSuggestion(item)}
                        className="px-4 py-3 hover:bg-[#71BF44]/5 dark:hover:bg-[#71BF44]/10 transition-colors flex flex-col gap-0.5 border-b border-neutral-50 dark:border-neutral-800 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-[#71BF44]" />
                          <span className="text-sm font-medium dark:text-neutral-200">{item.articulo}</span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-5">
                          <BookMarked className="w-3 h-3 text-neutral-400" />
                          <span className="text-[11px] text-neutral-500 font-medium">Manual: {item.manual}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-2 bg-neutral-50 dark:bg-[#131313] text-center">
                    <p className="text-[9px] text-neutral-400">Selecciona para autocompletar artículo y manual</p>
                  </div>
                </div>
              )}
            </div>

            {/* Email field */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-neutral-400" />
                Correo del responsable
              </label>
              <input
                type="email"
                required
                value={pdfUser}
                onChange={(e) => setPdfUser(e.target.value)}
                placeholder="tu.correo@satcomla.com"
                className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/50 dark:text-white transition-all"
              />
            </div>

            <div className="pt-2">
              <StatusBanner status={pdfStatus} error={pdfError} successMsg="El PDF se ha enviado correctamente a SARA para procesamiento." />
              <button
                type="submit"
                disabled={pdfStatus === 'loading' || !file || !pdfUser.trim()}
                className="w-full bg-[#71BF44] hover:bg-[#60A339] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(113,191,68,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pdfStatus === 'loading' ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Subiendo a SARA...</>
                ) : (
                  <>Subir PDF <Upload className="w-4 h-4 ml-1" /></>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
