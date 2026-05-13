import React, { useState, useRef, useEffect } from 'react';
import { Upload, Send, Loader, AlertCircle, FileText, Download, Sparkles, MessageCircle, Zap, User, Bot, LogOut, Menu, X, History, Trash2, Plus, Eye, EyeOff } from 'lucide-react';

// jsPDF implementation
const jsPDF = (() => {
  class PDFDocument {
    constructor() {
      this.content = [];
      this.pageHeight = 280;
      this.currentY = 20;
    }

    setFontSize(size) {
      this.fontSize = size;
    }

    setFont(family, weight) {
      this.fontFamily = family;
      this.fontWeight = weight;
    }

    text(text, x, y) {
      this.content.push({ type: 'text', text, x, y, fontSize: this.fontSize, fontWeight: this.fontWeight });
      this.currentY = Math.max(this.currentY, y);
    }

    splitTextToSize(text, maxWidth) {
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';

      words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        if (testLine.length * 3 < maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });

      if (currentLine) lines.push(currentLine);
      return lines;
    }

    addPage() {
      this.content.push({ type: 'pageBreak' });
      this.currentY = 20;
    }

    save(filename) {
      let textContent = '';
      this.content.forEach(item => {
        if (item.type === 'text') {
          if (item.fontWeight === 'bold') {
            textContent += item.text.toUpperCase() + '\n';
          } else {
            textContent += item.text + '\n';
          }
        } else if (item.type === 'pageBreak') {
          textContent += '\n' + '='.repeat(50) + '\n\n';
        }
      });

      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename.replace('.pdf', '.txt');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }

    get internal() {
      return { pageSize: { height: this.pageHeight } };
    }
  }

  return PDFDocument;
})();

