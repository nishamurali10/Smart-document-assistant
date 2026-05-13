import os
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader

# Define paths
VECTOR_STORE_PATH = "vector_store/faiss_index"
os.makedirs("vector_store", exist_ok=True)

# Initialize embeddings
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


def process_pdf(file_path: str):
    """
    Load a PDF, create embeddings, and persist to FAISS vector store.
    """
    loader = PyPDFLoader(file_path)
    documents = loader.load()

    if os.path.exists(VECTOR_STORE_PATH):
        # Load existing vector store and add new documents
        vector_store = FAISS.load_local(VECTOR_STORE_PATH, embeddings, allow_dangerous_deserialization=True)
        vector_store.add_documents(documents)
    else:
        # Create new vector store
        vector_store = FAISS.from_documents(documents, embeddings)

    # Save vector store
    vector_store.save_local(VECTOR_STORE_PATH)

    return {"message": "PDF processed and embeddings stored successfully"}
