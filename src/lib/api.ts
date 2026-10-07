import axios, { AxiosError } from 'axios'

/**
 * Path prefix of the Spring Boot backend. The browser always calls it on the same origin; nginx (or the Vite dev
 * server) proxies it to the backend Service.
 */
export const BACKEND_PATH = '/devopsportal'

/**
 * Axios instance for the portal BFF. Session cookie auth; Spring Security's XSRF-TOKEN cookie is
 * echoed back as the X-XSRF-TOKEN header automatically by axios for same-origin requests.
 */
export const api = axios.create({
  baseURL: `${BACKEND_PATH}/api`,
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  withXSRFToken: true,
})

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search))
    }
    return Promise.reject(error)
  },
)

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | string | undefined
    if (data && typeof data === 'object' && data.message) return data.message
    if (typeof data === 'string' && data.length < 300 && data) return data
    if (error.response?.status === 403) return 'You do not have permission to perform this action'
    return error.message
  }
  return error instanceof Error ? error.message : String(error)
}

export async function get<T>(url: string, params?: Record<string, unknown>) {
  const { data } = await api.get<T>(url, { params })
  return data
}

export async function post<T>(url: string, body?: unknown, params?: Record<string, unknown>) {
  const { data } = await api.post<T>(url, body, { params })
  return data
}

export async function put<T>(url: string, body?: unknown) {
  const { data } = await api.put<T>(url, body)
  return data
}

export async function patch<T>(url: string, body?: unknown) {
  const { data } = await api.patch<T>(url, body)
  return data
}

export async function del<T = void>(url: string) {
  const { data } = await api.delete<T>(url)
  return data
}

export const enc = encodeURIComponent
