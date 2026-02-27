"""
witty.py — Witty, funny phrases shown while the RAG pipeline is thinking.
Rotate through these on the frontend between request and response.
"""

WITTY_PHRASES = [
    # Research-themed
    "Consulting the bibliography oracle…",
    "Asking the paper politely to explain itself…",
    "Bribing the neural network with more tokens…",
    "Cross-referencing footnotes no one reads…",
    "Summoning the spirit of peer review…",
    "Checking if the authors cited themselves again…",
    "Untangling the methodology section…",
    "Decoding academic prose into human language…",
    "Searching for the conclusion the abstract promised…",
    "Wading through the limitations section…",
    "Asking GPT what the researchers actually meant…",
    "Mining the references list for gold…",
    "Translating jargon since 1823…",
    "Locating the one relevant sentence on page 47…",
    "Parsing tables that should have been charts…",
    "Negotiating with the embedding vectors…",
    "Coaxing coherence from the corpus…",
    "Running semantic search at the speed of thought (roughly)…",
    "Asking the chunks nicely…",
    "Interrogating paragraph 3, subsection 2.4…",

    # AI-themed
    "Spinning up the inference engine…",
    "Warming up the attention heads…",
    "Doing matrix multiplication for your benefit…",
    "Multiplying by the weight matrix, as one does…",
    "Softmaxing probabilities — very softly…",
    "Applying dropout (it helps, trust us)…",
    "Running gradient descent in your honor…",
    "Feeding vectors to the transformer…",
    "Calculating cosine similarity at record speed (relative to geology)…",
    "Embedding your question into high-dimensional space…",
    "Retrieving chunks before they get cold…",
    "Flipping through the semantic index…",
    "Visiting the nearest neighbors…",
    "Checking the lookup table… there's no lookup table…",
    "Counting attention heads to sleep…",
    "Making sense of high-dimensional sadness…",

    # Existential / funny
    "Contemplating the nature of knowledge…",
    "Wondering if the paper will ever be cited…",
    "Questioning whether this question was already answered…",
    "Briefly having an existential crisis about information retrieval…",
    "Philosophically pre-processing your query…",
    "Debating the trolley problem with itself…",
    "Wondering why there isn't a TL;DR…",
    "Reaching enlightenment about your question…",

    # Tech-themed
    "Querying MongoDB at the speed of disk…",
    "Spinning up the RAG pipeline at full ceremony…",
    "Serializing your patience…",
    "Deserializing the answer…",
    "Allocating memory for your brilliance…",
    "Garbage-collecting the bad answers…",
    "Compiling wisdom into bytecode…",
    "Optimizing the knowledge graph (no, we don't have one)…",
    "Indexing the index that indexes the index…",
    "Calling `chunk.generate_answer()` — deprecated, but spirited…",
    "rm -rf bad_answers && mkdir good_answers…",
    "git blame → the original authors…",
    "Searching Stack Overflow for your answer (kidding)…",
    "Opening 47 browser tabs mentally…",

    # Enterprise-flavored
    "Synergizing cross-functional document intelligence…",
    "Leveraging AI-powered insight vectors…",
    "Orchestrating the end-to-end retrieval pipeline…",
    "Generating enterprise-grade results momentarily…",
    "Optimizing for stakeholder-aligned responses…",
]

import random

def random_phrase() -> str:
    return random.choice(WITTY_PHRASES)
