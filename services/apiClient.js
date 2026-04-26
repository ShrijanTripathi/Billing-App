const API_BASE_URL = "";

function buildUrl(path, query = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    const networkError = new Error(
      "Cannot reach backend API. Please confirm backend server and MongoDB are running."
    );
    networkError.status = 0;
    throw networkError;
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(payload?.message || "Request failed");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export { API_BASE_URL };
