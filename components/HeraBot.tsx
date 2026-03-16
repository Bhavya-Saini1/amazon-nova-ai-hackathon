'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface HeraBotProps {
  onFocusMap: (lat: number, lng: number) => void;
  onFilter: (category: string) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function HeraBot({ onFocusMap, onFilter }: HeraBotProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const appendToLastAssistant = useCallback((chunk: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
      }
      return [...prev, { role: 'assistant', content: chunk }];
    });
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok || !res.body) {
        appendToLastAssistant('Sorry, something went wrong. Please try again.');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let currentToolName = '';
      let toolInputBuffer = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
            continue;
          }

          if (line.startsWith('data: ')) {
            const raw = line.slice(6);
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(raw);
            } catch {
              continue;
            }

            switch (eventType) {
              case 'text_delta':
                if (typeof data.text === 'string') {
                  appendToLastAssistant(data.text);
                }
                break;

              case 'tool_use_start':
                currentToolName = (data.name as string) ?? '';
                toolInputBuffer = '';
                break;

              case 'tool_use_delta':
                if (typeof data.input === 'string') {
                  toolInputBuffer += data.input;
                }
                break;

              case 'content_block_stop':
                if (currentToolName) {
                  try {
                    const args = JSON.parse(toolInputBuffer);
                    if (
                      currentToolName === 'focus_map' &&
                      typeof args.latitude === 'number' &&
                      typeof args.longitude === 'number'
                    ) {
                      onFocusMap(args.latitude, args.longitude);
                      appendToLastAssistant(
                        `\n_Panning map to ${args.latitude.toFixed(4)}, ${args.longitude.toFixed(4)}_\n`
                      );
                    } else if (
                      currentToolName === 'filter_incidents' &&
                      typeof args.category === 'string'
                    ) {
                      onFilter(args.category);
                      appendToLastAssistant(
                        `\n_Filtering incidents: ${args.category}_\n`
                      );
                    }
                  } catch {
                    /* malformed tool JSON — skip */
                  }
                  currentToolName = '';
                  toolInputBuffer = '';
                }
                break;

              case 'error':
                appendToLastAssistant(
                  '\nAn error occurred while processing your request.'
                );
                break;
            }

            eventType = '';
          }
        }
      }
    } catch {
      appendToLastAssistant('Network error — could not reach the server.');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, appendToLastAssistant, onFocusMap, onFilter]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#7b60b4] to-[#e795a7] text-white shadow-lg shadow-purple-900/40 transition-transform hover:scale-105 active:scale-95"
        aria-label={open ? 'Close HeraBot' : 'Open HeraBot'}
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1a1b2e]/95 shadow-2xl shadow-purple-950/50 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-white/10 bg-[#1e1f35]/80 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#7b60b4] to-[#e795a7] text-xs font-bold text-white">
              H
            </div>
            <div>
              <p className="text-sm font-semibold text-white">HeraBot</p>
              <p className="text-[11px] text-[#a89cc8]">Safety &amp; navigation assistant</p>
            </div>
            <div className="ml-auto flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 scrollbar-thin">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-[#c4b5e0]">Hi, I&apos;m HeraBot</p>
                <p className="mt-1 text-xs text-[#8a7da8]">
                  Ask me about safety incidents or tell me a location to explore on the map.
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'ml-auto bg-gradient-to-r from-[#7b60b4] to-[#6a50a0] text-white'
                    : 'mr-auto border border-white/5 bg-[#252640] text-[#e8e0f5]'
                }`}
              >
                {msg.content}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="mr-auto flex items-center gap-1.5 rounded-2xl border border-white/5 bg-[#252640] px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b79bff] [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b79bff] [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b79bff] [animation-delay:300ms]" />
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-white/10 bg-[#1e1f35]/80 px-3 py-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about safety or a location..."
              disabled={isLoading}
              className="flex-1 rounded-xl border border-white/10 bg-[#252640] px-3.5 py-2.5 text-sm text-white placeholder-[#7a6f98] outline-none transition focus:border-[#7b60b4] focus:ring-1 focus:ring-[#7b60b4] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#7b60b4] to-[#e795a7] text-white shadow-md shadow-purple-900/30 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
