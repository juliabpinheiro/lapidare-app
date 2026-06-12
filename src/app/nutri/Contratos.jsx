import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR } from '../../lib/utils.js';

const TIPO_BR = { avulso: 'Avulso', trimestral: 'Trimestral', semestral: 'Semestral' };

function calcStatus(c) {
  if (!c.aceito) return 'pendente';
  if (c.tipo_plano === 'avulso') return 'ativo';
  const meses = c.tipo_plano === 'trimestral' ? 3 : 6;
  const expira = new Date(c.data_inicio + 'T12:00:00');
  expira.setMonth(expira.getMonth() + meses);
  return new Date() > expira ? 'encerrado' : 'ativo';
}

const PILLS = {
  ativo:     { bg: '#dcfce7', color: '#16a34a', label: 'Ativo' },
  encerrado: { bg: '#fee2e2', color: '#b91c1c', label: 'Encerrado' },
  pendente:  { bg: '#fef9c3', color: '#92400e', label: 'Pendente' },
};

/* ── Texto do contrato (read-only) ──────────────────────────────────── */
function ContratoTexto({ nome, tipoBR, valorBR, dataInicioBR }) {
  const P = ({ style, children }) => <p style={{ marginBottom: 8, ...style }}>{children}</p>;
  const H = ({ children }) => <p style={{ fontWeight: 700, marginTop: 16, marginBottom: 4 }}>{children}</p>;
  return (
    <div style={{ fontSize: 12, lineHeight: 1.75, color: '#2b2b2b' }}>
      <P style={{ fontWeight: 700, textAlign: 'center', fontSize: 13, marginBottom: 16 }}>
        CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE NUTRIÇÃO CLÍNICA
      </P>
      <P><strong>CONTRATADA:</strong> Júlia Barbosa Pinheiro, Nutricionista, CRN 20100737, CPF 166.485.087-28.</P>
      <P><strong>CONTRATANTE:</strong> {nome}.</P>
      <H>CLÁUSULA 1ª — DO OBJETO</H>
      <P>Prestação de serviços de acompanhamento nutricional individualizado.</P>
      <H>CLÁUSULA 2ª — DO PLANO CONTRATADO</H>
      <P>A CONTRATANTE optou pelo plano <strong>{tipoBR}</strong>, no valor de <strong>R$ {valorBR}</strong>, com início em <strong>{dataInicioBR}</strong>.</P>
      <ul style={{ paddingLeft: 20, marginBottom: 8 }}>
        <li>Plano Avulso: 1 consulta.</li>
        <li>Plano Trimestral: consultas em 3 meses consecutivos a partir da assinatura.</li>
        <li>Plano Semestral: consultas em 6 meses consecutivos a partir da assinatura.</li>
      </ul>
      <P>Cada consulta ocorrerá em intervalos de 30 dias corridos.</P>
      <H>CLÁUSULA 3ª — DA PRESCRIÇÃO DIETÉTICA</H>
      <P>O plano alimentar será entregue em até 3 dias úteis após cada consulta.</P>
      <H>CLÁUSULA 4ª — DO PAGAMENTO</H>
      <P>O valor total de R$ {valorBR} foi integralmente pago pela CONTRATANTE previamente ao acesso ao plano, sendo condição para utilização dos serviços.</P>
      <H>CLÁUSULA 5ª — DO AGENDAMENTO, REMARCAÇÃO E CANCELAMENTO</H>
      <P>5.1. Remarcações ou cancelamentos somente serão aceitos com antecedência mínima de 24 horas.</P>
      <P>5.2. Cancelamentos com menos de 24 horas serão considerados consulta realizada, sem direito a reposição ou reembolso.</P>
      <H>CLÁUSULA 6ª — DA INTRANSFERIBILIDADE</H>
      <P>6.1. Os serviços são pessoais e intransferíveis, não podendo ser cedidos a terceiros.</P>
      <P>6.2. Consultas não utilizadas dentro do período contratado serão perdidas, sem transferência para meses subsequentes.</P>
      <H>CLÁUSULA 7ª — DAS RESPONSABILIDADES</H>
      <P>7.1. A CONTRATADA prestará os serviços com ética e conforme as normas do CFN.</P>
      <P>7.2. A CONTRATANTE é responsável pelas informações fornecidas sobre seu estado de saúde.</P>
      <H>CLÁUSULA 8ª — DA RESCISÃO</H>
      <P>8.1. A rescisão por iniciativa da CONTRATANTE somente será aceita mediante comunicação prévia de até 3 dias úteis antes da data de entrega do plano alimentar.</P>
      <P>8.2. Em hipótese alguma haverá reembolso em caso de rescisão por iniciativa da CONTRATANTE, pelos seguintes motivos: (a) os planos Trimestral e Semestral são contratados com valor diferenciado em razão do compromisso pelo período integral; (b) o plano Avulso implica consulta já realizada; (c) a CONTRATADA reserva agenda exclusiva para a CONTRATANTE, incorrendo em perda financeira direta em caso de desistência; (d) o pagamento integral é condição de acesso ao plano.</P>
      <P>8.3. Em caso de rescisão por iniciativa da CONTRATADA sem justo motivo, será devolvido o valor proporcional às consultas não realizadas.</P>
      <H>CLÁUSULA 9ª — DO FORO</H>
      <P>Fica eleito o foro da Comarca do Rio de Janeiro/RJ para dirimir quaisquer litígios, nos termos do Código Civil Brasileiro e da Lei nº 14.063/2020.</P>
      <P style={{ marginTop: 16 }}>Rio de Janeiro, {dataInicioBR}.</P>
      <P><strong>CONTRATADA:</strong> Júlia Barbosa Pinheiro — CRN 20100737</P>
      <P><strong>CONTRATANTE:</strong> {nome}</P>
      <P style={{ marginTop: 14, fontStyle: 'italic', color: '#666', fontSize: 11 }}>
        Ao marcar abaixo, a CONTRATANTE declarou ter lido e concordado com os termos, conferindo validade de assinatura eletrônica nos termos da Lei nº 14.063/2020.
      </P>
    </div>
  );
}

