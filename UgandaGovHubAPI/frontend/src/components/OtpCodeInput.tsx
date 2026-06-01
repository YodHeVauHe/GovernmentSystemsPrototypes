type OtpCodeInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  required?: boolean;
};

export function OtpCodeInput({
  id,
  value,
  onChange,
  ariaDescribedBy,
  ariaInvalid,
  required,
}: OtpCodeInputProps) {
  const digits = Array.from({ length: 6 }, (_, index) => value[index] || '');

  return (
    <div className="group relative mt-2 block w-full">
      <input
        id={id}
        value={value}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        aria-label="Six-digit authenticator code"
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        required={required}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
        onChange={event => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      <div className="grid w-full grid-cols-6 gap-1.5">
        {digits.map((digit, index) => (
          <div
            key={index}
            className="flex h-10 min-w-0 items-center justify-center rounded-md border border-border bg-background font-mono text-base font-semibold text-foreground transition-colors group-focus-within:border-[#3ecf8e]"
            aria-hidden="true"
          >
            {digit}
          </div>
        ))}
      </div>
    </div>
  );
}
