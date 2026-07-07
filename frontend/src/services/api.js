import axios from 'axios'

const API_BASE = 'http://localhost:5000/api'

export async function getJobs() {
  const { data } = await axios.get(`${API_BASE}/jobs`)
  return data
}

export async function collectJobs() {
  const { data } = await axios.post(`${API_BASE}/jobs/collect`)
  return data
}

export async function adaptJob(jobId) {
  const { data } = await axios.post(`${API_BASE}/jobs/${jobId}/adapt`)
  return data
}

export async function getAdaptation(jobId) {
  const { data } = await axios.get(`${API_BASE}/jobs/${jobId}/adaptation`)
  return data
}

export async function approveJob(jobId) {
  const { data } = await axios.post(`${API_BASE}/jobs/${jobId}/approve`)
  return data
}

export async function getApplications() {
  const { data } = await axios.get(`${API_BASE}/applications`)
  return data
}

export async function getCv() {
  const { data } = await axios.get(`${API_BASE}/cv`)
  return data
}
