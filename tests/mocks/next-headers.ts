type CookieRecord = {
  name: string;
  value: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
};

const store = new Map<string, CookieRecord>();

export function __resetCookieStore(): void {
  store.clear();
}

export function __getCookieRecord(name: string): CookieRecord | undefined {
  return store.get(name);
}

type CookieSetOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none" | "Lax" | "Strict" | "None";
  path?: string;
  maxAge?: number;
};

function normalizeSameSite(
  value: CookieSetOptions["sameSite"],
): CookieRecord["sameSite"] {
  if (!value) {
    return undefined;
  }
  const lower = value.toLowerCase();
  if (lower === "lax" || lower === "strict" || lower === "none") {
    return lower;
  }
  return undefined;
}

export async function cookies() {
  return {
    get(name: string) {
      const record = store.get(name);
      return record ? { name: record.name, value: record.value } : undefined;
    },
    set(
      nameOrOptions:
        | string
        | ({ name: string; value: string } & CookieSetOptions),
      value?: string,
      options?: CookieSetOptions,
    ) {
      if (typeof nameOrOptions === "string") {
        store.set(nameOrOptions, {
          name: nameOrOptions,
          value: value ?? "",
          httpOnly: options?.httpOnly,
          secure: options?.secure,
          sameSite: normalizeSameSite(options?.sameSite),
          path: options?.path,
          maxAge: options?.maxAge,
        });
        return;
      }
      store.set(nameOrOptions.name, {
        name: nameOrOptions.name,
        value: nameOrOptions.value,
        httpOnly: nameOrOptions.httpOnly,
        secure: nameOrOptions.secure,
        sameSite: normalizeSameSite(nameOrOptions.sameSite),
        path: nameOrOptions.path,
        maxAge: nameOrOptions.maxAge,
      });
    },
    delete(name: string) {
      store.delete(name);
    },
    getAll() {
      return [...store.values()].map(({ name, value }) => ({ name, value }));
    },
    has(name: string) {
      return store.has(name);
    },
  };
}

export async function headers() {
  return new Headers();
}
