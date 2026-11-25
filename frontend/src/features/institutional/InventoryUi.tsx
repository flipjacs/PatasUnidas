import { NavLink } from 'react-router'
import './inventory.css'

export function InventoryNav() {
  return <nav className="inventory-nav" aria-label="Seções do estoque"><NavLink to="/ong/estoque" end>Produtos</NavLink><NavLink to="/ong/estoque/movimentacoes">Movimentações</NavLink><NavLink to="/ong/estoque/alertas">Alertas</NavLink><NavLink to="/ong/estoque/relatorios">Relatórios</NavLink><NavLink to="/ong/estoque/categorias">Categorias</NavLink><NavLink to="/ong/estoque/locais">Locais</NavLink><NavLink to="/ong/estoque/unidades">Unidades</NavLink></nav>
}

export function InventoryScopeNote() {
  return <p className="institutional-period-note">Entradas e saídas registram movimentações físicas de suprimentos, sem gerar lançamentos financeiros.</p>
}
