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

/**
 * @param {FormData} formData - Dados do formulário de cadastro (email, password, arquivo cv)
 * @returns {Promise<{token: string, user: object}>}
 */
export async function register(formData) {
  const { data } = await api.post('/auth/register', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{token: string, user: object}>}
 */
export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

/** @returns {Promise<object[]>} Lista de vagas com score e score_breakdown */
export async function getJobs() {
  const { data } = await api.get('/jobs')
  return data
}

/** @returns {Promise<{totalFound: number, newInserted: number, bySource: object}>} */
export async function collectJobs() {
  const { data } = await api.post('/jobs/collect')
  return data
}

/**
 * @param {number|string} jobId
 * @param {number|string} [cvBaseId] - Se omitido, a IA escolhe o CV automaticamente.
 * @returns {Promise<{adapted: boolean, content?: object, match_score?: number, match_notes?: string}>}
 */
export async function adaptJob(jobId, cvBaseId) {
  const { data } = await api.post(`/jobs/${jobId}/adapt`, cvBaseId ? { cv_base_id: cvBaseId } : {})
  return data
}

/**
 * @param {number|string} jobId
 * @returns {Promise<object>} Dados da adaptação mais recente
 */
export async function getAdaptation(jobId) {
  const { data } = await api.get(`/jobs/${jobId}/adaptation`)
  return data
}

/**
 * @param {number|string} jobId
 * @returns {Promise<{pdfPath: string, openUrl: string}>}
 */
export async function approveJob(jobId) {
  const { data } = await api.post(`/jobs/${jobId}/approve`)
  return data
}

/** @returns {Promise<object[]>} Lista de candidaturas com status */
export async function getApplications() {
  const { data } = await api.get('/applications')
  return data
}

/**
 * @param {number|string} id - ID da candidatura
 * @param {'enviado'|'em_processo'|'oferta'|'rejeitado'|'desistiu'} status
 * @returns {Promise<{id: number, status: string, approved_at: string}>}
 */
export async function updateApplicationStatus(id, status) {
  const { data } = await api.patch(`/applications/${id}/status`, { status })
  return data
}


/** @returns {Promise<object[]>} Lista de CVs cadastrados */
export async function getCvs() {
  const { data } = await api.get('/cv')
  return data
}

/**
 * @param {FormData} formData - Dados com o arquivo do currículo (campo "cv")
 * @returns {Promise<object>} CV cadastrado com label extraído
 */
export async function addCv(formData) {
  const { data } = await api.post('/cv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/**
 * @param {number|string} id
 * @param {string} label
 * @returns {Promise<object>} CV atualizado
 */
export async function renameCv(id, label) {
  const { data } = await api.patch(`/cv/${id}`, { label })
  return data
}

/**
 * @param {number|string} id
 * @returns {Promise<void>}
 */
export async function deleteCv(id) {
  const { data } = await api.delete(`/cv/${id}`)
  return data
}

/** @returns {Promise<{channels: string[]}>} Lista de canais Telegram do usuário */
export async function getChannels() {
  const { data } = await api.get('/channels')
  return data
}

/**
 * @param {string} channel - Username do canal (com ou sem @)
 * @returns {Promise<{channels: string[]}>}
 */
export async function addChannel(channel) {
  const { data } = await api.post('/channels', { channel })
  return data
}

/**
 * @param {string} channel - Username do canal a remover
 * @returns {Promise<{channels: string[]}>}
 */
export async function removeChannel(channel) {
  const { data } = await api.delete(`/channels/${channel}`)
  return data
}

/** @returns {Promise<{wildcard: object}>} Currículo coringa do usuário */
export async function getWildcardCv() {
  const { data } = await api.get('/cv/wildcard')
  return data
}

/** @returns {Promise<{adapted: boolean, wildcard?: object, reason?: string}>} */
export async function generateWildcardCv() {
  const { data } = await api.post('/cv/wildcard')
  return data
}

/** @returns {Promise<{pdfPath: string, downloadUrl: string}>} */
export async function downloadWildcardPdf() {
  const { data } = await api.post('/cv/wildcard/pdf')
  return data
}

/** @returns {Promise<{keywords: string[], min_relevance_score: number}>} */
export async function getPreferences() {
  const { data } = await api.get('/preferences')
  return data
}

/**
 * @param {{keywords?: string[], min_relevance_score?: number}} updates
 * @returns {Promise<{keywords: string[], min_relevance_score: number}>}
 */
export async function updatePreferences(updates) {
  const { data } = await api.patch('/preferences', updates)
  return data
}
