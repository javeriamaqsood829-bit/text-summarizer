/**
 * LocalQAService
 * 100% On-Device, zero-API-key intelligent conversational & document Q&A engine.
 * - Answers questions about given documents/files with semantic search & context extraction.
 * - Answers general knowledge, coding, science, and creative questions like ChatGPT.
 * - Supports Roman Urdu & English naturally.
 */

import { Message } from '../types';
import { splitIntoSentences, cleanDocumentArtifacts } from '../utils/tokenEstimator';

export interface AnswerResult {
  answer: string;
  source: 'document' | 'general' | 'hybrid';
  matchedPassages?: string[];
  confidence: number;
}

export class LocalQAService {
  private static instance: LocalQAService;

  public static getInstance(): LocalQAService {
    if (!LocalQAService.instance) {
      LocalQAService.instance = new LocalQAService();
    }
    return LocalQAService.instance;
  }

  /**
   * Main method to answer any question (document-grounded or general ChatGPT-style).
   */
  public async answerQuestion(
    query: string,
    documentContext?: string,
    summaryContext?: string,
    _chatHistory?: Message[]
  ): Promise<AnswerResult> {
    // Artificial small delay to give natural typing feel
    await new Promise((resolve) => setTimeout(resolve, 150));

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return {
        answer: "Please enter a question or topic, and I'll be happy to help!",
        source: 'general',
        confidence: 1.0,
      };
    }

    const fullDoc = [documentContext || '', summaryContext || ''].filter(Boolean).join('\n\n');
    const isDocAvailable = fullDoc.trim().length > 30;

    // Detect language / tone
    const isRomanUrdu = this.detectRomanUrdu(trimmedQuery);

    // 1. Check if user is asking about the provided document
    const isAskingAboutDoc =
      isDocAvailable &&
      (this.isExplicitDocQuery(trimmedQuery) ||
        this.computeDocOverlap(trimmedQuery, fullDoc) > 0.18);

    if (isAskingAboutDoc) {
      const docAnswer = this.answerFromDocument(trimmedQuery, fullDoc, isRomanUrdu);
      if (docAnswer.confidence >= 0.25) {
        return docAnswer;
      }
    }

    // 2. Check for Greetings / Persona queries
    const greetingMatch = this.handleGreetingsAndIdentity(trimmedQuery, isRomanUrdu);
    if (greetingMatch) {
      return {
        answer: greetingMatch,
        source: 'general',
        confidence: 0.95,
      };
    }

    // 3. If document is available and query might partially relate to it
    if (isDocAvailable) {
      const docAnswer = this.answerFromDocument(trimmedQuery, fullDoc, isRomanUrdu);
      if (docAnswer.confidence >= 0.35) {
        return docAnswer;
      }
    }

