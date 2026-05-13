from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings, HuggingFacePipeline
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from transformers import pipeline
import torch
import tempfile

# Embeddings
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

MAX_MODEL_TOKENS = 512  # Flan-T5 input limit

def process_pdf(file_path: str):
    """Load PDF, split into chunks, and create a FAISS vectorstore."""
    loader = PyPDFLoader(file_path)
    docs = loader.load()

    # Adjust chunk size to avoid token errors
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=350,  # safe for T5 (~512 tokens)
        chunk_overlap=70
    )
    chunks = text_splitter.split_documents(docs)

    vectorstore = FAISS.from_documents(chunks, embeddings)
    return vectorstore

def get_qa_chain(vectorstore, max_new_tokens: int = 256):
    """Return RetrievalQA chain using local flan-t5-large pipeline."""
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

    llm_pipeline = pipeline(
        "text2text-generation",
        model="google/flan-t5-large",
        tokenizer="google/flan-t5-large",
        max_new_tokens=max_new_tokens,
        device=0 if torch.cuda.is_available() else -1
    )

    llm = HuggingFacePipeline(pipeline=llm_pipeline)

    prompt_template = """
You are a Smart Document Assistant. Use ONLY the provided document context to answer the user’s question. 
If the document only partially answers the question, give as much relevant information as possible, 
and clearly state what is missing instead of just saying "not enough information."

Guidelines:
- If the context fully answers, give a complete and detailed answer.
- If the context partially answers, explain what it covers and what it does not.
- If nothing relevant is found, only then say: "The document does not provide information to answer this question."
- Keep answers clear, structured, and human-like.

Context: {context}

Question: {question}

Answer:
"""
    PROMPT = PromptTemplate(
        template=prompt_template,
        input_variables=["context", "question"]
    )

    qa = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=retriever,
        chain_type="stuff",
        chain_type_kwargs={"prompt": PROMPT},
        return_source_documents=True
    )
    return qa

def answer_question(file, question: str, max_new_tokens: int = 256):
    """Process PDF + answer question, return both answer and sources."""
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file.read())
        tmp_path = tmp.name

    # Build vectorstore
    vectorstore = process_pdf(tmp_path)

    # Get QA chain
    qa = get_qa_chain(vectorstore, max_new_tokens=max_new_tokens)

    # Run QA
    result = qa.invoke(question)

    # Extract answer + deduplicate sources
    answer = result["result"]
    sources = list({doc.metadata.get("source", "unknown") for doc in result["source_documents"]})

    return answer, sources
