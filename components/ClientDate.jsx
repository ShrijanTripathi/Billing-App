"use client";

import { useEffect, useState } from "react";

export default function ClientDate({ iso, locale = "en-IN", options = {}, fallback = "-" }) {
  const [formatted, setFormatted] = useState(fallback);

  useEffect(() => {
    try {
      if (!iso) {
        setFormatted(fallback);
        return;
      }
      const dt = new Date(iso);
      const str = new Intl.DateTimeFormat(locale, options).format(dt);
      setFormatted(str);
    } catch (e) {
      setFormatted(String(iso || fallback));
    }
  }, [iso, locale, JSON.stringify(options), fallback]);

  return <span suppressHydrationWarning>{formatted}</span>;
}
