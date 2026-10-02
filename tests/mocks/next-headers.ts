export async function cookies() {
  return {
    get() {
      return undefined;
    },
    set() {
      return undefined;
    },
    delete() {
      return undefined;
    },
    getAll() {
      return [];
    },
    has() {
      return false;
    },
  };
}

export async function headers() {
  return new Headers();
}
