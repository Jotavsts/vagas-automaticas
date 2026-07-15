import axios from 'axios'

const API_BASE = 'http://localhost:5000/api'

const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export async function register(formData) {
  const { data } = await api.post('/auth/register', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

export async function getJobs() {
  const { data } = await api.get('/jobs')
  return data
}

export async function collectJobs() {
  const { data } = await api.post('/jobs/collect')
  return data
}

export async function adaptJob(jobId) {
  const { data } = await api.post(`/jobs/${jobId}/adapt`)
  return data
}

export async function getAdaptation(jobId) {
  const { data } = await api.get(`/jobs/${jobId}/adaptation`)
  return data
}

export async function approveJob(jobId) {
  const { data } = await api.post(`/jobs/${jobId}/approve`)
  return data
}

export async function getApplications() {
  const { data } = await api.get('/applications')
  return data
}

export async function getCvs() {
  const { data } = await api.get('/cv')
  return data
}

export async function addCv(formData) {
  const { data } = await api.post('/cv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function renameCv(id, label) {
  const { data } = await api.patch(`/cv/${id}`, { label })
  return data
}

export async function deleteCv(id) {
  const { data } = await api.delete(`/cv/${id}`)
  return data
}
