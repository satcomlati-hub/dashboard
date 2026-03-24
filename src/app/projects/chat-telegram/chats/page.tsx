'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Chat {
  chat_id: string;
  nombre: string;
  correo?: string;
  empresa?: string;
  last_activity?: string;
  [key: string]: any;
}

interface Message {
  rol: string;
  texto: string;
  created_at: string;
  [key: string]: any;
}

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      fetchHistory(selectedChat.chat_id);
    }
  }, [selectedChat]);

  const fetchChats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/db/chats');
      const data = await res.json();
      if (Array.isArray(data)) {
        setChats(data);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (chatId: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/db/history?chat_id=${chatId}`);
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
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Chats de Telegram</h2>
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
                    <span className="font-bold text-neutral-900 dark:text-white uppercase">
                      {chat.nombre}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {chat.last_activity ? new Date(chat.last_activity).toLocaleDateString() : ''}
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
        <div className="flex-1 bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col shadow-sm overflow-hidden">
          {selectedChat ? (
            <>
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-neutral-900 dark:text-white uppercase">
                    {selectedChat.nombre}
                  </h3>
                  <p className="text-xs text-neutral-500">ID: {selectedChat.chat_id} • {selectedChat.correo}</p>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
                {historyLoading ? (
                  <div className="flex-1 flex items-center justify-center text-neutral-500">Cargando historial...</div>
                ) : history.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-neutral-500 italic">No hay mensajes en este chat.</div>
                ) : (
                  history.map((msg, index) => {
                    const isUser = msg.rol === 'Usuario';
                    return (
                      <div
                        key={index}
                        className={`max-w-[80%] p-3 rounded-2xl ${
                          isUser
                            ? 'bg-[#71BF44] text-white self-end rounded-tr-none'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 self-start rounded-tl-none'
                        }`}
                      >
                        <p className="text-sm">{msg.texto}</p>
                        <div className={`text-[10px] mt-1 opacity-70 ${isUser ? 'text-right' : 'text-left'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
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
