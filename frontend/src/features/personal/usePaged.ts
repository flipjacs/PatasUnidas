import { useEffect, useState } from 'react'
import { personalError, type Page } from './api'

export function usePaged<T>(load: (page: number) => Promise<Page<T>>, enabled = true) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Page<T> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let current = true
    load(page).then(result => {
      if (!current) return
      setData(result)
      setError('')
      setLoading(false)
    }).catch(cause => {
      if (!current) return
      setData(null)
      setError(personalError(cause, 'Não foi possível carregar os registros.'))
      setLoading(false)
    })
    return () => { current = false }
  }, [load, page, attempt, enabled])

  function changePage(next: number) {
    if (next === page || next < 1) return
    setLoading(true)
    setPage(next)
    window.scrollTo(0, 0)
  }

  return { page, data, loading: enabled && loading, error, changePage, reload: () => { setLoading(true); setAttempt(value => value + 1) } }
}
