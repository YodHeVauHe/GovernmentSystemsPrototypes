const HTTP_STATUS_TEXT: Record<number, string> = {
  0: 'Network Error',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export function httpStatusText(status: number | string) {
  const numericStatus = Number(status);
  return Number.isFinite(numericStatus) ? HTTP_STATUS_TEXT[numericStatus] || 'Response' : 'Response';
}

export function formatHttpStatusLabel(status: number | string, fallbackText?: string) {
  const numericStatus = Number(status);
  if (!Number.isFinite(numericStatus)) return String(status || fallbackText || 'Response');
  const text = fallbackText && fallbackText.trim() ? fallbackText.trim() : httpStatusText(numericStatus);
  return `${numericStatus} ${text}`;
}

export function isSuccessStatus(status: number | string) {
  const numericStatus = Number(status);
  return Number.isFinite(numericStatus) && numericStatus >= 200 && numericStatus < 300;
}