/* ── Modal contrato completo (leitura) ──────────────────────────────── */
function ModalContrato({ contrato, onClose }) {
  const nome = contrato.paciente?.nome ?? '—';
  const tipoBR = TIPO_BR[contrato.tipo_plano] ?? contrato.tipo_plano;
  const valorBR = Number(contrato.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dataInicioBR = new Date(contrato.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const status = calcStatus(contrato);
  const pill = PILLS[status];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        zIndex: 200, padding: '24px 16px 32px', overflowY: 'auto',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, maxWidth: 680, width: '100%',
          margin: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,.2)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '0.5px solid var(--hair, #e6dfd0)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>
              Contrato digital
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--dark)' }}>{nome}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: pill.bg, color: pill.color }}>
                {pill.label}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{tipoBR} · R$ {valorBR}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Início: {dataBR(contrato.data_inicio)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--muted)', padding: 4, flexShrink: 0 }}>
            <i className="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>

        {/* Corpo */}
        <div style={{ padding: '16px 24px', maxHeight: '62vh', overflowY: 'auto' }}>
          <ContratoTexto nome={nome} tipoBR={tipoBR} valorBR={valorBR} dataInicioBR={dataInicioBR} />
        </div>

        {/* Rodapé com metadados de aceite */}
        <div style={{ padding: '12px 24px 20px', borderTop: '0.5px solid var(--hair, #e6dfd0)', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {contrato.aceito ? (
            <>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600, marginBottom: 2 }}>Assinado em</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {contrato.data_aceite
                    ? new Date(contrato.data_aceite).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </div>
              </div>
              {contrato.ip_aceite && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600, marginBottom: 2 }}>IP de origem</div>
                  <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'monospace' }}>{contrato.ip_aceite}</div>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
              Contrato ainda não assinado pela paciente.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Página principal ────────────────────────────────────────────────── */
export default function Contratos() {
  const { user } = useSession();
  const [contratos, setContratos] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [contratoSel, setContratoSel] = useState(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('contratos_pacientes')
      .select('*, paciente:pacientes(nome)')
      .eq('nutri_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setContratos(data ?? []));
  }, [user]);

  const filtrados = useMemo(() => {
    if (!contratos) return [];
    const q = busca.trim().toLowerCase();
    return contratos.filter(c => {
      if (q && !(c.paciente?.nome ?? '').toLowerCase().includes(q)) return false;
      if (filtroTipo && c.tipo_plano !== filtroTipo) return false;
      return true;
    });
  }, [contratos, busca, filtroTipo]);

  // Totais para o resumo
  const totais = useMemo(() => {
    if (!contratos) return null;
    return contratos.reduce((acc, c) => {
      const s = calcStatus(c);
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
  }, [contratos]);

  return (
    <>
      <div className="page-title">Contratos</div>
      <div className="page-sub">Histórico completo de contratos digitais das pacientes</div>

      {/* Cards de resumo */}
      {totais && (
        <div className="g3" style={{ marginBottom: 16 }}>
          {[
            { key: 'ativo',     label: 'Ativos',    icon: 'circle-check',  color: '#16a34a', bg: '#dcfce7' },
            { key: 'encerrado', label: 'Encerrados', icon: 'circle-x',     color: '#b91c1c', bg: '#fee2e2' },
            { key: 'pendente',  label: 'Pendentes',  icon: 'circle-dotted', color: '#92400e', bg: '#fef9c3' },
          ].map(s => (
            <div key={s.key} className="stat" style={{ border: `0.5px solid ${s.bg}` }}>
              <div className="stat-lbl" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className={`ti ti-${s.icon}`} style={{ color: s.color, fontSize: 13 }} aria-hidden="true"></i>
                {s.label}
              </div>
              <div className="stat-val" style={{ fontSize: 28, color: s.color }}>{totais[s.key] ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          className="input-field"
          style={{ width: 240, margin: 0 }}
          placeholder="Buscar por nome..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select
          className="input-field"
          style={{ width: 180, margin: 0 }}
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
        >
          <option value="">Todos os planos</option>
          <option value="avulso">Avulso</option>
          <option value="trimestral">Trimestral</option>
          <option value="semestral">Semestral</option>
        </select>
        {(busca || filtroTipo) && (
          <button
            className="btn-outline"
            style={{ fontSize: 12 }}
            onClick={() => { setBusca(''); setFiltroTipo(''); }}
          >
            <i className="ti ti-x" aria-hidden="true"></i> Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      {contratos === null ? (
        <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>
      ) : filtrados.length === 0 ? (
        <div className="card empty-card">
          <i className="ti ti-file-off" style={{ fontSize: 36, color: 'var(--muted)', display: 'block', marginBottom: 10 }} aria-hidden="true"></i>
          <div className="empty-title">Nenhum contrato encontrado</div>
          <div className="empty-sub">
            {busca || filtroTipo
              ? 'Tente ajustar os filtros.'
              : 'Os contratos aparecerão aqui conforme as pacientes assinarem.'}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Plano</th>
                <th>Valor</th>
                <th>Início</th>
                <th>Aceite</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => {
                const status = calcStatus(c);
                const pill = PILLS[status];
                return (
                  <tr
                    key={c.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setContratoSel(c)}
                  >
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.paciente?.nome ?? '—'}</div>
                    </td>
                    <td>{TIPO_BR[c.tipo_plano] ?? c.tipo_plano}</td>
                    <td>R$ {Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td>{dataBR(c.data_inicio)}</td>
                    <td>
                      {c.data_aceite
                        ? dataBR(c.data_aceite)
                        : <span style={{ color: '#bbb' }}>—</span>}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px',
                        borderRadius: 20, background: pill.bg, color: pill.color,
                      }}>
                        {pill.label}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <i className="ti ti-chevron-right" style={{ color: 'var(--text3)' }} aria-hidden="true"></i>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {contratoSel && (
        <ModalContrato contrato={contratoSel} onClose={() => setContratoSel(null)} />
      )}
    </>
  );
}
