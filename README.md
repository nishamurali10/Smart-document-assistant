# 📄 Smart Document Assistant

An AI-powered document assistant that enables users to upload PDF documents, generate summaries, ask questions from document content, and manage personalized chat history through a secure authenticated system.

---

## 📌 Project Overview

Smart Document Assistant is a full-stack AI-powered web application designed to simplify document understanding and interaction.

The application allows users to:

- Upload PDF documents
- Generate AI-based summaries
- Ask questions from document content
- View and manage previous chat history
- Export summaries and conversations

The project combines NLP models, intelligent context retrieval, and full-stack web development to create an intelligent document interaction platform.

---

## ✨ Features

### 🔐 Authentication System

- User Signup & Login
- JWT Authentication
- Protected Routes
- Password Hashing using bcrypt

### 📄 PDF Processing

- PDF Upload Support
- Text Extraction
- Multi-length Summarization
- Context-aware Question Answering

### 💬 Chat Interface

- ChatGPT-style UI
- Real-time AI Responses
- Chat History Management
- Delete & Reopen Conversations
- New Chat Functionality

### 📤 Export Functionality

- Export Summary as PDF
- Export History as TXT/PDF

---

## 🧠 AI & NLP Features

### Summarization Models

- Pegasus
- BART

### Embedding Model

- all-MiniLM-L6-v2

### NLP Capabilities

- AI Summarization
- Intelligent Context Retrieval
- Context-aware Responses
- PDF Question Answering

---

## 🛠️ Technology Stack

| Category | Technology |
|----------|------------|
| Frontend | React.js |
| Backend | FastAPI |
| Language | Python, JavaScript |
| Styling | Tailwind CSS |
| Authentication | JWT |
| Database | SQLite |
| ORM | SQLAlchemy |
| NLP | Hugging Face Transformers |
| Embeddings | Sentence Transformers |
| Server | Uvicorn |

---

## 🔄 Project Workflow

1. User signs up and logs in
2. JWT token is generated
3. User uploads PDF document
4. Backend extracts document text
5. AI generates summary or answers
6. Interaction is saved to database
7. Frontend displays AI response
8. User can revisit previous chats

---

## 📂 Project Structure

```text
smart-document-assistant/
│
├── backend/
│   ├── auth/
│   ├── db/
│   ├── routers/
│   ├── utils/
│   ├── crud.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   └── __init__.py
│
├── pdf-frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── services/
├── data/
├── main.py
├── requirements.txt
├── README.md
└── .gitignore
```

---

## 🚀 How to Run the Project

### 1️⃣ Install Backend Dependencies

```bash
pip install -r requirements.txt
```

### 2️⃣ Configure Environment Variables

Create a `.env` file in the project root:

```env
SECRET_KEY=YOUR_SECRET_KEY
```

### 3️⃣ Run Backend Server

```bash
uvicorn main:app --reload
```

### 4️⃣ Run Frontend

```bash
cd pdf-frontend
npm install
npm run dev
```

---

## 📊 Implemented Functionalities

- AI-based PDF Summarization
- PDF Question Answering
- Intelligent Context Retrieval
- Authentication System
- Chat History Management
- Export Features
- Full-Stack Integration

---
