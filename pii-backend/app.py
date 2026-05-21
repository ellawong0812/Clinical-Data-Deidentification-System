from flask import Flask, request, jsonify
from flask_cors import CORS
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000",
     "http://127.0.0.1:3000", "http://localhost:5002"])
# Initialize Presidio engines
analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'presidio': 'ready'})


@app.route('/api/analyze', methods=['POST'])
def analyze_text():
    try:
        data = request.json
        text = data.get('text', '')
        language = data.get('language', 'en')
        entities = data.get('entities', None)
        threshold = data.get('threshold', 0.5)

        # Analyze text with Presidio
        results = analyzer.analyze(
            text=text,
            language=language,
            entities=entities,
            score_threshold=threshold
        )

        # Convert results to JSON format
        entities_found = []
        for result in results:
            entities_found.append({
                'entity_type': result.entity_type,
                'start': result.start,
                'end': result.end,
                'score': result.score,
                'text': text[result.start:result.end]
            })

        return jsonify({
            'entities': entities_found,
            'count': len(entities_found)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/anonymize', methods=['POST'])
def anonymize_text():
    try:
        data = request.json
        text = data.get('text', '')
        method = data.get('method', 'replace')
        entities = data.get('entities', None)
        threshold = data.get('threshold', 0.5)

        # Analyze first
        analyzer_results = analyzer.analyze(
            text=text,
            language='en',
            entities=entities,
            score_threshold=threshold
        )

        # Map React methods to Presidio operators
        operator_map = {
            'redact': 'redact',
            'replace': 'replace',
            'mask': 'mask',
            'hash': 'hash',
            'encrypt': 'encrypt'
        }

        operator = operator_map.get(method, 'replace')

        # Create operator config for each entity type
        operators = {}
        for result in analyzer_results:
            operators[result.entity_type] = OperatorConfig(operator)

        # Anonymize the text
        anonymized_result = anonymizer.anonymize(
            text=text,
            analyzer_results=analyzer_results,
            operators=operators
        )

        return jsonify({
            'text': anonymized_result.text,
            'items': [{
                'operator': item.operator,
                'entity_type': item.entity_type,
                'start': item.start,
                'end': item.end
            } for item in anonymized_result.items]
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("Starting Presidio Backend Server...")
    print("Server running at http://localhost:5002")
    app.run(debug=True, port=5002, host='0.0.0.0')
