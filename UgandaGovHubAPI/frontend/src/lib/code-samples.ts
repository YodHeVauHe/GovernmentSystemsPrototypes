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

function stringifyBody(body: unknown) {
  if (body === undefined || body === null || body === '') return '';
  if (typeof body === 'string') return body;
  return JSON.stringify(body, null, 2);
}

function escapeShell(value: string) {
  return value.replace(/'/g, "'\\''");
}

function escapeJava(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export function buildCodeSamples(input: CodeSampleInput): CodeSample[] {
  const method = input.method.toUpperCase();
  const headers = {
    'X-GovHub-API-Key': 'your_api_key',
    ...(input.body ? { 'Content-Type': 'application/json' } : {}),
    ...(input.headers || {}),
  };
  const body = stringifyBody(input.body);
  const headerEntries = Object.entries(headers);

  const curlHeaders = headerEntries.map(([key, value]) => `  -H '${key}: ${escapeShell(value)}' \\`).join('\n');
  const curlBody = body ? `\n  -d '${escapeShell(body)}'` : '';

  const javascriptBody = body ? `,\n  body: JSON.stringify(${body})` : '';
  const pythonBody = body ? `,\n    json=${body}` : '';
  const javaBody = body
    ? `.POST(HttpRequest.BodyPublishers.ofString("${escapeJava(body)}"))`
    : method === 'GET'
      ? '.GET()'
      : `.method("${method}", HttpRequest.BodyPublishers.noBody())`;

  return [
    {
      language: 'cURL',
      value: `curl -X ${method} '${input.url}' \\\n${curlHeaders}${curlBody}`,
    },
    {
      language: 'JavaScript',
      value: `const response = await fetch('${input.url}', {\n  method: '${method}',\n  headers: ${JSON.stringify(headers, null, 2)}${javascriptBody}\n});\n\nconst data = await response.json();\nconsole.log(data);`,
    },
    {
      language: 'Python',
      value: `import requests\n\nresponse = requests.request(\n    '${method}',\n    '${input.url}',\n    headers=${JSON.stringify(headers, null, 2)}${pythonBody}\n)\n\nprint(response.json())`,
    },
    {
      language: 'Java',
      value: `import java.net.URI;\nimport java.net.http.HttpClient;\nimport java.net.http.HttpRequest;\nimport java.net.http.HttpResponse;\n\nHttpClient client = HttpClient.newHttpClient();\nHttpRequest request = HttpRequest.newBuilder()\n    .uri(URI.create("${escapeJava(input.url)}"))\n${headerEntries.map(([key, value]) => `    .header("${escapeJava(key)}", "${escapeJava(value)}")`).join('\n')}\n    ${javaBody}\n    .build();\n\nHttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\nSystem.out.println(response.body());`,
    },
  ];
}
