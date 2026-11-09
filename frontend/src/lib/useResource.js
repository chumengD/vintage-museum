import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
export function useResource(path) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    api(path, { signal: controller.signal })
      .then((data) => setState({ path, data, loading: false, error: "" }))
      .catch((error) => {
        if (error.name !== "AbortError")
          setState({ path, data: null, loading: false, error: error.message });
      });
    return () => controller.abort();
  }, [path, revision]);
  return {
    ...(state.path === path ? state : { data: null, loading: true, error: "" }),
    reload,
  };
}
