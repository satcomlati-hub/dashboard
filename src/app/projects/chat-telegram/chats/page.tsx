'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// Agente SARA Público — Asistente de Clientes (RAG). El bot @Satcomla_bot está
// conectado directo a este agente vía agentes-api (canal en ag_channels).
const SARA_PUBLICO_AGENT_ID = '2be1c249-6cd6-481b-9d9a-aaddab0edb22';

interface Chat {
  chat_id: string;
  nombre: string;
  correo?: string;
  empresa?: string;
  last_activity?: string;
  paused?: boolean;
  [key: string]: any;
}

interface Message {
  rol: string;
  texto: string;
  fecha: string;
  [key: string]: any;
}

export default function ChatsPage() {
  return (
    <Suspense fallback={
      <div className="h-[calc(100vh-140px)] flex flex-col items-center justify-center text-neutral-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#71BF44] mb-4"></div>
        Cargando portal de chats...
      </div>
    }>
      <ChatsContent />
    </Suspense>
  );
}

function ChatsContent() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const searchParams = useSearchParams();
  const chatIdFromUrl = searchParams.get('chatId') || searchParams.get('IdChat');

  // Estado de pausa (handoff) del chat seleccionado, derivado de la lista.
  const selectedInList = chats.find(c => String(c.chat_id) === String(selectedChat?.chat_id));
  const isPaused = !!(selectedInList?.paused ?? selectedChat?.paused);

  useEffect(() => {
    fetchChats();
    resolveChannel();
  }, []);

  // Resuelve el canal de Telegram de SARA Público (para enviar/reanudar como bot).
  const resolveChannel = async () => {
    try {
      const res = await fetch('/api/agentes/v1/channels');
      const data = await res.json();
      if (Array.isArray(data)) {
        const ch = data.find(
          (c: any) => c.type === 'telegram' && c.agent_id === SARA_PUBLICO_AGENT_ID,
        ) || data.find((c: any) => c.type === 'telegram');
        if (ch) setChannelId(ch.id);
      }
    } catch (error) {
      console.error('Error resolving channel:', error);
    }
  };

  // Auto-select chat from URL parameter
  useEffect(() => {
    if (chats.length > 0 && chatIdFromUrl && !selectedChat) {
      const chatToSelect = chats.find(c => String(c.chat_id) === String(chatIdFromUrl));
      if (chatToSelect) {
        setSelectedChat(chatToSelect);
      }
    }
  }, [chats, chatIdFromUrl, selectedChat]);

  useEffect(() => {
    if (selectedChat) {
      setLoading(false);
      setHistory([]); // Clean previous history immediately
      setHistoryLoading(true); // Show loader for the new chat
      fetchHistory(selectedChat.chat_id);
    }
  }, [selectedChat]);

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Polling ligero: refresca el historial del chat abierto cada 5s y la lista cada 20s.
  useEffect(() => {
    if (!selectedChat) return;
    const t = setInterval(() => fetchHistory(selectedChat.chat_id, true), 5000);
    return () => clearInterval(t);
  }, [selectedChat]);

  useEffect(() => {
    const t = setInterval(() => fetchChats(), 20000);
    return () => clearInterval(t);
  }, []);

  const fetchChats = async () => {
    const isFirstLoad = chats.length === 0;
    if (isFirstLoad) setLoading(true);

    try {
      const res = await fetch('/api/db/sara-chats');
      const data = await res.json();
      if (Array.isArray(data)) {
        setChats(data);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      if (isFirstLoad) setLoading(false);
    }
  };

  const fetchHistory = async (chatId: string, isPolling = false) => {
    // Only show loading if we don't have any messages yet (first load of this chat)
    if (!isPolling && history.length === 0) setHistoryLoading(true);

    try {
      const res = await fetch(`/api/db/sara-history?chat_id=${chatId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistory(data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const setPausedLocal = (chatId: string, paused: boolean) => {
    setChats(prev => prev.map(c =>
      String(c.chat_id) === String(chatId) ? { ...c, paused } : c,
    ));
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const isoStr = dateStr.replace(' ', 'T');
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return 'Fecha no disp.';

      const dayMonth = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
      const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${dayMonth} ${time}`;
    } catch (e) {
      return 'Fecha no disp.';
    }
  };

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [resuming, setResuming] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat || !newMessage.trim() || sending) return;
    if (!channelId) {
      alert('No se encontró el canal de Telegram de SARA Público.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/agentes/v1/channels/${channelId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: String(selectedChat.chat_id),
          text: newMessage,
        }),
      });

      if (res.ok) {
        setNewMessage('');
        setPausedLocal(selectedChat.chat_id, true); // al intervenir, el bot queda en pausa
        fetchHistory(selectedChat.chat_id, true);
      } else {
        alert('Error al enviar el mensaje');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleResume = async () => {
    if (!selectedChat || !channelId || resuming) return;
    setResuming(true);
    try {
      const res = await fetch(`/api/agentes/v1/channels/${channelId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: String(selectedChat.chat_id) }),
      });
      if (res.ok) {
        setPausedLocal(selectedChat.chat_id, false);
      } else {
        alert('No se pudo devolver el control al bot');
      }
    } catch (error) {
      console.error('Error resuming bot:', error);
      alert('No se pudo devolver el control al bot');
    } finally {
      setResuming(false);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col pt-4">
      <header className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/projects/chat-telegram" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Chat telegram
          </Link>
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Chats de SARA Público</h2>
        <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">
          Conversaciones del bot <span className="font-medium">@Satcomla_bot</span> con clientes. Puedes intervenir y responder como el bot.
        </p>
      </header>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Chat List */}
        <div className="w-1/3 bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-y-auto shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-neutral-500">Cargando chats...</div>
          ) : chats.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">No se encontraron chats activos.</div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {chats.map((chat) => (
                <button
                  key={chat.chat_id}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${
                    selectedChat?.chat_id === chat.chat_id ? 'bg-[#71BF44]/5 border-l-4 border-l-[#71BF44]' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-neutral-900 dark:text-white uppercase truncate flex items-center gap-1.5">
                      {chat.paused && <span title="Intervención humana activa" className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0"></span>}
                      {chat.nombre}
                    </span>
                    <span className="text-[10px] text-neutral-400 whitespace-nowrap ml-2">
                      {chat.last_activity ? new Date(chat.last_activity.replace(' ', 'T')).toLocaleDateString() : ''}
                    </span>
                  </div>
                  {chat.empresa && (
                    <div className="text-[10px] text-[#71BF44] mb-1 truncate">{chat.empresa}</div>
                  )}
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 italic">
                    {chat.correo || 'Sin correo registrado'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat History */}
        <div className="flex-1 bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col shadow-sm overflow-hidden text-neutral-900 dark:text-white">
          {selectedChat ? (
            <>
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-neutral-900 dark:text-white uppercase truncate">
                    {selectedChat.nombre}
                  </h3>
                  <p className="text-xs text-neutral-500 truncate">ID: {selectedChat.chat_id} • {selectedChat.correo}</p>
                </div>
                {isPaused ? (
                  <button
                    onClick={handleResume}
                    disabled={resuming}
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300 transition-colors disabled:opacity-50"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                    {resuming ? 'Devolviendo…' : 'Devolver al bot'}
                  </button>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] text-neutral-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#71BF44]"></span>
                    Bot activo
                  </span>
                )}
              </div>

              {isPaused && (
                <div className="px-4 py-2 text-xs bg-amber-50 dark:bg-amber-900/15 text-amber-700 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800/40">
                  🔴 Intervención humana activa — SARA no responderá automáticamente a este cliente hasta que pulses «Devolver al bot».
                </div>
              )}

              <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
                {historyLoading ? (
                  <div className="flex-1 flex items-center justify-center text-neutral-500">Cargando historial...</div>
                ) : history.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-neutral-500 italic">No hay mensajes en este chat.</div>
                ) : (
                  history.map((msg, index) => {
                    const isUser = msg.rol === 'Usuario';
                    const isOperator = msg.rol === 'Operador';
                    const isSystem = msg.rol === 'Sistema';

                    if (isSystem) {
                      return (
                        <div key={index} className="self-center max-w-[85%] text-center text-xs italic text-neutral-500 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg px-3 py-1.5">
                          {msg.texto}
                        </div>
                      );
                    }

                    const bubbleClass = isUser
                      ? 'bg-[#71BF44] text-white self-end rounded-tr-none'
                      : isOperator
                        ? 'bg-amber-500 text-white self-start rounded-tl-none'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 self-start rounded-tl-none border border-neutral-200 dark:border-neutral-700';

                    return (
                      <div key={index} className={`max-w-[80%] p-3 rounded-2xl ${bubbleClass}`}>
                        {isOperator && (
                          <div className="text-[10px] font-semibold mb-1 opacity-90 flex items-center gap-1">
                            👤 Operador (como el bot)
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.texto}</p>
                        <div className={`text-[10px] mt-1 opacity-70 ${isUser || isOperator ? 'text-white/80' : 'text-neutral-500'}`}>
                          {formatDateTime(msg.fecha)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={isPaused ? 'Responde como el bot…' : 'Escribe para intervenir (el bot quedará en pausa)…'}
                  className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#71BF44] transition-colors"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="bg-[#71BF44] text-white rounded-lg px-4 py-2 hover:bg-[#62a53b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral-400 flex-col gap-3">
              <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p>Selecciona un chat para ver su historial</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
