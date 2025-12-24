import React, { useState } from "react";
import {
  Shield,
  Download,
  Upload,
  Trash2,
  Info,
  FileText,
  Database,
  AlertCircle,
} from "lucide-react";

const PIIAnonymizer = () => {
  const [activeTab, setActiveTab] = useState("text");
  const [inputText, setText] = useState("");
  const [processedText, setProcessedText] = useState("");
  const [detectedEntities, setDetectedEntities] = useState([]);
  const [threshold, setThreshold] = useState(0.5);
  const [anonymizationMethod, setAnonymizationMethod] = useState("redact");

  // CSV states
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [processedCsvData, setProcessedCsvData] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [processing, setProcessing] = useState(false);

  const [selectedEntities, setSelectedEntities] = useState({
    PERSON: true,
    EMAIL_ADDRESS: true,
    PHONE_NUMBER: true,
    CREDIT_CARD: true,
    US_SSN: true,
    LOCATION: true,
    DATE_TIME: true,
    IP_ADDRESS: true,
    URL: true,
    MEDICAL_RECORD: true,
    AGE: true,
  });

  const patterns = {
    EMAIL_ADDRESS: {
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      score: 0.95,
    },
    PHONE_NUMBER: {
      regex: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      score: 0.85,
    },
    CREDIT_CARD: {
      regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      score: 0.9,
    },
    US_SSN: {
      regex: /\b\d{3}-\d{2}-\d{4}\b/g,
      score: 0.9,
    },
    IP_ADDRESS: {
      regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      score: 0.85,
    },
    URL: {
      regex:
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
      score: 0.9,
    },
    DATE_TIME: {
      regex:
        /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/g,
      score: 0.75,
    },
    MEDICAL_RECORD: {
      regex: /\b(?:MRN|MR|Patient ID|Record)[\s#:]*\d{6,10}\b/gi,
      score: 0.85,
    },
    AGE: {
      regex: /\b(?:age|aged|years old)[\s:]*(\d{1,3})\b/gi,
      score: 0.7,
    },
  };

  const hashString = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  const encryptString = (str) => {
    return btoa(str).substring(0, 16) + "...";
  };

  const synthesizeData = (entityType, text) => {
    const synthNames = [
      "Alex Johnson",
      "Sam Williams",
      "Jordan Brown",
      "Taylor Davis",
      "Morgan Wilson",
    ];
    const synthEmails = [
      "user@example.com",
      "contact@sample.org",
      "info@demo.net",
    ];
    const synthPhones = ["(555) 000-0000", "(555) 111-1111", "(555) 222-2222"];
    const synthCards = ["0000-0000-0000-0000", "1111-1111-1111-1111"];
    const synthSSN = ["000-00-0000", "111-11-1111"];
    const synthLocations = ["Springfield", "Riverside", "Greenville"];
    const synthIPs = ["192.0.2.0", "198.51.100.0"];
    const synthURLs = ["https://example.com", "https://sample.org"];
    const synthDates = ["01/01/2000", "12/31/1999"];
    const synthMRN = ["MRN000000", "MRN111111", "MRN222222"];

    const hash = hashString(text);
    const index = parseInt(hash.substring(0, 2), 16) % 5;

    switch (entityType) {
      case "PERSON":
        return synthNames[index % synthNames.length];
      case "EMAIL_ADDRESS":
        return synthEmails[index % synthEmails.length];
      case "PHONE_NUMBER":
        return synthPhones[index % synthPhones.length];
      case "CREDIT_CARD":
        return synthCards[index % synthCards.length];
      case "US_SSN":
        return synthSSN[index % synthSSN.length];
      case "LOCATION":
        return synthLocations[index % synthLocations.length];
      case "IP_ADDRESS":
        return synthIPs[index % synthIPs.length];
      case "URL":
        return synthURLs[index % synthURLs.length];
      case "DATE_TIME":
        return synthDates[index % synthDates.length];
      case "MEDICAL_RECORD":
        return synthMRN[index % synthMRN.length];
      case "AGE":
        return "50";
      default:
        return "[SYNTHETIC]";
    }
  };

  const maskString = (str, entityType) => {
    if (entityType === "EMAIL_ADDRESS") {
      const parts = str.split("@");
      if (parts.length === 2) {
        const masked = parts[0].substring(0, 2) + "***";
        return masked + "@" + parts[1];
      }
    }

    if (entityType === "PHONE_NUMBER") {
      return str.replace(/\d(?=\d{4})/g, "*");
    }

    if (entityType === "CREDIT_CARD") {
      return str.replace(/\d(?=\d{4})/g, "*");
    }

    if (entityType === "US_SSN") {
      return "***-**-" + str.slice(-4);
    }

    const visibleChars = Math.min(3, Math.floor(str.length / 3));
    return (
      str.substring(0, visibleChars) +
      "*".repeat(Math.max(3, str.length - visibleChars))
    );
  };

  const applyAnonymization = (text, entityType) => {
    switch (anonymizationMethod) {
      case "redact":
        return "[REDACTED]";
      case "synthesize":
        return synthesizeData(entityType, text);
      case "mask":
        return maskString(text, entityType);
      case "hash":
        return hashString(text);
      case "encrypt":
        return encryptString(text);
      case "highlight":
        return text;
      default:
        return `<${entityType}>`;
    }
  };

  const detectNames = (text) => {
    const results = [];
    const words = text.split(/\s+/);
    const namePattern = /^[A-Z][a-z]+$/;

    for (let i = 0; i < words.length; i++) {
      if (namePattern.test(words[i])) {
        let name = words[i];
        let startIdx = text.indexOf(name);

        if (i + 1 < words.length && namePattern.test(words[i + 1])) {
          name += " " + words[i + 1];
          i++;
        }

        results.push({
          entity_type: "PERSON",
          start: startIdx,
          end: startIdx + name.length,
          score: 0.7,
          text: name,
        });
      }
    }
    return results;
  };

  const detectLocations = (text) => {
    const locations = [
      "New York",
      "Los Angeles",
      "Chicago",
      "Houston",
      "Phoenix",
      "Philadelphia",
      "San Antonio",
      "San Diego",
      "Dallas",
      "San Jose",
      "London",
      "Paris",
      "Tokyo",
      "Sydney",
      "Toronto",
      "Berlin",
      "Madrid",
      "California",
      "Texas",
      "Florida",
      "Washington",
      "Illinois",
    ];
    const results = [];

    locations.forEach((loc) => {
      const regex = new RegExp(`\\b${loc}\\b`, "gi");
      let match;
      while ((match = regex.exec(text)) !== null) {
        results.push({
          entity_type: "LOCATION",
          start: match.index,
          end: match.index + match[0].length,
          score: 0.8,
          text: match[0],
        });
      }
    });

    return results;
  };

  const detectEntitiesInText = (text) => {
    let entities = [];

    Object.entries(patterns).forEach(([entityType, pattern]) => {
      if (selectedEntities[entityType]) {
        let match;
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        while ((match = regex.exec(text)) !== null) {
          if (pattern.score >= threshold) {
            entities.push({
              entity_type: entityType,
              start: match.index,
              end: match.index + match[0].length,
              score: pattern.score,
              text: match[0],
            });
          }
        }
      }
    });

    if (selectedEntities.PERSON) {
      entities = entities.concat(
        detectNames(text).filter((e) => e.score >= threshold)
      );
    }

    if (selectedEntities.LOCATION) {
      entities = entities.concat(
        detectLocations(text).filter((e) => e.score >= threshold)
      );
    }

    entities.sort((a, b) => a.start - b.start);

    const mergedEntities = [];
    entities.forEach((entity) => {
      const overlap = mergedEntities.find(
        (e) =>
          (entity.start >= e.start && entity.start < e.end) ||
          (entity.end > e.start && entity.end <= e.end)
      );

      if (!overlap) {
        mergedEntities.push(entity);
      } else if (entity.score > overlap.score) {
        const idx = mergedEntities.indexOf(overlap);
        mergedEntities[idx] = entity;
      }
    });

    return mergedEntities;
  };

  const anonymizeText = (text) => {
    const entities = detectEntitiesInText(text);
    let result = text;
    let offset = 0;

    entities.forEach((entity) => {
      const replacement = applyAnonymization(entity.text, entity.entity_type);
      const before = result.substring(0, entity.start + offset);
      const after = result.substring(entity.end + offset);
      result = before + replacement + after;
      offset += replacement.length - (entity.end - entity.start);
    });

    return result;
  };

  const analyzeText = () => {
    if (!inputText.trim()) {
      setProcessedText("");
      setDetectedEntities([]);
      return;
    }

    const entities = detectEntitiesInText(inputText);
    setDetectedEntities(entities);

    let result = inputText;
    let offset = 0;

    entities.forEach((entity) => {
      const replacement = applyAnonymization(entity.text, entity.entity_type);
      const before = result.substring(0, entity.start + offset);
      const after = result.substring(entity.end + offset);
      result = before + replacement + after;
      offset += replacement.length - (entity.end - entity.start);
    });

    setProcessedText(result);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        parseCSV(text);
      };
      reader.readAsText(file);
    } else {
      alert("Please upload a valid CSV file");
    }
  };

  const parseCSV = (text) => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length === 0) return;

    const headers = lines[0].split(",").map((h) => h.trim());
    setCsvHeaders(headers);
    setSelectedColumns(headers);

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      data.push(row);
    }
    setCsvData(data);
    setProcessedCsvData([]);
  };

  const processCSV = () => {
    if (csvData.length === 0) return;

    setProcessing(true);
    setTimeout(() => {
      const processed = csvData.map((row) => {
        const newRow = { ...row };
        selectedColumns.forEach((column) => {
          if (row[column]) {
            newRow[column] = anonymizeText(row[column]);
          }
        });
        return newRow;
      });

      setProcessedCsvData(processed);
      setProcessing(false);
    }, 500);
  };

  const downloadCSV = () => {
    if (processedCsvData.length === 0) return;

    const headers = csvHeaders.join(",");
    const rows = processedCsvData
      .map((row) =>
        csvHeaders.map((header) => `"${row[header] || ""}"`).join(",")
      )
      .join("\n");

    const csvContent = headers + "\n" + rows;
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anonymized_data.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleColumn = (column) => {
    setSelectedColumns((prev) =>
      prev.includes(column)
        ? prev.filter((c) => c !== column)
        : [...prev, column]
    );
  };

  const toggleEntity = (entityType) => {
    setSelectedEntities((prev) => ({
      ...prev,
      [entityType]: !prev[entityType],
    }));
  };

  const clearAll = () => {
    setText("");
    setProcessedText("");
    setDetectedEntities([]);
  };

  const clearCSV = () => {
    setCsvFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setProcessedCsvData([]);
    setSelectedColumns([]);
  };

  const downloadResult = () => {
    const element = document.createElement("a");
    const file = new Blob([processedText], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "anonymized_text.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const loadSample = () => {
    setText(
      "Patient John Smith (MRN 1234567) aged 45 was admitted on 12/15/2024. Contact: john.smith@email.com, phone (555) 123-4567. SSN: 123-45-6789. Address: 123 Main St, New York. Credit card on file: 4532-1234-5678-9010."
    );
  };

  const loadSampleCSV = () => {
    const sampleData = `Patient Name,Age,MRN,Email,Phone,Diagnosis
John Smith,45,MRN1234567,john.smith@email.com,(555) 123-4567,Hypertension
Jane Doe,32,MRN7654321,jane.doe@hospital.org,(555) 987-6543,Diabetes
Bob Johnson,67,MRN9876543,bob.j@clinic.com,(555) 456-7890,Arthritis`;

    parseCSV(sampleData);
  };

  const anonymizationMethods = [
    { value: "redact", label: "Redact", desc: "Replace with [REDACTED]" },
    {
      value: "synthesize",
      label: "Synthesize",
      desc: "Replace with fake but realistic data",
    },
    { value: "mask", label: "Mask", desc: "Partially hide with asterisks" },
    { value: "hash", label: "Hash", desc: "Replace with hash value" },
    {
      value: "encrypt",
      label: "Encrypt",
      desc: "Replace with encrypted value",
    },
  ];

  const entityColors = {
    PERSON: "bg-blue-100 text-blue-800 border-blue-300",
    EMAIL_ADDRESS: "bg-green-100 text-green-800 border-green-300",
    PHONE_NUMBER: "bg-purple-100 text-purple-800 border-purple-300",
    CREDIT_CARD: "bg-red-100 text-red-800 border-red-300",
    US_SSN: "bg-orange-100 text-orange-800 border-orange-300",
    LOCATION: "bg-teal-100 text-teal-800 border-teal-300",
    DATE_TIME: "bg-yellow-100 text-yellow-800 border-yellow-300",
    IP_ADDRESS: "bg-pink-100 text-pink-800 border-pink-300",
    URL: "bg-indigo-100 text-indigo-800 border-indigo-300",
    MEDICAL_RECORD: "bg-rose-100 text-rose-800 border-rose-300",
    AGE: "bg-amber-100 text-amber-800 border-amber-300",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Shield className="w-12 h-12 text-indigo-600" />
              <div>
                <h1 className="text-4xl font-bold text-gray-900">
                  Clinical Data De-identification System
                </h1>
                <p className="text-gray-600 mt-1">
                  Process text, patient data tables, and clinical notes
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("text")}
              className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all ${
                activeTab === "text"
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <FileText className="w-5 h-5" />
              Text Input
            </button>
            <button
              onClick={() => setActiveTab("patient")}
              className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all ${
                activeTab === "patient"
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Database className="w-5 h-5" />
              Patient Data CSV
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all ${
                activeTab === "notes"
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <FileText className="w-5 h-5" />
              Clinical Notes CSV
            </button>
          </div>

          {/* Configuration Section - Common for all tabs */}
          <div className="grid md:grid-cols-2 gap-6 mb-6 p-6 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                De-identification Method
              </label>
              <div className="space-y-2">
                {anonymizationMethods.map((method) => (
                  <label
                    key={method.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      anonymizationMethod === method.value
                        ? "border-indigo-500 bg-white"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="method"
                      value={method.value}
                      checked={anonymizationMethod === method.value}
                      onChange={(e) => setAnonymizationMethod(e.target.value)}
                      className="mt-1 w-4 h-4 text-indigo-600"
                    />
                    <div>
                      <div className="font-medium text-gray-900">
                        {method.label}
                      </div>
                      <div className="text-xs text-gray-600">{method.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Entity Types to Detect
              </label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(selectedEntities).map(
                  ([entity, isSelected]) => (
                    <label
                      key={entity}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "border-indigo-300 bg-white"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleEntity(entity)}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {entity.replace(/_/g, " ")}
                      </span>
                    </label>
                  )
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Detection Threshold: {threshold.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0.0 (Less Strict)</span>
                  <span>1.0 (More Strict)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Text Input Tab */}
          {activeTab === "text" && (
            <div>
              <div className="flex justify-end mb-3">
                <button
                  onClick={loadSample}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Load Sample Text
                </button>
              </div>

              <div className="grid lg:grid-cols-2 gap-6 mb-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-gray-700">
                      Input Text
                    </label>
                    <button
                      onClick={clearAll}
                      className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear
                    </button>
                  </div>
                  <textarea
                    className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                    placeholder="Enter or paste text containing PII..."
                    value={inputText}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    Processed Output
                  </label>
                  <div className="w-full h-64 p-4 bg-gray-50 border-2 border-gray-300 rounded-lg overflow-auto">
                    {processedText ? (
                      <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">
                        {processedText}
                      </pre>
                    ) : (
                      <p className="text-gray-400 italic">
                        Processed text will appear here...
                      </p>
                    )}
                  </div>
                  {processedText && (
                    <button
                      onClick={downloadResult}
                      className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download Result
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={analyzeText}
                disabled={!inputText.trim()}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2 text-lg shadow-lg"
              >
                <Shield className="w-6 h-6" />
                Analyze & De-identify Text
              </button>
            </div>
          )}

          {/* Patient Data CSV Tab */}
          {(activeTab === "patient" || activeTab === "notes") && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">
                    {activeTab === "patient"
                      ? "Patient Data CSV Format:"
                      : "Clinical Notes CSV Format:"}
                  </p>
                  <p>
                    {activeTab === "patient"
                      ? "Upload a CSV file with patient information (columns: Patient Name, Age, MRN, Email, Phone, etc.). Select which columns to de-identify."
                      : "Upload a CSV file with clinical notes (must have a column containing the clinical text/notes). All text content will be scanned for PII."}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mb-6">
                <label className="flex-1 cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-700 font-medium mb-1">
                      Click to upload CSV file
                    </p>
                    <p className="text-sm text-gray-500">or drag and drop</p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </label>

                <button
                  onClick={loadSampleCSV}
                  className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Load Sample CSV
                </button>
              </div>

              {csvData.length > 0 && (
                <>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Select Columns to De-identify ({selectedColumns.length}/
                        {csvHeaders.length})
                      </h3>
                      <button
                        onClick={clearCSV}
                        className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear CSV
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {csvHeaders.map((header) => (
                        <label
                          key={header}
                          className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedColumns.includes(header)
                              ? "border-indigo-300 bg-indigo-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedColumns.includes(header)}
                            onChange={() => toggleColumn(header)}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {header}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6 max-h-96 overflow-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          {csvHeaders.map((header) => (
                            <th
                              key={header}
                              className="px-4 py-3 text-left font-semibold text-gray-700 border-b"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(processedCsvData.length > 0
                          ? processedCsvData
                          : csvData
                        )
                          .slice(0, 10)
                          .map((row, idx) => (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              {csvHeaders.map((header) => (
                                <td
                                  key={header}
                                  className="px-4 py-3 text-gray-800"
                                >
                                  {row[header]}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {csvData.length > 10 && (
                      <div className="p-3 bg-gray-50 text-center text-sm text-gray-600">
                        Showing 10 of {csvData.length} rows
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={processCSV}
                      disabled={processing || selectedColumns.length === 0}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2 text-lg shadow-lg"
                    >
                      {processing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <Shield className="w-6 h-6" />
                          Process CSV Data
                        </>
                      )}
                    </button>

                    {processedCsvData.length > 0 && (
                      <button
                        onClick={downloadCSV}
                        className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-lg"
                      >
                        <Download className="w-5 h-5" />
                        Download CSV
                      </button>
                    )}
                  </div>

                  {processedCsvData.length > 0 && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-800 font-medium">
                        Successfully processed {processedCsvData.length} rows.
                        Review the table above and download when ready.
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Detection Results */}
          {activeTab === "text" && detectedEntities.length > 0 && (
            <div className="mt-8 bg-gray-50 rounded-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Detection Results ({detectedEntities.length} entities found)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Entity Type
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Original Value
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Position
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Confidence
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detectedEntities.map((entity, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-gray-100 hover:bg-white"
                      >
                        <td className="py-3 px-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              entityColors[entity.entity_type]
                            }`}
                          >
                            {entity.entity_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-800">
                          {entity.text}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {entity.start}-{entity.end}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-24">
                              <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${entity.score * 100}%` }}
                              />
                            </div>
                            <span className="text-gray-700 font-medium">
                              {(entity.score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PIIAnonymizer;
