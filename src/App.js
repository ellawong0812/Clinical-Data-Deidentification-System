import React, { useState, useEffect } from "react";
import {
  Shield,
  Download,
  Upload,
  Trash2,
  Info,
  FileText,
  Database,
  AlertCircle,
  Zap,
} from "lucide-react";

const PIIAnonymizer = () => {
  const [activeTab, setActiveTab] = useState("text");
  const [inputText, setText] = useState("");
  const [processedText, setProcessedText] = useState("");
  const [detectedEntities, setDetectedEntities] = useState([]);
  const [threshold, setThreshold] = useState(0.1);
  const [anonymizationMethod, setAnonymizationMethod] = useState("replace");
  const [usePresidio, setUsePresidio] = useState(false);
  const [presidioStatus, setPresidioStatus] = useState("unknown");
  const [isProcessing, setIsProcessing] = useState(false);

  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [processedCsvData, setProcessedCsvData] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [processing, setProcessing] = useState(false);

  const [selectedEntities, setSelectedEntities] = useState({
    PERSON: true,
    HKID: true,
    EMAIL_ADDRESS: true,
    PHONE_NUMBER: true,
    CREDIT_CARD: true,
    HK_HOSPITAL: true,
    LOCATION: true,
    DATE_TIME: true,
    HK_BANK_ACCOUNT: true,
    MEDICAL_LICENSE: true,
    AGE: true,
    HK_ADDRESS: true,
    HK_FLAT: true,
    HK_FLOOR: true,
    HK_BLOCK: true,
    MRN: true,
    AGE: true,
  });

  const API_URL = "http://localhost:5002/api";

  useEffect(() => {
    const checkPresidio = async () => {
      try {
        const response = await fetch(`${API_URL}/health`);
        setPresidioStatus(response.ok ? "connected" : "error");
      } catch {
        setPresidioStatus("disconnected");
      }
    };
    checkPresidio();
  }, []);

  // ─── Patterns ordered carefully to avoid cross-contamination ─────────────
  // IMPORTANT: Credit card MUST come before phone number to prevent partial matches.
  // IMPORTANT: HKID uses lookahead/behind instead of \b because \b fails before '('.
  const patterns = {
    // ── High-confidence structured identifiers first ──────────────────────

    HKID: {
      // FIX: \b fails before '(' — use lookbehind/lookahead instead.
      // Format: A123456(3) or AB123456(A)
      regex: /(?<![A-Za-z\d])[A-Z]{1,2}\d{6}\([0-9A]\)(?![A-Za-z\d])/gi,
      score: 0.98,
    },

    MEDICAL_LICENSE: {
      // Matches: "HKMC Reg. No. MC54321", "MC54321", "DC12345", "PN9999" etc.
      regex:
        /\b(?:(?:HKMC|HKDA|HKNA)\s+Reg\.?\s*No\.?\s*)?(?:MC|DC|DEN|PN|NUR|OT|PT|RAD|OPT|PHARM|MPS)\d{4,8}\b/gi,
      score: 0.93,
    },

    HK_BANK_ACCOUNT: {
      // FIX: Added optional trailing branch suffix -NNN.
      // Format: 3-digit bank code - 6-9 digit account - optional 1-6 digit suffix
      // e.g. 012-345678-001, 024-1234567
      regex: /\b\d{3}-\d{6,9}(?:-\d{1,6})?\b/g,
      score: 0.85,
    },

    EMAIL_ADDRESS: {
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      score: 0.97,
    },

    CREDIT_CARD: {
      // FIX: Must come BEFORE phone number pattern to prevent partial digit overlap.
      // Matches 16 digits in groups of 4 separated by space or dash.
      regex: /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/g,
      score: 0.95,
    },

    PHONE_NUMBER: {
      // Updated: Any 8 digits (0-9 start), optional +852 prefix with common separators.
      // Matches: 9123 4567, 91234567, +852 9123 4567, +852-12345678, 0123 4567, etc.
      regex: /(?:\+852[-.\s]?)?\b\d{4}[\s]?\d{4}\b/g,
      score: 0.88, // Keep same score unless you want to adjust for broader matches
    },

    DATE_TIME: {
      // FIX: Tightened to only match real date patterns — avoids matching phone numbers.
      // Matches DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, YYYY-MM-DD
      regex:
        /\b(?:0?[1-9]|[12]\d|3[01])[\/\-](?:0?[1-9]|1[0-2])[\/\-](?:\d{2}|\d{4})\b|\b\d{4}[\/\-](?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])\b/g,
      score: 0.88,
    },

    AGE: {
      // FIX: Added AGE pattern — was in selectedEntities but missing from patterns.
      // Matches: "aged 45", "age 45", "45 years old", "45yo", "45 y.o."
      regex:
        /\b(?:age|aged?)\s+\d{1,3}\b|\b\d{1,3}\s*(?:years?\s*old|yo|y\.o\.)\b|(?:^|[\s:])age[d]?\s+\d{1,3}/gi,
      score: 0.82,
    },

    HK_ADDRESS: {
      regex:
        /(?:(?:Flat|Unit|Room|Rm|Suite|House|Workshop)\s+[\w]+,?\s+)?(?:\d+\/F,?\s+)?(?:Block\s+[\w]+,?\s+|Tower\s+[\w]+,?\s+)?(?:[A-Za-z0-9\s''-]+(?:Estate|Garden|Centre|Center|Building|Court|Plaza|Tower|House|Villa|Height|Heights|Mansion|Mansions|Place|Point|View|Park),?\s+)?(?:\d+\s+)?[A-Za-z\s]+(?:Road|Street|Avenue|Drive|Lane|Way|Path|Terrace|Rise|Crescent|Close|Square|Rd|St|Ave),?\s+(?:Kowloon|Hong Kong Island|New Territories|NT|Hong Kong)/gi,
      score: 0.82,
    },
    HK_FLAT: {
      // Matches: Flat 12B, Unit A, Room 5, Suite 3B, House 7, No. 12
      regex: /\b(?:Flat|Unit|Room|Rm|Suite|House|No\.?)\s+[\w]+\b/gi,
      score: 0.88,
    },

    HK_FLOOR: {
      // Matches: 12/F, G/F, UG/F, M/F, B1/F, 3/F
      regex: /\b(?:[A-Z]?\d{1,3}|[A-Z]{1,2})\s*\/F\b/gi,
      score: 0.88,
    },

    HK_BLOCK: {
      // Matches: Block 3, Block A, Tower 2, Tower B, Blk 5
      regex: /\b(?:Block|Tower|Blk)\s+[\w]+\b/gi,
      score: 0.88,
    },
    MRN: {
      regex: /\b[A-Z]{2,3}\d{4,10}\b/gi,
      score: 0.95,
    },

    AGE: {
      // UPDATED: Matches "aged 45" OR standalone numbers 1-3 digits long
      // The (?:\b\d{1,3}\b) part matches a number by itself
      regex:
        /\b(?:age|aged?)\s+\d{1,3}\b|\b\d{1,3}\s*(?:years?\s*old|yo|y\.o\.)\b|(?:\b\d{1,3}\b)/gi,
      score: 0.82,
    },
  };

  // ─── HK Hospitals & Clinics ───────────────────────────────────────────────
  // Kept separate from general locations so they get their own entity type.
  const HK_HOSPITALS = [
    // HA Cluster Hospitals
    "Queen Mary Hospital",
    "Pamela Youde Nethersole Eastern Hospital",
    "Ruttonjee Hospital",
    "Tang Shiu Kin Hospital",
    "Tsan Yuk Hospital",
    "Grantham Hospital",
    "Duchess of Kent Children's Hospital",
    "Prince of Wales Hospital",
    "Alice Ho Miu Ling Nethersole Hospital",
    "North District Hospital",
    "Tai Po Hospital",
    "Princess Margaret Hospital",
    "Yan Chai Hospital",
    "Caritas Medical Centre",
    "Pok Oi Hospital",
    "Tuen Mun Hospital",
    "Queen Elizabeth Hospital",
    "Kwong Wah Hospital",
    "Our Lady of Maryknoll Hospital",
    "Wong Tai Sin Hospital",
    "Hong Kong Buddhist Hospital",
    "Pamela Youde Nethersole Hospital",
    "United Christian Hospital",
    "Tseung Kwan O Hospital",
    "Kowloon Hospital",
    // Private
    "Hong Kong Sanatorium",
    "Matilda International Hospital",
    "Hong Kong Adventist Hospital",
    "Canossa Hospital",
    "St. Paul's Hospital",
    "St. Teresa's Hospital",
    "Evangel Hospital",
    "Baptist Hospital",
    "Gleneagles Hospital",
    // Polyclinics (common ones)
    "Kwun Tong Polyclinic",
    "Yau Ma Tei Polyclinic",
    "Sham Shui Po Polyclinic",
    "Cheung Sha Wan Polyclinic",
    "Tuen Mun Polyclinic",
    "Sha Tin Polyclinic",
    "Fanling Polyclinic",
    "Tseung Kwan O Polyclinic",
    "Wan Chai Polyclinic",
    "Causeway Bay Polyclinic",
  ];

  // ─── HK Districts & Areas ─────────────────────────────────────────────────
  const HK_LOCATIONS = [
    // HK Island
    "Central",
    "Admiralty",
    "Sheung Wan",
    "Sai Ying Pun",
    "Kennedy Town",
    "Wan Chai",
    "Causeway Bay",
    "Happy Valley",
    "Tin Hau",
    "North Point",
    "Quarry Bay",
    "Tai Koo",
    "Shau Kei Wan",
    "Chai Wan",
    "Aberdeen",
    "Ap Lei Chau",
    "Stanley",
    "Repulse Bay",
    "The Peak",
    "Mid-Levels",
    // Kowloon
    "Tsim Sha Tsui",
    "Jordan",
    "Yau Ma Tei",
    "Mong Kok",
    "Prince Edward",
    "Sham Shui Po",
    "Cheung Sha Wan",
    "Lai Chi Kok",
    "Mei Foo",
    "Kowloon City",
    "To Kwa Wan",
    "Ma Tau Kok",
    "Ho Man Tin",
    "Hung Hom",
    "Whampoa",
    "Kwun Tong",
    "Ngau Tau Kok",
    "Lam Tin",
    "Yau Tong",
    "Tseung Kwan O",
    "Tiu Keng Leng",
    "Po Lam",
    // New Territories
    "Kwai Chung",
    "Kwai Fong",
    "Tsuen Wan",
    "Sha Tin",
    "Tai Wai",
    "Ma On Shan",
    "Wu Kai Sha",
    "Tai Po",
    "Fanling",
    "Sheung Shui",
    "Tuen Mun",
    "Yuen Long",
    "Tin Shui Wai",
    "Tung Chung",
    "Lantau Island",
    // General
    "Hong Kong Island",
    "Kowloon",
    "New Territories",
    "Hong Kong",
    "HK SAR",
    // Common estate/area suffixes that appear in addresses
    "Tung Chung Estate",
  ];

  // ─── Synthetic replacement data ───────────────────────────────────────────
  const syntheticData = {
    PERSON: [
      "Chan Tai Man",
      "Lee Siu Ming",
      "Cheung Wai Hung",
      "Wong Mei Ling",
      "Lam Chi Keung",
    ],
    HKID: ["A000000(0)", "B111111(1)", "C222222(2)"],
    EMAIL_ADDRESS: ["user@example.hk", "contact@sample.com.hk", "info@demo.hk"],
    PHONE_NUMBER: ["9000 0000", "6111 1111", "5222 2222"],
    CREDIT_CARD: ["0000-0000-0000-0000", "1111-1111-1111-1111"],
    HK_HOSPITAL: ["[HOSPITAL REDACTED]"],
    LOCATION: [
      "Kwun Tong",
      "Sha Tin",
      "Tuen Mun",
      "Yuen Long",
      "Tseung Kwan O",
    ],
    DATE_TIME: ["01/01/2000", "31/12/1999"],
    AGE: ["aged [AGE]", "[AGE] years old"],
    HK_BANK_ACCOUNT: ["012-000000-000", "024-111111-111"],
    MEDICAL_LICENSE: ["MC00000"],
    HK_ADDRESS: [
      "Flat 1A, 1/F, Block 1, Sample Estate, Kwun Tong, Kowloon",
      "Unit B, 2/F, Demo Building, 1 Example Street, Central, Hong Kong",
    ],
    HK_FLAT: ["Flat 1A", "Unit B", "Room 3", "Suite 2C"],
    HK_FLOOR: ["1/F", "2/F", "G/F"],
    HK_BLOCK: ["Block 1", "Tower A", "Block 2"],
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

  const encryptString = (str) =>
    btoa(unescape(encodeURIComponent(str))).substring(0, 16) + "...";

  const synthesizeData = (entityType, text) => {
    const pool = syntheticData[entityType] || ["[SYNTHETIC]"];
    const idx = parseInt(hashString(text).substring(0, 2), 16) % pool.length;
    return pool[idx];
  };

  const maskString = (str, entityType) => {
    if (entityType === "HK_FLAT") {
      // Keep the label (Flat/Unit/Room), mask the number
      const parts = str.split(/\s+/);
      return parts[0] + " ***";
    }
    if (entityType === "HK_FLOOR") {
      // Mask the floor number, keep /F
      return "***/F";
    }
    if (entityType === "HK_BLOCK") {
      // Keep Block/Tower, mask the identifier
      const parts = str.split(/\s+/);
      return parts[0] + " ***";
    }
    if (entityType === "EMAIL_ADDRESS") {
      const parts = str.split("@");
      if (parts.length === 2)
        return parts[0].substring(0, 2) + "***@" + parts[1];
    }
    if (entityType === "HKID") return str.substring(0, 1) + "******(*)";
    if (entityType === "PHONE_NUMBER") return str.replace(/\d(?=\d{4})/g, "*");
    if (entityType === "CREDIT_CARD")
      return "**** **** **** " + str.replace(/[\s-]/g, "").slice(-4);
    if (entityType === "HK_BANK_ACCOUNT")
      return str.split("-")[0] + "-" + "*".repeat(6) + "-***";
    const vis = Math.min(3, Math.floor(str.length / 3));
    return str.substring(0, vis) + "*".repeat(Math.max(3, str.length - vis));
  };

  const applyAnonymization = (text, entityType) => {
    switch (anonymizationMethod) {
      case "redact":
        return "[REDACTED]";
      case "replace":
        return `<${entityType}>`;
      case "synthesize":
        return synthesizeData(entityType, text);
      case "mask":
        return maskString(text, entityType);
      case "hash":
        return hashString(text);
      case "encrypt":
        return encryptString(text);
      default:
        return `<${entityType}>`;
    }
  };

  // ─── Presidio API ─────────────────────────────────────────────────────────
  const analyzeWithPresidio = async (text) => {
    try {
      const enabledEntities = Object.entries(selectedEntities)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          language: "en",
          entities: enabledEntities.length > 0 ? enabledEntities : null,
          threshold,
        }),
      });
      if (!response.ok) throw new Error("Presidio error");
      return (await response.json()).entities;
    } catch {
      alert(
        "Failed to connect to Presidio backend. Falling back to rule-based detection."
      );
      return null;
    }
  };

  const anonymizeWithPresidio = async (text) => {
    try {
      const enabledEntities = Object.entries(selectedEntities)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const response = await fetch(`${API_URL}/anonymize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          method: anonymizationMethod,
          entities: enabledEntities.length > 0 ? enabledEntities : null,
          threshold,
        }),
      });
      if (!response.ok) throw new Error("Presidio error");
      return (await response.json()).text;
    } catch {
      return null;
    }
  };

  // ─── Rule-based detection ─────────────────────────────────────────────────

  // FIX: detectNames is now much more conservative.
  // Only matches sequences of 2–4 TitleCase words that are NOT known locations,
  // hospitals, or common clinical/non-name words.
  const NON_NAME_WORDS = new Set([
    "Patient",
    "Doctor",
    "Dr",
    "Mr",
    "Mrs",
    "Ms",
    "Prof",
    "Flat",
    "Block",
    "Estate",
    "Road",
    "Street",
    "Avenue",
    "Drive",
    "Lane",
    "Court",
    "Tower",
    "Hospital",
    "Polyclinic",
    "Clinic",
    "Centre",
    "Center",
    "Medical",
    "Queen",
    "Mary",
    "Prince",
    "Princess",
    "Alice",
    "United",
    "Christian",
    "Hong",
    "Kong",
    "Kowloon",
    "Island",
    "Lantau",
    "New",
    "Territories",
    "North",
    "South",
    "East",
    "West",
    "Upper",
    "Lower",
    "Tung",
    "Chung",
    "Kwun",
    "Tong",
    "Sha",
    "Tin",
    "Yuen",
    "Long",
    "Referred",
    "Follow",
    "Contact",
    "Address",
    "Account",
    "Bank",
    "Credit",
    "Attending",
    "Physician",
    "Admitted",
    "Diagnosis",
    "HKMC",
    "HKDA",
    "Reg",
    "No",
    "MPF",
    "MRN",
    "HKID",
  ]);

  const detectNames = (text) => {
    const results = [];
    // Match sequences of 2-4 consecutive TitleCase words
    const nameSeqRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
    let match;
    while ((match = nameSeqRegex.exec(text)) !== null) {
      const words = match[1].split(/\s+/);
      // Skip if any word is a known non-name
      if (words.some((w) => NON_NAME_WORDS.has(w))) continue;
      // Skip if the full phrase is a known hospital or location
      const phrase = match[1];
      if (HK_HOSPITALS.some((h) => h.toLowerCase() === phrase.toLowerCase()))
        continue;
      if (HK_LOCATIONS.some((l) => l.toLowerCase() === phrase.toLowerCase()))
        continue;
      results.push({
        entity_type: "PERSON",
        start: match.index,
        end: match.index + match[0].length,
        score: 0.72,
        text: match[1],
      });
    }
    return results;
  };

  const detectHospitals = (text) => {
    const results = [];
    HK_HOSPITALS.forEach((h) => {
      // Use case-insensitive search, not regex special chars issue
      const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "gi");
      let match;
      while ((match = regex.exec(text)) !== null) {
        results.push({
          entity_type: "HK_HOSPITAL",
          start: match.index,
          end: match.index + match[0].length,
          score: 0.95,
          text: match[0],
        });
      }
    });
    return results;
  };

  const detectLocations = (text) => {
    const results = [];
    HK_LOCATIONS.forEach((loc) => {
      const escaped = loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "gi");
      let match;
      while ((match = regex.exec(text)) !== null) {
        results.push({
          entity_type: "LOCATION",
          start: match.index,
          end: match.index + match[0].length,
          score: 0.85,
          text: match[0],
        });
      }
    });
    return results;
  };

  const detectEntitiesInText = (text) => {
    let entities = [];

    // Run regex patterns (order matters — credit card before phone)
    Object.entries(patterns).forEach(([entityType, pattern]) => {
      if (!selectedEntities[entityType]) return;
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
    });

    // Run dictionary-based detectors
    if (selectedEntities.HK_HOSPITAL)
      entities = entities.concat(
        detectHospitals(text).filter((e) => e.score >= threshold)
      );
    if (selectedEntities.LOCATION)
      entities = entities.concat(
        detectLocations(text).filter((e) => e.score >= threshold)
      );
    if (selectedEntities.PERSON)
      entities = entities.concat(
        detectNames(text).filter((e) => e.score >= threshold)
      );

    // Sort by start position
    entities.sort((a, b) => a.start - b.start);

    // Merge overlaps — higher score wins
    const merged = [];
    for (const entity of entities) {
      const overlap = merged.find(
        (e) =>
          (entity.start >= e.start && entity.start < e.end) ||
          (entity.end > e.start && entity.end <= e.end) ||
          (entity.start <= e.start && entity.end >= e.end)
      );
      if (!overlap) {
        merged.push(entity);
      } else if (entity.score > overlap.score) {
        merged[merged.indexOf(overlap)] = entity;
      }
    }

    return merged;
  };

  ///========== newly added
  // Place this at component level, before analyzeText and anonymizeText
  const mergeEntities = (ruleEntities, presidioEntities) => {
    const allEntities = [...(ruleEntities || []), ...(presidioEntities || [])];
    allEntities.sort((a, b) => a.start - b.start);
    const merged = [];
    for (const entity of allEntities) {
      const overlap = merged.find(
        (e) => entity.start < e.end && entity.end > e.start
      );
      if (!overlap) {
        merged.push(entity);
      } else if (entity.score > overlap.score) {
        merged[merged.indexOf(overlap)] = entity;
      }
    }
    return merged;
  };

  // const anonymizeText = async (text) => {
  //   if (usePresidio && presidioStatus === "connected") {
  //     const result = await anonymizeWithPresidio(text);
  //     if (result) return result;
  //   }
  //   const entities = detectEntitiesInText(text);
  //   let result = text;
  //   let offset = 0;
  //   entities.forEach((entity) => {
  //     const replacement = applyAnonymization(entity.text, entity.entity_type);
  //     result =
  //       result.substring(0, entity.start + offset) +
  //       replacement +
  //       result.substring(entity.end + offset);
  //     offset += replacement.length - (entity.end - entity.start);
  //   });
  //   return result;
  // };
  const anonymizeText = async (text, mergedEntities) => {
    // Always use rule-based entities as the source of truth.
    // If mergedEntities is passed in (from analyzeText), use those.
    // Otherwise, compute them fresh (e.g. for CSV processing).
    let entities = mergedEntities;

    if (!entities) {
      const ruleEntities = detectEntitiesInText(text);
      if (usePresidio && presidioStatus === "connected") {
        try {
          const presidioEntities = await analyzeWithPresidio(text);
          if (presidioEntities?.length > 0) {
            entities = mergeEntities(ruleEntities, presidioEntities);
          } else {
            entities = ruleEntities;
          }
        } catch {
          entities = ruleEntities;
        }
      } else {
        entities = ruleEntities;
      }
    }

    let result = text;
    let offset = 0;
    entities.forEach((entity) => {
      const replacement = applyAnonymization(entity.text, entity.entity_type);
      result =
        result.substring(0, entity.start + offset) +
        replacement +
        result.substring(entity.end + offset);
      offset += replacement.length - (entity.end - entity.start);
    });
    return result;
  };
  const analyzeText = async () => {
    if (!inputText.trim()) {
      setProcessedText("");
      setDetectedEntities([]);
      return;
    }

    setIsProcessing(true);
    try {
      const ruleEntities = detectEntitiesInText(inputText);

      let entities = ruleEntities;
      if (usePresidio && presidioStatus === "connected") {
        try {
          const presidioEntities = await analyzeWithPresidio(inputText);
          if (presidioEntities?.length > 0) {
            entities = mergeEntities(ruleEntities, presidioEntities);
          }
        } catch (err) {
          console.log("Presidio failed, using rule-based only:", err.message);
        }
      }

      setDetectedEntities(entities);
      setProcessedText(await anonymizeText(inputText, entities));
    } catch (error) {
      console.error("Analysis error:", error);
      alert("An error occurred during analysis.");
      const fallbackEntities = detectEntitiesInText(inputText);
      setDetectedEntities(fallbackEntities);
      setProcessedText(await anonymizeText(inputText, fallbackEntities));
    } finally {
      setIsProcessing(false);
    }
  };
  // const analyzeText = async () => {
  //   if (!inputText.trim()) {
  //     setProcessedText("");
  //     setDetectedEntities([]);
  //     return;
  //   }
  //   setIsProcessing(true);
  //   try {
  //     let entities;
  //     if (usePresidio && presidioStatus === "connected") {
  //       entities = await analyzeWithPresidio(inputText);
  //       if (!entities) entities = detectEntitiesInText(inputText);
  //     } else {
  //       entities = detectEntitiesInText(inputText);
  //     }
  //     setDetectedEntities(entities);
  //     setProcessedText(await anonymizeText(inputText));
  //   } catch (error) {
  //     console.error("Analysis error:", error);
  //     alert("An error occurred during analysis.");
  //   } finally {
  //     setIsProcessing(false);
  //   }
  // };

  // ─── CSV handlers ─────────────────────────────────────────────────────────
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (e) => parseCSV(e.target.result);
      reader.readAsText(file);
    } else {
      alert("Please upload a valid CSV file.");
    }
  };

  const parseCSV = (text) => {
    const lines = text.split("\n").filter((l) => l.trim());
    if (!lines.length) return;
    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().replace(/^"|"$/g, ""));
    setCsvHeaders(headers);
    setSelectedColumns(headers);
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ? values[idx].trim().replace(/^"|"$/g, "") : "";
      });
      data.push(row);
    }
    setCsvData(data);
    setProcessedCsvData([]);
  };

  const processCSV = async () => {
    if (!csvData.length) return;
    setProcessing(true);
    try {
      const processed = await Promise.all(
        csvData.map(async (row) => {
          const newRow = { ...row };
          for (const col of selectedColumns) {
            if (row[col]) newRow[col] = await anonymizeText(row[col]);
          }
          return newRow;
        })
      );
      setProcessedCsvData(processed);
    } catch (error) {
      console.error("CSV error:", error);
      alert("An error occurred during CSV processing.");
    } finally {
      setProcessing(false);
    }
  };

  const downloadCSV = () => {
    if (!processedCsvData.length) return;
    const headers = csvHeaders.join(",");
    const rows = processedCsvData
      .map((row) =>
        csvHeaders
          .map((h) => `"${(row[h] || "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anonymized_data_hk.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadResult = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([processedText], { type: "text/plain" })
    );
    a.download = "anonymized_text_hk.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleColumn = (col) =>
    setSelectedColumns((p) =>
      p.includes(col) ? p.filter((c) => c !== col) : [...p, col]
    );
  const toggleEntity = (e) =>
    setSelectedEntities((p) => ({ ...p, [e]: !p[e] }));
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

  const loadSample = () =>
    setText(
      "Chan Tai Man (HKID: A123456(3)), aged 45, was admitted to Queen Mary Hospital on 15/12/2024. " +
        "Contact: 9123 4567, chan.tm@email.hk. Address: Flat 12B, Block 3, Tung Chung Estate, Tung Chung, Lantau Island. " +
        "Bank: 012-345678-001. " +
        "Credit card: 4532-1234-5678-9010.  " +
        "Attending physician: Dr. Sarah Lam (HKMC Reg. No. MC54321). " +
        "Referred from Kwun Tong Polyclinic on 10/12/2024. Follow-up at Sha Tin."
    );

  //   const loadSampleCSV = () => {
  //     const sampleData = `"Patient Name","Age","MRN","HKID","Email","Phone","Diagnosis","Address"
  // "Chan Tai Man","45","MRN1234567","A123456(3)","chan.tm@email.hk","9123 4567","Hypertension","Kwun Tong, Kowloon"
  // "Lee Siu Ming","32","MRN7654321","B654321(2)","lee.sm@hospital.hk","6987 6543","Diabetes","Sha Tin, NT"
  // "Cheung Wai Hung","67","MRN9876543","C246810(5)","cheung.wh@clinic.hk","5456 7890","Arthritis","Tuen Mun, NT"`;
  //     parseCSV(sampleData);
  //   };
  const loadSamplePatientCSV = () => {
    const sampleData = `"Patient Name","Age","MRN","HKID","Email","Phone","Diagnosis","Address"
  "Chan Tai Man","45","MRN1234567","A123456(3)","chan.tm@email.hk","9123 4567","Hypertension","Kwun Tong, Kowloon"
  "Lee Siu Ming","32","MRN7654321","B654321(2)","lee.sm@hospital.hk","6987 6543","Diabetes","Sha Tin, NT"
  "Cheung Wai Hung","67","MRN9876543","C246810(5)","cheung.wh@clinic.hk","5456 7890","Arthritis","Tuen Mun, NT"`;
    parseCSV(sampleData);
  };

  const loadSampleClinicalCSV = () => {
    const sampleData = `"Clinical Notes"
  "Chan Tai Man (HKID: A123456(3)), aged 45, was admitted to Queen Mary Hospital on 15/12/2024 with chest pain. Contact: 9123 4567, chan.tm@email.hk. Residing at Flat 12B, Block 3, Tung Chung Estate, Lantau Island. Attending physician: Dr. Sarah Lam (HKMC Reg. No. MC54321)."
  "Lee Siu Ming (HKID: B654321(2)), aged 32, presented to Kwun Tong Polyclinic on 10/12/2024 with persistent cough. Phone: 6987 6543. Address: Unit 5, 8/F, Tower 2, Sha Tin Centre, Sha Tin, NT. HK Passport: K87654321."
  "Cheung Wai Hung (HKID: C246810(5)), aged 67, referred from Tuen Mun Hospital on 05/12/2024. MPF Account: MPF-87654321. Bank: 024-345678-001. Credit card: 4532-9876-5432-1010. Follow-up scheduled at Sha Tin on 20/01/2025."
  "Wong Mei Ling (HKID: D135790(7)), aged 28, diagnosed with anxiety disorder. Email: wong.ml@email.hk. Phone: 5456 7890. Residing at Room 3, G/F, Block A, Yuen Long Centre, Yuen Long, NT. Referred by Dr. Chan Wai (MC67890)."
  "Lam Chi Keung (HKID: E987654(2)), aged 55, post-operative follow-up at Queen Elizabeth Hospital on 12/12/2024. IP: 192.168.1.45. Emergency contact: 9876 5432. Address: Flat 8C, 15/F, Tower 3, Hung Hom Estate, Hung Hom, Kowloon."`;
    parseCSV(sampleData);
  };

  // ─── UI config ────────────────────────────────────────────────────────────
  const anonymizationMethods = [
    {
      value: "replace",
      label: "Replace",
      desc: "Replace with entity type tag e.g. <HKID>",
    },
    { value: "redact", label: "Redact", desc: "Replace with [REDACTED]" },
    { value: "mask", label: "Mask", desc: "Partially obscure with asterisks" },
    {
      value: "synthesize",
      label: "Synthesise",
      desc: "Replace with realistic HK synthetic data",
    },
    { value: "hash", label: "Hash", desc: "Replace with a hash value" },
    {
      value: "encrypt",
      label: "Encrypt",
      desc: "Replace with encrypted value",
    },
  ];

  const entityLabels = {
    PERSON: "Person Name",
    HKID: "HK Identity Card",
    EMAIL_ADDRESS: "Email Address",
    PHONE_NUMBER: "Phone Number (HK)",
    CREDIT_CARD: "Credit Card",
    HK_HOSPITAL: "HK Hospital / Polyclinic",
    LOCATION: "HK District / Area",
    DATE_TIME: "Date / Time",
    HK_BANK_ACCOUNT: "HK Bank Account",
    MEDICAL_LICENSE: "Medical / Dental Reg. No.",
    MRN: "Medical Record No. (MRN)",
    AGE: "Age",
    HK_ADDRESS: "HK Street Address",
    HK_FLAT: "Flat / Unit No.",
    HK_FLOOR: "Floor No.",
    HK_BLOCK: "Block / Tower",
  };

  const entityColors = {
    PERSON: "bg-blue-100 text-blue-800 border-blue-300",
    HKID: "bg-red-100 text-red-800 border-red-300",
    EMAIL_ADDRESS: "bg-green-100 text-green-800 border-green-300",
    PHONE_NUMBER: "bg-purple-100 text-purple-800 border-purple-300",
    CREDIT_CARD: "bg-rose-100 text-rose-800 border-rose-300",
    HK_HOSPITAL: "bg-sky-100 text-sky-800 border-sky-300",
    LOCATION: "bg-teal-100 text-teal-800 border-teal-300",
    DATE_TIME: "bg-yellow-100 text-yellow-800 border-yellow-300",
    HK_BANK_ACCOUNT: "bg-cyan-100 text-cyan-800 border-cyan-300",
    MEDICAL_LICENSE: "bg-violet-100 text-violet-800 border-violet-300",
    AGE: "bg-gray-100 text-gray-800 border-gray-300",
    HK_ADDRESS: "bg-orange-100 text-orange-800 border-orange-300",
    HK_FLAT: "bg-orange-100 text-orange-800 border-orange-300",
    HK_FLOOR: "bg-orange-100 text-orange-800 border-orange-300",
    HK_BLOCK: "bg-orange-100 text-orange-800 border-orange-300",
    MRN: "bg-indigo-100 text-indigo-800 border-indigo-300",
  };

  const statusStyles = {
    connected: "bg-green-100 text-green-800 border-green-300",
    disconnected: "bg-red-100 text-red-800 border-red-300",
    error: "bg-yellow-100 text-yellow-800 border-yellow-300",
    unknown: "bg-gray-100 text-gray-800 border-gray-300",
  };

  const statusText = {
    connected: "✓ Presidio Connected",
    disconnected: "✗ Presidio Disconnected",
    error: "⚠ Presidio Error",
    unknown: "⋯ Checking Presidio...",
  };
  const allSelected = Object.values(selectedEntities).every(Boolean);
  const toggleAllEntities = () => {
    const newValue = !allSelected;
    setSelectedEntities((prev) =>
      Object.fromEntries(Object.keys(prev).map((key) => [key, newValue]))
    );
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-2xl p-8 mb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Shield className="w-12 h-12 text-red-700" />
              <div>
                <h1 className="text-4xl font-bold text-gray-900">
                  Clinical Data De-identification System
                </h1>
                <p className="text-gray-500 mt-1 text-sm">
                  Hong Kong Edition · Powered by Presidio
                </p>
              </div>
            </div>
            <div
              className={`px-4 py-2 rounded-lg border-2 font-semibold text-sm ${statusStyles[presidioStatus]}`}
            >
              {statusText[presidioStatus]}
            </div>
          </div>

          {presidioStatus === "connected" && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <Zap className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-900">
                <p className="font-semibold mb-1">
                  Advanced AI Detection Enabled
                </p>
                <p>
                  Using Presidio for enhanced entity recognition, including
                  HK-specific identifiers.
                </p>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePresidio}
                    onChange={(e) => setUsePresidio(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="font-medium">
                    Enable Presidio AI Detection
                  </span>
                </label>
              </div>
            </div>
          )}

          {presidioStatus === "disconnected" && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-900">
                <p className="font-semibold mb-1">
                  Presidio Backend Not Connected
                </p>
                <p>
                  Currently using rule-based detection. To enable AI-powered
                  detection with Presidio, start the Python backend:
                </p>
                <code className="block mt-2 p-2 bg-yellow-100 rounded text-xs">
                  python app.py
                </code>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            {[
              {
                id: "text",
                label: "Text Input",
                icon: <FileText className="w-4 h-4" />,
              },
              {
                id: "patient",
                label: "Patient Data CSV",
                icon: <Database className="w-4 h-4" />,
              },
              {
                id: "notes",
                label: "Clinical Notes CSV",
                icon: <FileText className="w-4 h-4" />,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all ${
                  activeTab === tab.id
                    ? "text-red-700 border-b-2 border-red-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Configuration */}
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
                        ? "border-red-500 bg-white"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="method"
                      value={method.value}
                      checked={anonymizationMethod === method.value}
                      onChange={(e) => setAnonymizationMethod(e.target.value)}
                      className="mt-1 w-4 h-4 text-red-600"
                    />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {method.label}
                      </div>
                      <div className="text-xs text-gray-500">{method.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Entity Types to Detect
                </label>
                <button
                  onClick={toggleAllEntities}
                  className={`text-xs font-semibold px-3 py-1 rounded-lg border-2 transition-all ${
                    allSelected
                      ? "border-red-400 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-gray-300 bg-white text-gray-600 hover:border-red-300 hover:text-red-600"
                  }`}
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mb-4 max-h-64 overflow-y-auto pr-1">
                {Object.entries(selectedEntities).map(
                  ([entity, isSelected]) => (
                    <label
                      key={entity}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "border-red-300 bg-red-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleEntity(entity)}
                        className="w-3.5 h-3.5 text-red-600 rounded"
                      />
                      <span className="text-xs font-medium text-gray-700 leading-tight">
                        {entityLabels[entity] || entity}
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
                  <span>0.0 — Less Strict</span>
                  <span>1.0 — More Strict</span>
                </div>
              </div>
            </div>
          </div>

          {/* Text Tab */}
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
                    className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono text-sm"
                    placeholder="Enter or paste clinical text containing PII (HKID, HK phone numbers, HK addresses, etc.)..."
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
                disabled={!inputText.trim() || isProcessing}
                className="w-full bg-gradient-to-r from-red-700 to-red-500 hover:from-red-800 hover:to-red-600 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2 text-lg shadow-lg"
              >
                {isProcessing ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Shield className="w-6 h-6" />
                    {usePresidio
                      ? "Analyse with Presidio AI"
                      : "Analyse & De-identify"}
                  </>
                )}
              </button>
            </div>
          )}

          {/* CSV Tabs */}
          {(activeTab === "patient" || activeTab === "notes") && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">
                    {activeTab === "patient"
                      ? "Patient Data CSV"
                      : "Clinical Notes CSV"}
                  </p>
                  <p>
                    {activeTab === "patient"
                      ? "Upload a CSV with patient records (e.g. HA CMS export). Select which columns to de-identify."
                      : "Upload a CSV with clinical notes or discharge summaries. All text will be scanned for PII."}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mb-6">
                <label className="flex-1 cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-red-500 hover:bg-red-50 transition-all">
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
                  onClick={
                    activeTab === "patient"
                      ? loadSamplePatientCSV
                      : loadSampleClinicalCSV
                  }
                  className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Load HK Sample
                </button>
              </div>

              {csvData.length > 0 && (
                <>
                  {/* Column Selection Section */}
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
                        Clear
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {csvHeaders.map((header) => (
                        <label
                          key={header}
                          className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedColumns.includes(header)
                              ? "border-red-300 bg-red-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedColumns.includes(header)}
                            onChange={() => toggleColumn(header)}
                            className="w-4 h-4 text-red-600 rounded"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {header}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* New Preview Section: Side-by-Side Tables */}
                  <div
                    className={`grid ${
                      processedCsvData.length > 0
                        ? "lg:grid-cols-2"
                        : "grid-cols-1"
                    } gap-6 mb-6`}
                  >
                    {/* Left: Original Data */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Original Preview
                      </h4>
                      <div className="overflow-auto border rounded-lg max-h-96 bg-white shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              {csvHeaders.map((h) => (
                                <th
                                  key={h}
                                  className="px-4 py-3 text-left font-semibold text-gray-700 border-b whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvData.slice(0, 10).map((row, idx) => (
                              <tr
                                key={idx}
                                className="border-b hover:bg-gray-50"
                              >
                                {csvHeaders.map((h) => (
                                  <td
                                    key={h}
                                    className="px-4 py-3 text-gray-800 whitespace-nowrap"
                                  >
                                    {row[h]}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Right: Anonymized Data (Only shows after processing) */}
                    {processedCsvData.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold text-green-600 uppercase tracking-wider flex items-center gap-2">
                          <Shield className="w-4 h-4" /> De-identified Preview
                        </h4>
                        <div className="overflow-auto border-2 border-green-200 rounded-lg max-h-96 bg-green-50/30 shadow-sm">
                          <table className="w-full text-sm">
                            <thead className="bg-green-100 sticky top-0">
                              <tr>
                                {csvHeaders.map((h) => (
                                  <th
                                    key={h}
                                    className="px-4 py-3 text-left font-semibold text-green-800 border-b whitespace-nowrap"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {processedCsvData.slice(0, 10).map((row, idx) => (
                                <tr
                                  key={idx}
                                  className="border-b border-green-100 hover:bg-green-50"
                                >
                                  {csvHeaders.map((h) => (
                                    <td
                                      key={h}
                                      className={`px-4 py-3 whitespace-nowrap ${
                                        selectedColumns.includes(h)
                                          ? "font-medium text-blue-700"
                                          : "text-gray-500"
                                      }`}
                                    >
                                      {row[h]}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Counter */}
                  {csvData.length > 10 && (
                    <div className="mb-6 p-2 bg-gray-50 border border-dashed border-gray-300 rounded text-center text-xs text-gray-500 italic">
                      Showing first 10 rows of {csvData.length} total records.
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={processCSV}
                      disabled={processing || !selectedColumns.length}
                      className="flex-1 bg-gradient-to-r from-red-700 to-red-500 hover:from-red-800 hover:to-red-600 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2 text-lg shadow-lg"
                    >
                      {processing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <Shield className="w-6 h-6" />
                          {usePresidio
                            ? "Process with Presidio AI"
                            : "Process CSV Data"}
                        </>
                      )}
                    </button>
                    {processedCsvData.length > 0 && (
                      <button
                        onClick={downloadCSV}
                        className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-lg"
                      >
                        <Download className="w-5 h-5" />
                        Download
                      </button>
                    )}
                  </div>

                  {processedCsvData.length > 0 && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-800 font-medium">
                        Successfully processed {processedCsvData.length} rows
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Detection results */}
          {activeTab === "text" && detectedEntities.length > 0 && (
            <div className="mt-8 bg-gray-50 rounded-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Detection Results — {detectedEntities.length}{" "}
                {detectedEntities.length === 1 ? "entity" : "entities"} found
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Value
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
                              entityColors[entity.entity_type] ||
                              "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {entityLabels[entity.entity_type] ||
                              entity.entity_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-800 text-xs">
                          {entity.text}
                        </td>
                        <td className="py-3 px-4 text-gray-500 font-mono text-xs">
                          {entity.start}–{entity.end}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-24">
                              <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${entity.score * 100}%` }}
                              />
                            </div>
                            <span className="text-gray-700 font-medium text-xs">
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
