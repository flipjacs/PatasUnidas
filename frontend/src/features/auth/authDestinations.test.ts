import { describe, expect, it } from 'vitest'
import { allowedPrivateDestination } from './auth'

describe('retorno seguro após login', () => {
  it('permite voltar ao contexto de adoção, doação e apadrinhamento do usuário', () => {
    expect(allowedPrivateDestination('USUARIO', '/animais/12/solicitar')).toBe(true)
    expect(allowedPrivateDestination('USUARIO', '/animais/12/doar')).toBe(true)
    expect(allowedPrivateDestination('USUARIO', '/animais/12/apadrinhar')).toBe(true)
    expect(allowedPrivateDestination('USUARIO', '/minha-area/adotados/12/prontuarios/3')).toBe(true)
  })

  it('rejeita destino externo e área de outro perfil', () => {
    expect(allowedPrivateDestination('USUARIO', '//exemplo.test')).toBe(false)
    expect(allowedPrivateDestination('ADMINISTRADOR', '/animais/12/solicitar')).toBe(false)
    expect(allowedPrivateDestination('USUARIO', '/plataforma')).toBe(false)
  })

  it('preserva retorno institucional somente para perfis autorizados', () => {
    expect(allowedPrivateDestination('ADMINISTRADOR', '/ong/funcionarios/novo')).toBe(true)
    expect(allowedPrivateDestination('VOLUNTARIO', '/ong/animais/12')).toBe(true)
    expect(allowedPrivateDestination('VOLUNTARIO', '/ong/funcionarios')).toBe(false)
    expect(allowedPrivateDestination('VETERINARIO', '/ong/animais')).toBe(true)
    expect(allowedPrivateDestination('VETERINARIO', '/ong/animais/12')).toBe(true)
    expect(allowedPrivateDestination('VETERINARIO', '/ong/animais/novo')).toBe(false)
    expect(allowedPrivateDestination('ADMINISTRADOR', '/ong/funcionarios/12/editar')).toBe(true)
    expect(allowedPrivateDestination('USUARIO', '/ong/animais')).toBe(false)
  })
})
