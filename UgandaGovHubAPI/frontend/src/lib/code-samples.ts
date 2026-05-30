export type CodeSampleInput = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type CodeSample = {
  language: 'cURL' | 'JavaScript' | 'Python' | 'Java';
  value: string;
};

function hasRequestBody(body: unknown) {
  return body !== undefined && body !== null && body !== '';
}

function jsonLiteral(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function jsonBodyLiteral(body: unknown) {
  return hasRequestBody(body) ? jsonLiteral(body) : '';
}

function escapePythonString(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function pythonLiteral(value: unknown, indent = 4): string {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'None';
  if (typeof value === 'string') return `'${escapePythonString(value)}'`;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const childIndent = ' '.repeat(indent + 4);
    const closingIndent = ' '.repeat(indent);
    return `[\n${value.map(item => `${childIndent}${pythonLiteral(item, indent + 4)}`).join(',\n')}\n${closingIndent}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const childIndent = ' '.repeat(indent + 4);
    const closingIndent = ' '.repeat(indent);
    return `{\n${entries.map(([key, nestedValue]) => `${childIndent}${pythonLiteral(key)}: ${pythonLiteral(nestedValue, indent + 4)}`).join(',\n')}\n${closingIndent}}`;
  }
  return 'None';
}

function pythonBodyLiteral(body: unknown) {
  return hasRequestBody(body) ? pythonLiteral(body) : '';
}

function javaBodyLiteral(body: unknown) {
  if (!hasRequestBody(body)) return '';
  if (typeof body === 'string') return body;
  return jsonLiteral(body);
}

function escapeShell(value: string) {
  return value.replace(/'/g, "'\\''");
}

function shellSingleQuoted(value: string) {
  return `'${escapeShell(value)}'`;
}

function escapeJava(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export function buildCodeSamples(input: CodeSampleInput): CodeSample[] {
  const method = input.method.toUpperCase();
  const hasBody = hasRequestBody(input.body);
  const headers = {
    'X-GovHub-API-Key': 'your_api_key',
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(input.headers || {}),
  };
  const jsonBody = jsonBodyLiteral(input.body);
  const pythonBody = pythonBodyLiteral(input.body);
  const javaBody = javaBodyLiteral(input.body);
  const headerEntries = Object.entries(headers);

  const curlHeaders = headerEntries.map(([key, value]) => `  -H ${shellSingleQuoted(`${key}: ${value}`)} \\`).join('\n');
  const curlBody = jsonBody ? `\n  -d ${shellSingleQuoted(jsonBody)}` : '';

  const javascriptBody = jsonBody ? `,\n  body: JSON.stringify(${jsonLiteral(input.body)})` : '';
  const pythonJsonBody = pythonBody ? `,\n    json=${pythonBody}` : '';
  const javaRequestBody = javaBody
    ? `.POST(HttpRequest.BodyPublishers.ofString("${escapeJava(javaBody)}"))`
    : method === 'GET'
      ? '.GET()'
      : `.method("${escapeJava(method)}", HttpRequest.BodyPublishers.noBody())`;

  return [
    {
      language: 'cURL',
      value: `curl -X ${shellSingleQuoted(method)} ${shellSingleQuoted(input.url)} \\\n${curlHeaders}${curlBody}`,
    },
    {
      language: 'JavaScript',
      value: `const response = await fetch(${jsonLiteral(input.url)}, {\n  method: ${jsonLiteral(method)},\n  headers: ${JSON.stringify(headers, null, 2)}${javascriptBody}\n});\n\nconst data = await response.json();\nconsole.log(data);`,
    },
    {
      language: 'Python',
      value: `import requests\n\nresponse = requests.request(\n    ${pythonLiteral(method)},\n    ${pythonLiteral(input.url)},\n    headers=${pythonLiteral(headers)}${pythonJsonBody}\n)\n\nprint(response.json())`,
    },
    {
      language: 'Java',
      value: `import java.net.URI;\nimport java.net.http.HttpClient;\nimport java.net.http.HttpRequest;\nimport java.net.http.HttpResponse;\n\nHttpClient client = HttpClient.newHttpClient();\nHttpRequest request = HttpRequest.newBuilder()\n    .uri(URI.create("${escapeJava(input.url)}"))\n${headerEntries.map(([key, value]) => `    .header("${escapeJava(key)}", "${escapeJava(value)}")`).join('\n')}\n    ${javaRequestBody}\n    .build();\n\nHttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\nSystem.out.println(response.body());`,
    },
  ];
}