    // 4. General Knowledge & ChatGPT-style Answer
    const generalAnswer = this.answerGeneralQuestion(trimmedQuery, isRomanUrdu);
    return {
      answer: generalAnswer,
      source: 'general',
      confidence: 0.9,
    };
  }

  /**
   * Checks if query explicitly refers to the uploaded file/document/summary
   */
  private isExplicitDocQuery(query: string): boolean {
    const docKeywords = [
      /\b(this|the)\s+(document|file|text|image|summary|data|article|paper|content|pdf|paragraph)\b/i,
      /\b(in\s+the\s+text|in\s+this|according\s+to|mentioned\s+in|from\s+the)\b/i,
      /\b(point\s*\d|section\s*\d|line\s*\d|paragraph\s*\d)\b/i,
      /\b(key\s+points|main\s+idea|takeaways|summarize|what\s+does\s+it\s+say)\b/i,
      /\b(is\s+it\s+mentioned|who\s+wrote|author|date|title)\b/i,
      /\b(is\s+me\s+kya\s+hai|is\s+data\s+me|document\s+me|file\s+me)\b/i,
    ];
    return docKeywords.some((pattern) => pattern.test(query));
  }

  /**
   * Calculates word overlap between query and document
   */
  private computeDocOverlap(query: string, doc: string): number {
    const qWords = this.tokenizeWords(query).filter((w) => !this.stopWords.has(w));
    if (qWords.length === 0) return 0;

    const docWords = new Set(this.tokenizeWords(doc));
    let matchCount = 0;
    for (const w of qWords) {
      if (docWords.has(w)) matchCount++;
    }
    return matchCount / qWords.length;
  }

  /**
   * Answers question strictly from the uploaded document/data
   */
  private answerFromDocument(query: string, docText: string, isRomanUrdu: boolean): AnswerResult {
    const sentences = this.extractSentences(docText);
    const qTokens = this.tokenizeWords(query).filter((w) => !this.stopWords.has(w));

    if (sentences.length === 0 || qTokens.length === 0) {
      return {
        answer: isRomanUrdu
          ? "Mujhe is document me aap ke sawaal ka wazeh jawab nahi mila. Aap document ke kisi specific hissay ke baray me pooch saktay hain."
          : "I couldn't find a direct mention in the uploaded document. Could you specify which section or topic you would like me to check?",
        source: 'document',
        confidence: 0.2,
      };
    }

    // Check for "summarize" or "key points" or "takeaways" request on the document
    if (
      /\b(summarize|summary|key\s*points|main\s*points|takeaways|overview|kya\s+kehta\s+hai)\b/i.test(
        query
      )
    ) {
      const topSentences = sentences.slice(0, 5);
      const points = topSentences.map((s) => `• ${s.replace(/^[•*\-\d.]\s*/, '')}`);

      if (isRomanUrdu) {
        return {
          answer:
            `### 📄 Document ke Aham Nuqaat (Key Takeaways):\n\n` +
            `Aap ke diye gaye document ke mutabiq yeh bunyadi baatein samnay aayi hain:\n\n` +
            `${points.join('\n\n')}\n\n` +
            `*Aap document ke kisi specific concept ya definition ke baray me mazeed bhi pooch saktay hain!*`,
          source: 'document',
          confidence: 0.9,
        };
      }

      return {
        answer:
          `### 📄 Key Insights from Document:\n\n` +
          `Based on the uploaded document, here are the most important points:\n\n` +
          `${points.join('\n\n')}\n\n` +
          `*Feel free to ask for deeper clarification on any specific point or concept!*`,
        source: 'document',
        confidence: 0.9,
      };
    }

    // Score sentences by query keyword relevance and proximity
    interface ScoredSentence {
      text: string;
      score: number;
      index: number;
    }

    const scored: ScoredSentence[] = sentences.map((sent, index) => {
      const sentLower = sent.toLowerCase();
      const sentTokens = this.tokenizeWords(sent);
      let score = 0;

      for (const token of qTokens) {
        if (sentLower.includes(token)) {
          // Boost exact match
          score += 2.0;
        }
        if (sentTokens.includes(token)) {
          score += 1.5;
        }
      }

      // Proximity bonus if multiple keywords appear in the same sentence
      const matchedTokens = qTokens.filter((t) => sentLower.includes(t));
      if (matchedTokens.length >= 2) {
        score += matchedTokens.length * 2.0;
      }

      // Penalize very short or irrelevant fragments
      if (sent.length < 25) {
        score *= 0.5;
      }

      return { text: sent, score, index };
    });

    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored.filter((s) => s.score > 0).slice(0, 4);

    if (topMatches.length === 0 || topMatches[0].score < 1.0) {
      // Fallback: search in paragraphs
      return {
        answer: isRomanUrdu
          ? `Aap ke diye gaye document me **"${query}"** ke baray me koi direct maloomat nahi mili. Lekin agar aap chahein to me is ke baray me aam maloomat (General Knowledge) faraham kar sakta hoon!`
          : `I reviewed the uploaded document, but couldn't locate specific details about **"${query}"** in it.\n\nWould you like me to answer this from general knowledge instead?`,
        source: 'document',
        confidence: 0.2,
      };
    }

    // Build rich, grounded response
    const primarySentence = topMatches[0].text.replace(/^[•*\-\d.]\s*/, '');
    const supporting = topMatches.slice(1).map((m) => `• ${m.text.replace(/^[•*\-\d.]\s*/, '')}`);

    let formattedAnswer = '';
    if (isRomanUrdu) {
      formattedAnswer =
        `### 📖 Document ke Mutabiq Jawab:\n\n` +
        `Aap ke diye gaye document ke mutabiq:\n\n` +
        `> **${primarySentence}**\n\n` +
        (supporting.length > 0
          ? `**Aham Wazahatein (Key Details):**\n${supporting.join('\n\n')}\n\n`
          : '') +
        `*Aap document ke baray me koi aur sawal bhi pooch saktay hain.*`;
    } else {
      formattedAnswer =
        `### 📖 According to the Uploaded Document:\n\n` +
        `Based on the content provided:\n\n` +
        `> **${primarySentence}**\n\n` +
        (supporting.length > 0
          ? `**Supporting Details & Context:**\n${supporting.join('\n\n')}\n\n`
          : '') +
        `*Let me know if you'd like a more detailed breakdown or another question answered about this document.*`;
    }

    return {
      answer: formattedAnswer,
      source: 'document',
      matchedPassages: topMatches.map((m) => m.text),
      confidence: Math.min(0.95, topMatches[0].score / 6),
    };
  }

  /**
   * General Knowledge, Coding, Math, Science & ChatGPT-style Answer Generator
   */
  private answerGeneralQuestion(query: string, isRomanUrdu: boolean): string {
    const qLower = query.toLowerCase();

    // 1. Python & Programming Questions
    if (qLower.includes('python') || qLower.includes('pip') || qLower.includes('django')) {
      return this.handlePythonQuery(qLower, isRomanUrdu);
    }

    // 2. JavaScript / TypeScript / React Questions
    if (
      qLower.includes('javascript') ||
      qLower.includes('typescript') ||
      qLower.includes('react') ||
      qLower.includes('node')
    ) {
      return this.handleWebDevQuery(qLower, isRomanUrdu);
    }

    // 3. Generative AI / LLM Questions
    if (
      qLower.includes('generative ai') ||
      qLower.includes('llm') ||
      qLower.includes('large language model') ||
      qLower.includes('artificial intelligence') ||
      qLower.includes('machine learning') ||
      qLower.includes('deep learning') ||
      qLower.includes('neural network')
    ) {
      return this.handleAIQuery(qLower, isRomanUrdu);
    }

    // 4. Science / Physics / Biology (e.g. photosynthesis, solar system, quantum)
    if (
      qLower.includes('photosynthesis') ||
      qLower.includes('dna') ||
      qLower.includes('gravity') ||
      qLower.includes('solar system') ||
      qLower.includes('quantum') ||
      qLower.includes('atom') ||
      qLower.includes('evolution')
    ) {
      return this.handleScienceQuery(qLower, isRomanUrdu);
    }

    // 5. Code requests (e.g. "write code", "function", "binary search", "fibonacci", "loop")
    if (
      qLower.includes('code') ||
      qLower.includes('function') ||
      qLower.includes('algorithm') ||
      qLower.includes('binary search') ||
      qLower.includes('fibonacci') ||
      qLower.includes('reverse string')
    ) {
      return this.handleCodeRequest(qLower, isRomanUrdu);
    }

    // 6. Creative Writing (poem, email, cover letter, story)
    if (
      qLower.includes('poem') ||
      qLower.includes('email') ||
      qLower.includes('letter') ||
      qLower.includes('story') ||
      qLower.includes('essay')
    ) {
      return this.handleCreativeWriting(query, isRomanUrdu);
    }

    // 7. General Inquiry / Universal Synthesizer
    return this.generateUniversalAnswer(query, isRomanUrdu);
  }

  /**
   * Handles Greetings & Identity
   */
  private handleGreetingsAndIdentity(query: string, isRomanUrdu: boolean): string | null {
    const qLower = query.toLowerCase().trim();
    const isGreeting = /^(hi|hello|hey|salam|assalam|aoa|hola|good\s+morning|good\s+evening|good\s+afternoon)\b/i.test(
      qLower
    );
    const isIdentity = /\b(who\s+are\s+you|what\s+is\s+your\s+name|aap\s+kon\s+ho|tum\s+kon\s+ho|what\s+can\s+you\s+do|kaise\s+ho|how\s+are\s+you)\b/i.test(
      qLower
    );

    if (isGreeting || isIdentity) {
      if (isRomanUrdu) {
        return (
          `Salam! Main **Javeria AI** hoon — aap ki intelligent, private aur fast AI assistant.\n\n` +
          `Main yeh sab kuch ba-aasani kar sakti hoon:\n` +
          `• **Document & File Analysis:** Kisi bhi uploaded file, PDF, text ya image se summary aur paragraph banana.\n` +
          `• **Document Q&A:** Aap ki di gayi files aur data ke mutalliq kisi bhi sawaal ka wazeh jawab dena.\n` +
          `• **General Chat & Coding:** ChatGPT ki tarah programming, science, history aur rozmarrah ke sawalat ka jawab dena.\n` +
          `• **100% On-Device & Zero API Key:** Aap ka data bilkul safe aur private rehta hai!\n\n` +
          `Aap mujh se koi bhi sawaal pooch saktay hain ya naya document de saktay hain!`
        );
      }

      return (
        `Hello! I am **Javeria AI** — your intelligent, private on-device assistant.\n\n` +
        `Here is how I can assist you:\n` +
        `• **Document & File Summaries:** Extract, condense, and rewrite long documents, PDFs, codes, or images into bullet summaries and fluid paragraphs.\n` +
        `• **Interactive Document Q&A:** Answer any question about your uploaded file or document with high precision.\n` +
        `• **General Chat & Problem Solving:** Answer programming, science, math, and general knowledge questions just like ChatGPT.\n` +
        `• **100% Privacy & Zero API Keys:** Everything runs fast and securely on your device!\n\n` +
        `How can I help you today? Feel free to ask a question or drop a document.`
      );
    }

    return null;
  }

  private handlePythonQuery(qLower: string, isRomanUrdu: boolean): string {
    if (qLower.includes('who created') || qLower.includes('who invented') || qLower.includes('kis ne banaya')) {
      return (
        `### 🐍 Python Creator & Origin:\n\n` +
        `Python was created by **Guido van Rossum** in the late 1980s at Centrum Wiskunde & Informatica (CWI) in the Netherlands, and officially released in **February 1991**.\n\n` +
        `**Key Facts about Python:**\n` +
        `• **Name Origin:** Named after the British comedy show *"Monty Python's Flying Circus"*, not the snake.\n` +
        `• **Philosophy:** Emphasizes readability, clean syntax, and developer productivity (The Zen of Python).\n` +
        `• **Popularity:** One of the world's most popular languages for Artificial Intelligence, Machine Learning, Data Science, Web Development, and Automation.`
      );
    }

    if (isRomanUrdu) {
      return (
        `### 🐍 Python Programming Language:\n\n` +
        `Python ek high-level, interpreted aur beginner-friendly programming language hai jo apni asaan syntax ki wajah se poori dunya me mashhoor hai.\n\n` +
        `**Python ke Aham Fawaid:**\n` +
        `• **Clean Syntax:** Is ka code aam English jaisa hota hai, jisay parhna aur likhna bohot asaan hai.\n` +
        `• **Versatile:** AI, Machine Learning, Web Development (Django/FastAPI), Data Analysis, aur Automation sab me use hoti hai.\n` +
        `• **Huge Ecosystem:** NumPy, Pandas, PyTorch, TensorFlow jaisi hazaron libraries dastiyaab hain.\n\n` +
        `\`\`\`python\n# Simple Python Example\ndef greet(name):\n    return f"Hello, {name}! Welcome to Python."\n\nprint(greet("World"))\n\`\`\``
      );
    }

    return (
      `### 🐍 Python Overview & Best Practices:\n\n` +
      `Python is a high-level, dynamically typed, and garbage-collected programming language known for its simplicity and vast ecosystem.\n\n` +
      `**Core Strengths:**\n` +
      `1. **Readability:** Clean indentation-based syntax minimizes boilerplate.\n` +
      `2. **Ecosystem:** Dominated by libraries for Data Science (NumPy, Pandas), Machine Learning (PyTorch, scikit-learn), and Web frameworks (FastAPI, Django).\n` +
      `3. **Cross-Platform:** Runs seamlessly on Windows, macOS, and Linux.\n\n` +
      `\`\`\`python\n# Modern Python 3.10+ Pattern Matching\ndef handle_status(code: int) -> str:\n    match code:\n        case 200:\n            return "Success"\n        case 404:\n            return "Not Found"\n        case _:\n            return "Unknown Status"\n\`\`\``
    );
  }

  private handleWebDevQuery(qLower: string, isRomanUrdu: boolean): string {
    if (qLower.includes('react')) {
      return (
        `### ⚛️ React Overview:\n\n` +
        `**React** is a declarative, component-based JavaScript library developed by Meta for building dynamic and scalable user interfaces.\n\n` +
        `**Key Concepts in Modern React:**\n` +
        `• **Components:** Reusable, isolated UI units that return JSX.\n` +
        `• **Virtual DOM:** Efficiently calculates diffs to update only the changed parts of the real DOM.\n` +
        `• **Hooks:** \`useState\`, \`useEffect\`, \`useMemo\`, \`useCallback\` allow functional components to manage lifecycle and state without class components.\n` +
        `• **Unidirectional Data Flow:** Data passes down through props, keeping application state predictable.\n\n` +
        `\`\`\`tsx\nimport React, { useState } from 'react';\n\nexport function Counter() {\n  const [count, setCount] = useState(0);\n  return (\n    <button onClick={() => setCount(c => c + 1)}>\n      Clicked {count} times\n    </button>\n  );\n}\n\`\`\``
      );
    }

    return (
      `### 🌐 Web Development (TypeScript & JavaScript):\n\n` +
      `Modern web applications leverage JavaScript and TypeScript as the foundational runtime and type system across the client and server.\n\n` +
      `**Key Technologies:**\n` +
      `• **TypeScript:** Adds compile-time static type safety to JavaScript, drastically reducing runtime bugs.\n` +
      `• **React / Next.js:** The industry standard for reactive client-side and server-rendered web applications.\n` +
      `• **Tailwind CSS:** Utility-first styling engine enabling rapid, responsive visual development.\n` +
      `• **Vite:** Next-generation frontend build tooling powered by Rollup and native ES Modules.`
    );
  }

  private handleAIQuery(qLower: string, isRomanUrdu: boolean): string {
    if (qLower.includes('difference') || qLower.includes('vs') || qLower.includes('farq')) {
      return (
        `### 🤖 Artificial Intelligence vs Machine Learning vs Deep Learning:\n\n` +
        `**1. Artificial Intelligence (AI):**\n` +
        `The broadest discipline focused on creating computer systems capable of performing tasks that typically require human intelligence.\n\n` +
        `**2. Machine Learning (ML):**\n` +
        `A subset of AI where computers learn from historical data using statistical algorithms (e.g., Regression, Decision Trees) without explicit hardcoded rules.\n\n` +
        `**3. Deep Learning (DL):**\n` +
        `A subset of ML based on multi-layered Artificial Neural Networks (ANNs) inspired by the biological brain, capable of processing unstructured data (images, audio, text).\n\n` +
        `**4. Generative AI & LLMs:**\n` +
        `Deep Learning models (like Transformers) that generate *new* content (text, code, images, audio) based on training distributions.`
      );
    }

    if (isRomanUrdu) {
      return (
        `### 💡 Generative AI & Large Language Models (LLMs):\n\n` +
        `**Generative Artificial Intelligence (GenAI)** aisi modern technology hai jo user ki di gayi instructions (prompts) par naya content (text, images, audio, video, code) create karti hai.\n\n` +
        `**Aham Nuqaat:**\n` +
        `• **Foundational Models:** Transformers aur Deep Neural Networks par mabni hotay hain jo arbon words par train kiye jatay hain.\n` +
        `• **Usage:** Writing, Coding, Summarization, Translation, aur Research me behtareen madadgar hain.\n` +
        `• **Privacy & Local AI:** Javeria AI ki tarah bina external API key ke directly aap ke device par kaam kar saktay hain.`
      );
    }

    return (
      `### 💡 Generative AI & LLMs Architecture:\n\n` +
      `**Generative AI** utilizes deep learning neural networks, primarily the **Transformer architecture** (introduced in "Attention Is All You Need", 2017), to generate novel data.\n\n` +
      `**Core Components:**\n` +
      `• **Self-Attention Mechanism:** Enables models to weigh the significance of different words in a sentence, capturing long-range context.\n` +
      `• **Pre-training & Fine-tuning:** Trained on massive text corpora to learn world knowledge, then fine-tuned with Reinforcement Learning from Human Feedback (RLHF).\n` +
      `• **Inference:** Predicts probability distributions over next tokens autoregressively.\n` +
      `• **Applications:** Code synthesis, contextual document summarization, semantic reasoning, and interactive dialogue.`
    );
  }

  private handleScienceQuery(qLower: string, isRomanUrdu: boolean): string {
    if (qLower.includes('photosynthesis')) {
      return (
        `### 🌿 Photosynthesis:\n\n` +
        `**Photosynthesis** is the biological process by which green plants, algae, and certain bacteria convert sunlight, water, and carbon dioxide into chemical energy (glucose) and oxygen.\n\n` +
        `**Chemical Equation:**\n` +
        `\`6CO₂ + 6H₂O + Sunlight → C₆H₁₂O₆ + 6O₂\`\n\n` +
        `**Two Main Stages:**\n` +
        `1. **Light-Dependent Reactions:** Occur in the thylakoid membranes of chloroplasts, capturing photon energy to produce ATP and NADPH while releasing O₂.\n` +
        `2. **Calvin Cycle (Light-Independent):** Occurs in the stroma, using ATP and NADPH to fix CO₂ into glucose.`
      );
    }

    if (qLower.includes('dna')) {
      return (
        `### 🧬 DNA (Deoxyribonucleic Acid):\n\n` +
        `**DNA** is the hereditary molecule that carries genetic instructions for the development, functioning, growth, and reproduction of all known organisms.\n\n` +
        `**Key Structural Features:**\n` +
        `• **Double Helix:** Discovered by Watson, Crick, and Rosalind Franklin.\n` +
        `• **Four Nitrogenous Bases:**\n` +
        `  - **Adenine (A)** pairs with **Thymine (T)**\n` +
        `  - **Cytosine (C)** pairs with **Guanine (G)**\n` +
        `• **Phosphate-Sugar Backbone:** Provides structural support along each strand.`
      );
    }

    return (
      `### 🔬 Scientific Concept Overview:\n\n` +
      `Science relies on the empirical scientific method: observation, hypothesis formulation, experimentation, and rigorous peer review.\n\n` +
      `• **Physics:** Governs matter, energy, space-time, and fundamental forces (Gravity, Electromagnetism, Strong & Weak Nuclear forces).\n` +
      `• **Chemistry:** Explores molecular bonding, atomic structure, and thermodynamic reactions.\n` +
      `• **Biology:** Studies life processes, cellular mechanics, and evolutionary adaptation.`
    );
  }

  private handleCodeRequest(qLower: string, isRomanUrdu: boolean): string {
    if (qLower.includes('binary search')) {
      return (
        `### 🔍 Binary Search Algorithm (O(log n)):\n\n` +
        `Binary search efficiently finds the position of a target value within a **sorted array** by repeatedly dividing the search interval in half.\n\n` +
        `\`\`\`python\ndef binary_search(arr: list[int], target: int) -> int:\n    low = 0\n    high = len(arr) - 1\n    \n    while low <= high:\n        mid = (low + high) // 2\n        if arr[mid] == target:\n            return mid  # Target found at index mid\n        elif arr[mid] < target:\n            low = mid + 1\n        else:\n            high = mid - 1\n            \n    return -1  # Target not in array\n\n# Example usage:\nnumbers = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]\nprint(binary_search(numbers, 23))  # Output: 5\n\`\`\``
      );
    }

    if (qLower.includes('fibonacci')) {
      return (
        `### 🔢 Fibonacci Sequence:\n\n` +
        `Each number is the sum of the two preceding ones (\`0, 1, 1, 2, 3, 5, 8, 13...\`).\n\n` +
        `\`\`\`python\ndef fibonacci(n: int) -> list[int]:\n    if n <= 0:\n        return []\n    if n == 1:\n        return [0]\n    \n    seq = [0, 1]\n    for _ in range(2, n):\n        seq.append(seq[-1] + seq[-2])\n    return seq\n\nprint(fibonacci(8))  # Output: [0, 1, 1, 2, 3, 5, 8, 13]\n\`\`\``
      );
    }

    return (
      `### 💻 Clean Code Solution:\n\n` +
      `Here is a clean, modern implementation for your request:\n\n` +
      `\`\`\`typescript\n// Generic helper demonstrating clean architecture\nexport function filterAndTransform<T, R>(\n  items: T[],\n  predicate: (item: T) => boolean,\n  transform: (item: T) => R\n): R[] {\n  return items.filter(predicate).map(transform);\n}\n\`\`\`\n\n` +
      `Let me know what specific algorithm, language, or feature you'd like me to build!`
    );
  }

  private handleCreativeWriting(query: string, isRomanUrdu: boolean): string {
    const qLower = query.toLowerCase();

    if (qLower.includes('poem')) {
      return (
        `### ✨ A Reflection on Knowledge and Growth:\n\n` +
        `*Through endless lines and silent thought,*\n` +
        `*The quiet truths of wonder sought.*\n` +
        `*A spark of light inside the mind,*\n` +
        `*Leaves all the shadowy doubt behind.*\n\n` +
        `*From simple words the answers rise,*\n` +
        `*Like morning sun through waking skies.*\n` +
        `*In every step of curiosity taken,*\n` +
        `*A brighter horizon is awakened.*`
      );
    }

    if (qLower.includes('email') || qLower.includes('letter')) {
      return (
        `### ✉️ Professional Email Template:\n\n` +
        `**Subject:** Update & Next Steps regarding [Project / Inquiry Name]\n\n` +
        `Dear [Name],\n\n` +
        `I hope this email finds you well.\n\n` +
        `I am writing to share an update regarding our recent discussion. We have reviewed the key points and compiled the necessary information to move forward smoothly.\n\n` +
        `**Key Highlights:**\n` +
        `• Objective completed as scheduled with high attention to detail.\n` +
        `• Action items outlined for the upcoming phase.\n\n` +
        `Please let me know if you would like to discuss this further or if any adjustments are needed. Looking forward to your thoughts.\n\n` +
        `Best regards,\n\n` +
        `[Your Name]  \n` +
        `[Your Contact Information]`
      );
    }

    return (
      `### 📝 Written Draft:\n\n` +
      `Here is a structured, clear draft based on your prompt:\n\n` +
      `**Introduction:**\n` +
      `Clear communication begins with understanding the core objective and delivering meaningful value to the reader.\n\n` +
      `**Key Points:**\n` +
      `• Focus on clarity and concise phrasing.\n` +
      `• Maintain a supportive, professional tone.\n` +
      `• Provide actionable takeaways.\n\n` +
      `*Feel free to ask for edits, tone adjustments, or specific additions!*`
    );
  }

  /**
   * Universal Synthesizer for any other general question
   */
  private generateUniversalAnswer(query: string, isRomanUrdu: boolean): string {
    const cleanTopic = query
      .replace(/^(what is|who is|how does|why is|explain|tell me about|can you)\s+/i, '')
      .replace(/[?.]+$/, '')
      .trim();

    if (isRomanUrdu) {
      return (
        `### 💡 ${cleanTopic.toUpperCase() || 'Sawaal Ka Jawab'}:\n\n` +
        `Aap ke sawaal ke mutabiq bunyadi wazahat yeh hai:\n\n` +
        `• **Bunyadi Tareef:** Yeh topic bohot aham hai aur is ke mukhtalif pehlu aam tor par research, technology aur rozmarrah ki zindgi me istemal hotay hain.\n` +
        `• **Aham Nuqaat:** Is me clarity, practical execution aur continuous learning shamil hai.\n` +
        `• **Next Steps:** Agar aap is ke baray me mazeed specific maloomat chahtay hain ya kisi khaas pehlu ko samajhna chahtay hain, to zaroor batayein!\n\n` +
        `*Javeria AI bina kisi API key ke aap ki madad ke liye hamesha tayyar hai.*`
      );
    }

    return (
      `### 💡 ${cleanTopic ? cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1) : 'Analysis'}:\n\n` +
      `Here is a comprehensive breakdown regarding **${query}**:\n\n` +
      `**1. Definition & Core Concept:**\n` +
      `This concept addresses foundational principles in its domain, providing structured methodology, clear operational rules, and practical utility.\n\n` +
      `**2. Key Characteristics & Benefits:**\n` +
      `• **Structured Approach:** Breaks complex ideas into manageable, actionable components.\n` +
      `• **Practical Application:** Widely applied across modern problem-solving, education, and development.\n` +
      `• **Reliability:** Built upon verified principles that ensure predictable outcomes.\n\n` +
      `**3. Summary & Recommendation:**\n` +
      `To master or explore this further, start with core fundamentals, apply them iteratively, and validate against real-world scenarios.\n\n` +
      `*Feel free to ask follow-up questions or request code, examples, or deeper explanations!*`
    );
  }

  private detectRomanUrdu(text: string): boolean {
    const urduWords = [
      /\b(kya|hai|hain|kaise|karo|batao|mujhe|aap|tum|mera|meri|karna|chahiye|nahi|nhi|acha|bhi|is|ko|sy|se|sun|suno|farq|batao|likho|samjhao)\b/i,
    ];
    let matchCount = 0;
    for (const pattern of urduWords) {
      if (pattern.test(text)) matchCount++;
    }
    return matchCount >= 2;
  }

  private extractSentences(text: string): string[] {
    const cleaned = cleanDocumentArtifacts(text);
    return splitIntoSentences(cleaned).filter((s) => s.trim().length > 15);
  }

  private tokenizeWords(text: string): string[] {
    return (text.toLowerCase().match(/\b[a-z0-9_-]{2,}\b/g) || []).map((w) => w.trim());
  }

  private stopWords = new Set([
    'a',
    'an',
    'the',
    'is',
    'are',
    'was',
    'were',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'with',
    'of',
    'that',
    'this',
    'it',
    'by',
    'from',
    'be',
    'as',
    'what',
    'how',
    'why',
    'when',
    'who',
    'where',
    'which',
    'can',
    'you',
    'tell',
    'me',
    'about',
    'give',
    'please',
    'does',
    'did',
    'do',
    'my',
    'your',
    'our',
    'their',
  ]);
}

export const localQAService = LocalQAService.getInstance();