const SmartDocumentAssistant = () => {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('signin');
  const [authForm, setAuthForm] = useState({ email: '', password: '', confirmPassword: '', name: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Chat history state
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // Existing state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [documentAnalyzed, setDocumentAnalyzed] = useState(false);
  const [awaitingSummaryLength, setAwaitingSummaryLength] = useState(false);
  const [summaryParams, setSummaryParams] = useState({ message: '', model: 'auto' });

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const BASE_URL = 'http://localhost:8000';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auth functions
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const endpoint = authMode === 'signin' ? '/auth/login' : '/auth/register';
      
      let payload, headers;
      
      if (authMode === 'signin') {
        payload = new URLSearchParams({
          username: authForm.email,
          password: authForm.password
        });
        headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      } else {
        payload = JSON.stringify({
          email: authForm.email,
          password: authForm.password,
          name: authForm.name
        });
        headers = { 'Content-Type': 'application/json' };
      }

      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: payload
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Authentication failed');
      }

      const token = data.access_token || data.token || data.jwt;
      const user = data.user || { name: authForm.name, email: authForm.email };
      
      if (!token) {
        throw new Error('No authentication token received');
      }
      
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_data', JSON.stringify(user));
      
      setIsAuthenticated(true);
      setCurrentUser(user);
      setAuthForm({ email: '', password: '', confirmPassword: '', name: '' });
      
      loadChatHistory();

    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setChatHistory([]);
    setMessages([]);
    setUploadedFile(null);
    setCurrentChatId(null);
  };

  // Backend chat history integration
  const loadChatHistory = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`${BASE_URL}/history/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 401) handleLogout();
        return;
      }
      
      const data = await response.json();
      console.log('Fetched data:', data);
      
      const interactions = data.history || [];
      console.log('Interactions count:', interactions.length);
      
      // Group interactions into chats
      const groupedChats = interactions.map((interaction) => {
        const chat = {
          id: interaction.id,
          title: `${interaction.type === 'qa' ? 'Q&A' : 'Summary'} - ${new Date(interaction.created_at).toLocaleDateString()}`,
          document_name: interaction.query || 'Interaction',
          created_at: interaction.created_at,
          type: interaction.type,
          messages: [
            interaction.query ? {
              id: `${interaction.id}_q`,
              content: interaction.query,
              isUser: true,
              isSystem: false,
              timestamp: new Date(interaction.created_at)
            } : null,
            interaction.answer ? {
              id: `${interaction.id}_a`,
              content: interaction.answer,
              isUser: false,
              isSystem: false,
              timestamp: new Date(interaction.created_at)
            } : null
          ].filter(Boolean)
        };
        return chat;
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      console.log('Grouped chats:', groupedChats);
      console.log('Setting chat history with', groupedChats.length, 'chats');
      
      setChatHistory([...groupedChats]); // Force new array reference
      
      // Verify state update
      setTimeout(() => {
        console.log('Chat history state after update:', chatHistory);
      }, 100);
      
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const loadChatFromHistory = (chat) => {
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
    setUploadedFile({ name: chat.document_name });
    setDocumentAnalyzed(true);
    setShowHistory(false);
  };

  const deleteChatFromHistory = (chatId) => {
    setChatHistory(prev => prev.filter(chat => chat.id !== chatId));
    if (currentChatId === chatId) {
      setMessages([]);
      setCurrentChatId(null);
      setUploadedFile(null);
      setDocumentAnalyzed(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setUploadedFile(null);
    setDocumentAnalyzed(false);
    setCurrentChatId(null);
    setError('');
    setShowHistory(false);
  };

  const addMessage = (message, isUser = false, isSystem = false) => {
    const newMessage = {
      id: Date.now(),
      content: message || '',
      isUser,
      isSystem,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const getSmartSuggestions = (filename) => {
    const suggestions = [
      "📝 Give me a summary of this document",
      "🎯 What are the key takeaways?",
      "❓ What questions should I ask about this?",
      "📊 What are the main findings?",
    ];
    
    if (filename?.toLowerCase().includes('research')) {
      suggestions.unshift("🔬 What's the research methodology?", "📈 What are the results?");
    } else if (filename?.toLowerCase().includes('report')) {
      suggestions.unshift("📋 What are the recommendations?", "⚠️ Are there any risks mentioned?");
    }
    
    return suggestions.slice(0, 4);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!['application/pdf'].includes(file.type)) {
        setError('Please upload a PDF file only.');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB.');
        return;
      }
      
      setError('');
      setUploadedFile(file);
      setMessages([]);
      setCurrentChatId(null);
      
      addMessage(`Great! I've received "${file.name}". I'm analyzing it now...`, false, true);
      
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setDocumentAnalyzed(true);
        addMessage(`✅ Perfect! I've analyzed your document and I'm ready to help. What would you like to know?`, false, true);
      }, 2000);
    }
  };

  const processMessage = async (message) => {
    if (!uploadedFile) {
      addMessage("Please upload a PDF document first, and I'll help you analyze it!", false, true);
      return;
    }

    addMessage(message, true);
    setCurrentMessage('');
    
    const intent = detectIntent(message);

    if (intent === 'summary') {
      setAwaitingSummaryLength(true);
      setSummaryParams({ message, model: 'auto' });
    } else {
      setIsLoading(true);
      try {
        await handleQuestionRequest(message);
      } catch (err) {
        addMessage(`Sorry, I encountered an error: ${err.message}`, false, true);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const detectIntent = (message) => {
    const summaryKeywords = ['summary', 'summarize', 'overview', 'main points', 'key points', 'gist', 'brief'];
    const lowerMessage = message.toLowerCase();
    return summaryKeywords.some(keyword => lowerMessage.includes(keyword)) ? 'summary' : 'question';
  };

  const handleSummaryLengthSelection = async (length) => {
    setAwaitingSummaryLength(false);
    setIsLoading(true);

    const token = localStorage.getItem('auth_token');
    if (!token) {
      addMessage("Authentication required. Please sign in again.", false, true);
      handleLogout();
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadedFile);

    const params = new URLSearchParams({
      length,
      model: summaryParams.model,
      per_page: 'false',
      download: 'false'
    });

    try {
      const response = await fetch(`${BASE_URL}/summarize/pdf?${params}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (response.status === 401) {
        addMessage("Session expired. Please sign in again.", false, true);
        handleLogout();
        return;
      }

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const responseText = await response.text();
      let result;
      
      try {
        result = JSON.parse(responseText);
      } catch {
        addMessage(responseText, false, false);
        return;
      }

      // Extract summary from nested structure
      let summaryText = result.overall_summary || 
                       result.result?.overall_summary ||
                       result.summary || 
                       result.text;

      if (!summaryText) {
        addMessage("Sorry, couldn't extract summary from response.", false, true);
        return;
      }

      let responseMessage = `Here's what I found in your document:\n\n${summaryText}`;
      const pageCount = result.pages_summarized || result.result?.pages_summarized;
      if (pageCount && pageCount > 1) {
        responseMessage += `\n\n📄 I analyzed ${pageCount} pages to create this summary.`;
      }

      addMessage(responseMessage, false, false);

      setTimeout(() => {
        addMessage("Would you like me to dive deeper into any specific section, or do you have other questions?", false, true);
        loadChatHistory();
      }, 1000);

    } catch (err) {
      addMessage(`Sorry, I encountered an error: ${err.message}`, false, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionRequest = async (message) => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      addMessage("Authentication required. Please sign in again.", false, true);
      handleLogout();
      return;
    }
    
    const formData = new FormData();
    formData.append('file', uploadedFile);
    formData.append('question', message);
    formData.append('download_pdf', 'false');

    const response = await fetch(`${BASE_URL}/qa/ask`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (response.status === 401) {
      addMessage("Session expired. Please sign in again.", false, true);
      handleLogout();
      return;
    }

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();
    const answerText = result.answer || result.response || result.text;

    if (!answerText) {
      addMessage("Sorry, couldn't find an answer.", false, true);
      return;
    }

    addMessage(answerText, false, false);
    setTimeout(() => loadChatHistory(), 1000);
  };

  const handleSuggestionClick = (suggestion) => {
    const cleanSuggestion = suggestion.replace(/^[^\w]+/, '');
    setCurrentMessage(cleanSuggestion);
    processMessage(cleanSuggestion);
  };

  const downloadChat = () => {
    if (messages.length === 0) return;

    try {
      const doc = new jsPDF();
      let yPosition = 20;
      const pageHeight = doc.internal.pageSize.height;
      const marginLeft = 15;
      const maxWidth = 180;
      const lineHeight = 7;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Chat: ${uploadedFile?.name || 'Document Conversation'}`, marginLeft, yPosition);
      
      yPosition += 15;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on: ${new Date().toLocaleString()}`, marginLeft, yPosition);
      yPosition += 15;

      messages
        .filter(msg => !msg.isSystem)
        .forEach((message) => {
          const sender = message.isUser ? 'YOU' : 'AI ASSISTANT';
          const timestamp = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(`${sender} [${timestamp}]`, marginLeft, yPosition);
          yPosition += lineHeight + 2;

          doc.setFont('helvetica', 'normal');
          const lines = doc.splitTextToSize(message.content, maxWidth);
          
          lines.forEach((line) => {
            if (yPosition > pageHeight - 20) {
              doc.addPage();
              yPosition = 20;
            }
            doc.text(line, marginLeft + 5, yPosition);
            yPosition += lineHeight;
          });
          
          yPosition += 8;
        });

      doc.save(`chat-${uploadedFile?.name?.replace('.pdf', '') || 'conversation'}.pdf`);

    } catch (error) {
      console.error('Error downloading chat:', error);
      setError('Failed to download chat. Please try again.');
    }
  };

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user_data');
    
    if (token && user) {
      try {
        setIsAuthenticated(true);
        setCurrentUser(JSON.parse(user));
        loadChatHistory();
      } catch (e) {
        localStorage.clear();
      }
    }
  }, []);

  // Reload history when sidebar opens
  useEffect(() => {
    if (showHistory && isAuthenticated) {
      loadChatHistory();
    }
  }, [showHistory]);

  // Auth UI
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Smart Document Assistant</h1>
            <p className="text-gray-600">
              {authMode === 'signin' ? 'Sign in to your account' : 'Create your account'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={authForm.name}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={authForm.email}
                onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={authForm.password}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-red-700 text-sm">{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50"
            >
              {authLoading ? (
                <div className="flex items-center justify-center">
                  <Loader className="w-5 h-5 animate-spin mr-2" />
                  {authMode === 'signin' ? 'Signing In...' : 'Creating Account...'}
                </div>
              ) : (
                authMode === 'signin' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                setAuthError('');
                setAuthForm({ email: '', password: '', confirmPassword: '', name: '' });
              }}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              {authMode === 'signin' 
                ? "Don't have an account? Sign up" 
                : "Already have an account? Sign in"
              }
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main app UI
  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`${showHistory ? 'w-80' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 overflow-hidden flex flex-col`}>
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-gray-900">History</h2>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={loadChatHistory}
                className="p-2 hover:bg-white rounded-lg transition-colors text-gray-600 hover:text-blue-600"
                title="Refresh history"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button 
                onClick={() => setShowHistory(false)} 
                className="p-2 hover:bg-white rounded-lg transition-colors text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button
            onClick={startNewChat}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2.5 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-[1.02] flex items-center justify-center font-medium shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {chatHistory.length > 0 ? (
            <>
              <div className="flex items-center justify-between px-2 py-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {chatHistory.length} Conversation{chatHistory.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => {
                    if (window.confirm('Clear all chat history from view?')) {
                      setChatHistory([]);
                    }
                  }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Clear All
                </button>
              </div>
              
              {chatHistory.map((chat, index) => {
                const isToday = new Date(chat.created_at).toDateString() === new Date().toDateString();
                const isYesterday = new Date(chat.created_at).toDateString() === new Date(Date.now() - 86400000).toDateString();
                
                let dateLabel = new Date(chat.created_at).toLocaleDateString();
                if (isToday) dateLabel = 'Today';
                if (isYesterday) dateLabel = 'Yesterday';
                
                return (
                  <div key={chat.id}>
                    {(index === 0 || new Date(chatHistory[index - 1].created_at).toDateString() !== new Date(chat.created_at).toDateString()) && (
                      <div className="px-2 py-2 mt-2">
                        <p className="text-xs font-semibold text-gray-400">{dateLabel}</p>
                      </div>
                    )}
                    
                    <div
                      className={`group p-3 rounded-lg border cursor-pointer transition-all ${
                        currentChatId === chat.id 
                          ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 shadow-sm' 
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div onClick={() => loadChatFromHistory(chat)} className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            {chat.type === 'qa' ? (
                              <MessageCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                            )}
                            <p className="text-xs font-medium text-gray-500">
                              {chat.type === 'qa' ? 'Q&A' : 'Summary'}
                            </p>
                          </div>
                          <p className="text-sm font-medium text-gray-900 truncate mb-1">
                            {chat.document_name.length > 40 
                              ? chat.document_name.substring(0, 40) + '...' 
                              : chat.document_name}
                          </p>
                          <div className="flex items-center space-x-2 text-xs text-gray-400">
                            <span>{new Date(chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span>{chat.messages?.length || 0} msg</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this conversation?')) {
                              deleteChatFromHistory(chat.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all ml-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <History className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">No conversations yet</p>
              <p className="text-xs text-gray-500 text-center">
                Your chat history will appear here after you start chatting with documents
              </p>
            </div>
          )}
        </div>
        
        {chatHistory.length > 0 && (
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Total interactions</span>
              <span className="font-semibold text-gray-700">{chatHistory.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button onClick={() => setShowHistory(!showHistory)} className="p-2 hover:bg-gray-100 rounded-lg">
                <Menu className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Smart Document Assistant</h1>
                <p className="text-sm text-gray-600">
                  {uploadedFile ? `Chatting about: ${uploadedFile.name}` : `Welcome${currentUser?.name ? `, ${currentUser.name}` : ''}!`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {messages.length > 0 && (
                <button
                  onClick={downloadChat}
                  className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Chat
                </button>
              )}
              <input ref={fileInputRef} type="file" onChange={handleFileUpload} accept=".pdf" className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadedFile ? 'New Document' : 'Upload PDF'}
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col">
          {!uploadedFile ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-2xl">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Welcome back{currentUser?.name ? `, ${currentUser.name}` : ''}!
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  Upload a PDF and start a conversation. Ask questions, get summaries, or explore your document in a natural, chat-like way.
                </p>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105"
                >
                  <Upload className="w-5 h-5 mr-3" />
                  Upload Your Document
                </button>
                
                <div className="mt-12 grid md:grid-cols-3 gap-6 text-left">
                  <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                      <Zap className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Instant Understanding</h3>
                    <p className="text-gray-600 text-sm">Get summaries and answers in seconds, not hours of reading.</p>
                  </div>
                  <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                      <MessageCircle className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Natural Conversation</h3>
                    <p className="text-gray-600 text-sm">Ask questions in plain English, just like talking to a colleague.</p>
                  </div>
                  <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                      <History className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Chat History</h3>
                    <p className="text-gray-600 text-sm">Access all your previous conversations and insights.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-3xl rounded-2xl px-4 py-3 ${
                      message.isUser
                        ? 'bg-blue-600 text-white'
                        : message.isSystem
                        ? 'bg-gray-100 text-gray-700 border border-gray-200'
                        : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
                    }`}>
                      <div className="flex items-start space-x-3">
                        {!message.isUser && (
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            message.isSystem ? 'bg-gray-300' : 'bg-gradient-to-br from-blue-500 to-purple-600'
                          }`}>
                            {message.isSystem ? (
                              <Sparkles className="w-4 h-4 text-gray-600" />
                            ) : (
                              <Bot className="w-4 h-4 text-white" />
                            )}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
                          <p className="text-xs opacity-60 mt-2">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {message.isUser && (
                          <div className="w-6 h-6 bg-blue-800 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <User className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Loader className="w-4 h-4 animate-spin text-gray-500" />
                          <span className="text-gray-500">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {awaitingSummaryLength && (
                <div className="p-4 bg-gray-100 flex space-x-2">
                  {[
                    { label: 'Short', value: 'short' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'Long', value: 'long' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleSummaryLengthSelection(option.value)}
                      className="bg-white px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-200"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {documentAnalyzed && messages.length < 3 && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-600 mb-3">Try asking:</p>
                  <div className="flex flex-wrap gap-2">
                    {getSmartSuggestions(uploadedFile.name).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="bg-white hover:bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-700 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-6 border-t border-gray-200 bg-white">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isLoading && processMessage(currentMessage)}
                    placeholder="Ask me anything about your document..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => processMessage(currentMessage)}
                    disabled={!currentMessage.trim() || isLoading}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartDocumentAssistant;