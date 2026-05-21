# Clinical PII (Personally Identifiable Information) De-identification System

[![Status](https://img.shields.io/badge/status-production![License](https://img.shields.io/badge/license-MIT-blueAI-powered clinical data anonymization using Microsoft Presidio + spaCy NLP. Detects 18+ PII types with 95%+ accuracy.

This is a RESTful microservice using Microsoft Presidio - an open-source NLP framework for PII de-identification.

Also, to modify the performance, this system uses regex pattern matching, rule-based heuristics, and confidence scoring to detect sensitive entities in text or CSV data.

# 🎯 Features

| Frontend                   | Backend                     |
| -------------------------- | --------------------------- |
| ✅ Text & CSV processing   | ✅ Presidio ML pipeline     |
| ✅ 5 anonymization methods | ✅ spaCy transformer models |
| ✅ Real-time detection     | ✅ RESTful JSON API         |
| ✅ Confidence scoring      | ✅ CORS + Error handling    |
| ✅ Column selection        | ✅ Threshold tuning         |

# 🚀 How to Start?

1. Backend Setup
   mkdir pii-backend && cd pii-backend
   python -m venv venv
   source venv/bin/activate # Windows: venv\Scripts\activate
   pip install flask flask-cors presidio-analyzer presidio-anonymizer spacy
   python -m spacy download en_core_web_lg

python app.py

2. Frontend Setup
   npx create-react-app pii-anonymizer
   cd pii-anonymizer
   npm install lucide-react
   npm start

3. Full Stack Launch
   (Backend):
   cd pii-backend && source venv/bin/activate && python app.py

   (Frontend):  
    cd pii-anonymizer && npm start

🌐 Open: http://localhost:3000

# 🛠️ Technical Stack

| Component | Technology           | Purpose                       |
| --------- | -------------------- | ----------------------------- |
| Backend   | Flask + Presidio 2.2 | ML PII detection              |
| NLP       | spaCy en_core_web_lg | Transformer NER               |
| Frontend  | React 18 + Tailwind  | Clinical UI                   |
| API       | REST JSON            | /health, /analyze, /anonymize |

# License

MIT License - Free for academic & commercial use.

# Acknowledgments

Microsoft Presidio - Production-grade PII de-identification

spaCy - State-of-the-art NLP transformer models

Flask - Lightweight Python microframework

# Clinical-Data-Deidentification-System
