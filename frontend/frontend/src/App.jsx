
import { useEffect, useState } from "react";
import "./App.css";

const STORAGE_KEY = "ai-assistant-conversations";

function createChat() {
  return {
    id: Date.now() + Math.random(),
    title: "New chat",
    messages: [],
  };
}

export default function App() {
  const [chats, setChats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [createChat()];
    } catch {
      return [createChat()];
    }
  });

  const [activeId, setActiveId] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      return saved[0]?.id ?? null;
    } catch {
      return null;
    }
  });

  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("Professional");
  const [loading, setLoading] = useState(false);

  const activeChat =
    chats.find((chat) => chat.id === activeId) || chats[0];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (!activeChat && chats.length) setActiveId(chats[0].id);
  }, [activeChat, chats]);

  function updateMessages(chatId, updater) {
    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? { ...chat, messages: updater(chat.messages) }
          : chat
      )
    );
  }

  function newChat() {
    const chat = createChat();
    setChats((previous) => [chat, ...previous]);
    setActiveId(chat.id);
    setPrompt("");
  }

  async function sendMessage(event) {
    event.preventDefault();

    if (!prompt.trim() || loading || !activeChat) return;

    const question = prompt.trim();
    const chatId = activeChat.id;
    setPrompt("");
    setLoading(true);

    updateMessages(chatId, (previous) => [
      ...previous,
      { role: "user", content: question },
    ]);

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId && chat.title === "New chat"
          ? { ...chat, title: question.slice(0, 30) }
          : chat
      )
    );

    try {
      const response = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: question, tone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      const answer = data.reply || "No response received.";

      // Simulate character-by-character streaming for the demo.
      updateMessages(chatId, (previous) => [
        ...previous,
        { role: "assistant", content: "" },
      ]);

      for (let i = 1; i <= answer.length; i++) {
        updateMessages(chatId, (previous) => {
          const copy = [...previous];
          const last = copy.length - 1;

          if (copy[last]?.role === "assistant") {
            copy[last] = {
              ...copy[last],
              content: answer.slice(0, i),
            };
          }

          return copy;
        });

        await new Promise((resolve) => setTimeout(resolve, 8));
      }
    } catch (error) {
      console.error(error);

      updateMessages(chatId, (previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "Unable to connect to the backend. Check that the server is running.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function exportChat() {
    if (!activeChat) return;

    const content = activeChat.messages
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n\n");

    const file = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download = "conversation.txt";
    link.click();

    URL.revokeObjectURL(url);
  }

  async function copyMessage(content) {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error("Could not copy message", error);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>✦ AI Assistant</h2>

        <button onClick={newChat}>＋ New Chat</button>

        <p className="muted">CHAT HISTORY</p>

        <div className="history-list">
          {chats.map((chat) => (
            <button
              key={chat.id}
              className={`history-item ${
                chat.id === activeChat?.id ? "selected" : ""
              }`}
              onClick={() => setActiveId(chat.id)}
              disabled={loading}
            >
              {chat.title}
            </button>
          ))}
        </div>

        <p className="sidebar-note">Your chats are saved in this browser.</p>
      </aside>

      <main className="main">
        <header>
          <h2>AI Chat Assistant</h2>

          <div className="header-actions">
            <button onClick={exportChat}>Export chat</button>

            <label>
              Tone{" "}
              <select
                value={tone}
                onChange={(event) => setTone(event.target.value)}
              >
                <option>Professional</option>
                <option>Casual</option>
                <option>Concise</option>
              </select>
            </label>
          </div>
        </header>

        <section className="messages">
          {!activeChat?.messages.length && (
            <div className="welcome">
              <h1>How can I help you today?</h1>
              <p>Start a conversation with your assistant.</p>
            </div>
          )}

          {activeChat?.messages.map((message, index) => (
            <div
              className={`message ${message.role}`}
              key={`${activeChat.id}-${index}`}
            >
              <strong>
                {message.role === "user" ? "You" : "AI Assistant"}
              </strong>

              <p>{message.content}</p>

              {message.role === "assistant" && message.content && (
                <button
                  className="copy-button"
                  onClick={() => copyMessage(message.content)}
                >
                  Copy response
                </button>
              )}
            </div>
          ))}

          {loading && (
            <p className="muted">Preparing response...</p>
          )}
        </section>

        <form className="composer" onSubmit={sendMessage}>
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Message the AI assistant..."
            aria-label="Message"
          />

          <button disabled={loading || !prompt.trim()}>
            {loading ? "..." : "Send ↑"}
          </button>
        </form>

        <p className="footer">
          Demo mode · Responses are predefined, not real AI-generated answers.
        </p>
      </main>
    </div>
  );
}
