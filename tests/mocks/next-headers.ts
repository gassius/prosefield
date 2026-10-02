const store = new Map<string, { name: string; value: string }>();

export function __resetCookieStore(): void {
  store.clear();
}

export async function cookies() {
  return {
    get(name: string) {
      return store.get(name);
    },
    set(
      nameOrOptions: string | { name: string; value: string },
      value?: string,
    ) {
      if (typeof nameOrOptions === "string") {
        store.set(nameOrOptions, {
          name: nameOrOptions,
          value: value ?? "",
        });
        return;
      }
      store.set(nameOrOptions.name, {
        name: nameOrOptions.name,
        value: nameOrOptions.value,
      });
    },
    delete(name: string) {
      store.delete(name);
    },
    getAll() {
      return [...store.values()];
    },
    has(name: string) {
      return store.has(name);
    },
  };
}

export async function headers() {
  return new Headers();
}
